"""Small shared helper for Gemini calls. Returns None on any failure so callers fall back."""

import asyncio
import logging

from .config import get_settings

log = logging.getLogger(__name__)


def enabled() -> bool:
    return bool(get_settings().gemini_api_key)


async def generate(system: str, contents: str, *, temperature: float = 0.2, schema=None):
    """Plain text, or a parsed `schema` instance when one is given. None if unavailable or failed."""
    s = get_settings()
    if not s.gemini_api_key:
        return None
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=s.gemini_api_key)
        config = types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            max_output_tokens=2048,  # newer models spend part of this on reasoning
        )
        if schema is not None:
            config.response_mime_type = "application/json"
            config.response_schema = schema
        # "Model busy" (503/500) is usually brief, so retry a couple of times. Quota errors (429) are not.
        for attempt in range(3):
            try:
                resp = await client.aio.models.generate_content(model=s.gemini_model, contents=contents, config=config)
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 2 or getattr(e, "code", None) not in (500, 503):
                    raise
                log.info("Gemini busy (%s), retrying", getattr(e, "code", "?"))
                await asyncio.sleep(1.5 * (attempt + 1))
        if schema is None:
            return (resp.text or "").strip() or None
        return resp.parsed if isinstance(resp.parsed, schema) else schema.model_validate_json(resp.text or "")
    except Exception as e:  # noqa: BLE001
        log.warning("Gemini call failed: %s", e)
        return None
