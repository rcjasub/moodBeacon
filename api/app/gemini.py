"""Small shared helper for Gemini calls. Returns None on any failure so callers fall back.

Kept fast on purpose: one shared client (the HTTPS connection stays open between calls), low
thinking, a hard deadline, and a cooldown after a quota error so callers fall back right away
instead of waiting on Google.
"""

import asyncio
import logging
import re
import time

from .config import get_settings

log = logging.getLogger(__name__)

REQUEST_TIMEOUT_S = 12  # one HTTP request
DEADLINE_S = 15  # the whole call, retries included
QUOTA_COOLDOWN_S = 60  # used when a quota error doesn't say how long to wait

_client = None
_quota_until: dict[str, float] = {}  # model -> time.monotonic() until which it's out of quota
_no_thinking: set[str] = set()  # models that turned out not to accept thinking levels


def enabled() -> bool:
    return bool(get_settings().gemini_api_key)


def _get_client():
    global _client
    if _client is None:
        from google import genai
        from google.genai import types

        _client = genai.Client(
            api_key=get_settings().gemini_api_key,
            http_options=types.HttpOptions(timeout=REQUEST_TIMEOUT_S * 1000),  # milliseconds
        )
    return _client


def _start_cooldown(model: str, e: Exception) -> None:
    """Free-tier quota is per model, so only this model is skipped."""
    m = re.search(r"retryDelay'?\"?:\s*'?\"?(\d+)s", str(e))
    wait = int(m.group(1)) if m else QUOTA_COOLDOWN_S
    _quota_until[model] = time.monotonic() + wait
    log.warning("Gemini %s out of quota; using fallbacks for the next %ss", model, wait)


async def _generate(system: str, contents: str, temperature: float, schema, model: str):
    from google.genai import types

    config = types.GenerateContentConfig(
        system_instruction=system,
        temperature=temperature,
        max_output_tokens=2048,  # newer models spend part of this on reasoning
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),  # no tools here
    )
    if model not in _no_thinking:
        # These are short rewording/lookup tasks; "low" answers in about half the time of the default.
        config.thinking_config = types.ThinkingConfig(thinking_level="low")
    if schema is not None:
        config.response_mime_type = "application/json"
        config.response_schema = schema
    # "Model busy" (503/500) is usually brief, so retry a couple of times. Quota errors (429) are not.
    for attempt in range(3):
        try:
            resp = await _get_client().aio.models.generate_content(model=model, contents=contents, config=config)
            break
        except Exception as e:  # noqa: BLE001
            code = getattr(e, "code", None)
            if code == 400 and model not in _no_thinking and "thinking" in str(e).lower():
                log.info("Model %s doesn't take thinking levels; retrying without", model)
                _no_thinking.add(model)
                config.thinking_config = None
                continue
            if attempt == 2 or code not in (500, 503):
                raise
            log.info("Gemini busy (%s), retrying", code)
            await asyncio.sleep(0.5 * (attempt + 1))
    if schema is None:
        return (resp.text or "").strip() or None
    return resp.parsed if isinstance(resp.parsed, schema) else schema.model_validate_json(resp.text or "")


async def generate(system: str, contents: str, *, temperature: float = 0.2, schema=None, model: str | None = None):
    """Plain text, or a parsed `schema` instance when one is given. None if unavailable or failed.

    `model` defaults to GEMINI_MODEL.
    """
    model = model or get_settings().gemini_model
    if not enabled() or time.monotonic() < _quota_until.get(model, 0):
        return None
    try:
        return await asyncio.wait_for(_generate(system, contents, temperature, schema, model), DEADLINE_S)
    except TimeoutError:
        log.warning("Gemini call took over %ss, using fallback", DEADLINE_S)
        return None
    except Exception as e:  # noqa: BLE001
        if getattr(e, "code", None) == 429:
            _start_cooldown(model, e)
        else:
            log.warning("Gemini call failed: %s", e)
        return None
