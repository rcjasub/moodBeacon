"""Appointment brief: numbers are computed in code; Gemini (optional) only rewords them.

Same contract as the weekly summary: only counts and averages are sent, never notes.
"""

import logging
from collections import Counter
from datetime import date, timedelta
from statistics import median

from pydantic import BaseModel

from .config import get_settings

log = logging.getLogger(__name__)

# Last good Gemini wording, reused until the underlying facts change.
_cache: dict[str, dict] = {}

MOOD_LABELS = {
    "low": "Low", "slightly_low": "A bit low", "steady": "Steady",
    "lifted": "Lifted", "very_high": "Very high",
}
ENERGY_LABELS = {
    "very_low": "Very low", "lower": "Lower than usual", "usual": "Usual",
    "higher": "Higher than usual", "very_high": "Hard to slow down",
}
FLAGS = {
    "less_sleep_need": "needed less sleep than usual",
    "racing_thoughts": "noted racing thoughts",
    "irritable": "felt irritable or on edge",
    "unusual_activity": "did things unusual for you",
    "off_baseline": "felt different from your usual baseline",
}

SYSTEM_INSTRUCTION = """You help someone prepare for an appointment with their own clinician,
using a short list of facts from their self-tracking app.
Rules you must follow:
- Use only the facts given. Do not add numbers, causes, trends or interpretations.
- Never diagnose, never name a condition, never predict episodes, never give a risk level.
- Never give medical advice or suggest medication changes.
- "brief": 3 to 5 calm, plain sentences in the first person ("I checked in on..."),
  written so the person can read it aloud or hand it to their clinician. No lists, no emojis.
- "questions": 2 or 3 short, open questions the person might ask their clinician about
  what they tracked. Each ends with a question mark."""


class Wording(BaseModel):
    brief: str
    questions: list[str]


def compute_facts(checkins: list[dict], camera: dict, n_prompts: int, days: int, today: date) -> dict:
    sleeps = [r["sleep_hours"] for r in checkins if r["sleep_hours"] is not None]
    recent_cut = today - timedelta(days=7)
    recent = [r["sleep_hours"] for r in checkins if r["sleep_hours"] is not None and r["day"] > recent_cut]
    earlier = [r["sleep_hours"] for r in checkins if r["sleep_hours"] is not None and r["day"] <= recent_cut]
    moods = Counter(r["mood"] for r in checkins)
    energies = Counter(r["energy"] for r in checkins)
    return {
        "days": days,
        "checkins": len(checkins),
        "avg_sleep": round(sum(sleeps) / len(sleeps), 1) if sleeps else None,
        "min_sleep": min(sleeps) if sleeps else None,
        "short_nights": sum(1 for s in sleeps if s < 6),
        "recent_sleep": round(median(recent), 1) if recent else None,
        "earlier_sleep": round(median(earlier), 1) if earlier and days > 7 else None,
        "flags": {k: sum(bool(r[k]) for r in checkins) for k in FLAGS},
        "moods": {MOOD_LABELS[m]: n for m, n in moods.most_common()},
        "energies": {ENERGY_LABELS[e]: n for e, n in energies.most_common()},
        "camera_sessions": camera["sessions"],
        "heart_rate": round(camera["heart_rate"]) if camera["heart_rate"] is not None else None,
        "breathing_rate": round(camera["breathing_rate"]) if camera["breathing_rate"] is not None else None,
        "follow_ups": n_prompts,
    }


def _counts(d: dict) -> str:
    return ", ".join(f"{label} ({n})" for label, n in d.items())


def fact_lines(f: dict) -> list[str]:
    """The source of truth: plain statements shown as-is and handed to Gemini to reword."""
    if f["checkins"] == 0:
        return [f"No check-ins in the last {f['days']} days."]
    lines = [f"Checked in on {f['checkins']} of the last {f['days']} days."]
    if f["avg_sleep"] is not None:
        lines.append(
            f"Average sleep {f['avg_sleep']:.1f} hours; shortest night {f['min_sleep']:g} hours; "
            f"{f['short_nights']} night{'s' if f['short_nights'] != 1 else ''} under 6 hours."
        )
    if f["recent_sleep"] is not None and f["earlier_sleep"] is not None:
        lines.append(
            f"Typical sleep in the last 7 days {f['recent_sleep']:g} hours, "
            f"compared with {f['earlier_sleep']:g} hours earlier in the period."
        )
    if f["moods"]:
        lines.append(f"Mood check-ins: {_counts(f['moods'])}.")
    if f["energies"]:
        lines.append(f"Energy check-ins: {_counts(f['energies'])}.")
    for key, text in FLAGS.items():
        n = f["flags"][key]
        if n:
            lines.append(f"Days you {text}: {n}.")
    if f["camera_sessions"]:
        line = f"Camera sessions: {f['camera_sessions']}."
        if f["heart_rate"] is not None:
            line += f" Typical heart rate {f['heart_rate']} bpm, breathing {f['breathing_rate']} per minute."
        lines.append(line)
    if f["follow_ups"]:
        lines.append(f"Follow-up prompts shown: {f['follow_ups']}.")
    return lines


def template_brief(f: dict) -> str:
    return " ".join(fact_lines(f))


def template_questions(f: dict) -> list[str]:
    q = []
    if f["short_nights"] or f["flags"]["less_sleep_need"]:
        q.append("What should I do if my sleep keeps getting shorter?")
    if f["flags"]["racing_thoughts"] or f["flags"]["irritable"]:
        q.append("Is there anything I can try when I notice racing thoughts or irritability?")
    if f["flags"]["off_baseline"] or f["flags"]["unusual_activity"]:
        q.append("Which changes from my usual baseline should prompt me to contact you sooner?")
    q.append("Is there anything in my tracking you'd like me to watch more closely?")
    return q[:3]


def _looks_ok(w: Wording) -> bool:
    """Reject truncated or malformed output so the UI never shows junk."""
    b = w.brief.strip()
    return (
        len(b) >= 60 and b[-1] in ".!?”\"" and not b.startswith(("*", "-", "#"))
        and 1 <= len(w.questions) <= 4 and all(q.strip().endswith("?") for q in w.questions)
    )


async def gemini_brief(f: dict) -> dict | None:
    s = get_settings()
    if not s.gemini_api_key:
        return None
    key = repr(f)
    if key in _cache:
        return _cache[key]
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=s.gemini_api_key)
        facts = "\n".join(f"- {line}" for line in fact_lines(f))
        resp = await client.aio.models.generate_content(
            model=s.gemini_model,
            contents=f"Facts from my own tracking:\n{facts}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.2,
                max_output_tokens=2048,  # newer models spend part of this on reasoning
                response_mime_type="application/json",
                response_schema=Wording,
            ),
        )
        w = resp.parsed if isinstance(resp.parsed, Wording) else Wording.model_validate_json(resp.text or "")
        if not _looks_ok(w):
            return None
        out = {"brief": w.brief.strip(), "questions": [q.strip() for q in w.questions[:3]]}
        _cache.clear()
        _cache[key] = out
        return out
    except Exception as e:  # noqa: BLE001
        log.warning("Gemini appointment brief failed, using template: %s", e)
        return None
