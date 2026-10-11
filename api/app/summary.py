"""Weekly summary: numbers are computed in code; Gemini (optional) only rewords them."""

from . import gemini
from .config import get_settings

# Last good Gemini wording, reused until the underlying facts change.
_cache: dict[str, str] = {}

SYSTEM_INSTRUCTION = """You rewrite a short factual summary of someone's own self-tracking data.
Rules you must follow:
- Use only the facts given. Do not add numbers, causes, or interpretations.
- Never diagnose, never name a condition, never predict episodes, never give a risk level.
- Never give medical advice. You may suggest reviewing the timeline or their own wellness plan.
- Calm, plain, second-person language. 2 to 4 sentences. No lists, no emojis."""


def template_summary(facts: dict) -> str:
    if facts["checkins"] == 0:
        return "No check-ins in the last 7 days yet."
    parts = [f"You checked in on {facts['checkins']} of the last 7 days."]
    if facts["avg_sleep"] is not None:
        parts.append(f"Average sleep was {facts['avg_sleep']:.1f} hours.")
    if facts["racing_days"]:
        n = facts["racing_days"]
        parts.append(f"You noted racing thoughts on {n} day{'s' if n != 1 else ''}.")
    if facts["common_mood"]:
        parts.append(f"Your most common mood was “{facts['common_mood']}”.")
    if facts["camera_sessions"]:
        parts.append(f"You ran {facts['camera_sessions']} camera sessions.")
    return " ".join(parts)


def _looks_like_summary(text: str) -> bool:
    """Reject truncated or malformed output so the UI never shows junk."""
    return len(text) >= 40 and text[-1] in ".!?”\"" and not text.lstrip().startswith(("*", "-", "#"))


async def gemini_summary(facts: dict) -> str | None:
    if not gemini.enabled():
        return None
    key = repr(sorted(facts.items()))
    if key in _cache:
        return _cache[key]
    text = await gemini.generate(
        SYSTEM_INSTRUCTION,
        f"Rewrite these facts as a short, calm summary for the person:\n\n{template_summary(facts)}",
        model=get_settings().gemini_fast_model,
    )
    if not text or not _looks_like_summary(text):
        return None
    _cache.clear()
    _cache[key] = text
    return text
