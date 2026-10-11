"""Follow-up prompts that come from camera sessions, plus the shared insert-once helper.

Sustained rule: your daily camera heart rate is noticeably above your own usual on several
of the last 7 days. "Usual" comes from older days (8-60 days back), so a recent run of high
days can't quietly become the new normal. Detection is plain code; Gemini (optional) only
rewords the message, and the numbers are checked to survive the rewording.
"""

import asyncio
import json
import logging
from datetime import date
from statistics import median

from . import gemini

log = logging.getLogger(__name__)

RECENT_DAYS = 7
MIN_ELEVATED_DAYS = 3
MIN_BASELINE_DAYS = 3
ABOVE_USUAL = 15.0   # bpm over your usual daily typical
RESTING_HIGH = 100.0

SYSTEM_INSTRUCTION = """You rewrite a short, factual notice from a person's self-tracking app.
Rules you must follow:
- Keep every number exactly as given. Do not add numbers, causes, or interpretations.
- Never diagnose, never name a condition, never predict episodes, never give a risk level.
- Never give medical advice. You may suggest reviewing their check-ins or wellness plan,
  or letting someone they trust know.
- Calm, plain, second-person language. 2 to 3 sentences. No lists, no emojis."""


async def insert_prompt_once(conn, rule_id: str, message: str, details: dict | None = None) -> dict | None:
    """Create a prompt unless the same rule is open/snoozed or was raised in the last 7 days."""
    cur = await conn.execute(
        """SELECT 1 FROM prompts WHERE rule_id = %s
           AND (status IN ('open', 'snoozed') OR created_at > now() - interval '7 days')""",
        (rule_id,),
    )
    if await cur.fetchone():
        return None
    cur = await conn.execute(
        "INSERT INTO prompts (rule_id, message, details) VALUES (%s, %s, %s) RETURNING *",
        (rule_id, message, json.dumps(details) if details else None),
    )
    return await cur.fetchone()


def sustained_heart_rate(day_hr: dict[date, float], today: date) -> dict | None:
    """Facts when heart rate was high on enough recent days, compared with older days."""
    baseline = [v for d, v in day_hr.items() if 8 <= (today - d).days <= 60]
    if len(baseline) < MIN_BASELINE_DAYS:
        return None
    usual = median(baseline)
    recent = {d: v for d, v in day_hr.items() if 0 <= (today - d).days < RECENT_DAYS}
    high = {d: v for d, v in recent.items() if v >= usual + ABOVE_USUAL or v >= RESTING_HIGH}
    if len(high) < MIN_ELEVATED_DAYS:
        return None
    return {
        "days_elevated": len(high),
        "days_measured": len(recent),
        "usual": round(usual),
        "typical_recent": round(median(high.values())),
        "dates": [d.strftime("%b %-d") for d in sorted(high)],
    }


def template_message(f: dict) -> str:
    return (
        f"Your camera heart rate was above your usual (about {f['usual']} bpm) on "
        f"{f['days_elevated']} of the last {RECENT_DAYS} days, typically around {f['typical_recent']} bpm. "
        "This doesn't mean anything is wrong. It may be worth looking at alongside your sleep and "
        "check-ins, and letting someone you trust know."
    )


async def worded_message(f: dict) -> tuple[str, str]:
    template = template_message(f)
    try:
        text = await asyncio.wait_for(gemini.generate(SYSTEM_INSTRUCTION, f"Rewrite this notice:\n\n{template}"), 12)
    except asyncio.TimeoutError:
        text = None
    numbers = [str(f["usual"]), str(f["days_elevated"]), str(f["typical_recent"])]
    if text and 40 <= len(text) <= 600 and all(n in text for n in numbers) and not text.lstrip().startswith(("*", "-", "#")):
        return text, "gemini"
    return template, "template"


async def check_sessions(conn) -> dict | None:
    """Run after a camera session ends. Returns the new prompt, if one was raised."""
    # "Today" comes from the database so it uses the same day boundary as date_trunc below.
    today = (await (await conn.execute("SELECT current_date AS d")).fetchone())["d"]
    cur = await conn.execute(
        """SELECT date_trunc('day', ts)::date AS day,
                  percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS hr
           FROM readings WHERE ts > now() - interval '61 days' AND heart_rate IS NOT NULL
           GROUP BY 1 HAVING count(*) >= 5"""
    )
    day_hr = {r["day"]: r["hr"] for r in await cur.fetchall()}
    facts = sustained_heart_rate(day_hr, today)
    if not facts:
        return None
    message, source = await worded_message(facts)
    return await insert_prompt_once(conn, "hr_sustained", message, {**facts, "wording": source})


def share_text(prompt: dict) -> str:
    """Plain text for notifying a trusted person. Facts come from the stored prompt."""
    lines = [prompt["message"], ""]
    d = prompt.get("details") or {}
    if prompt["rule_id"] == "hr_sustained" and d:
        lines += [
            f"Days with a higher heart rate: {', '.join(d['dates'])}",
            f"My usual camera heart rate: about {d['usual']} bpm. Recently: around {d['typical_recent']} bpm.",
            "",
        ]
    lines += [
        "I'm sharing this from BipolarBird, a self-tracking app I use. It doesn't diagnose anything;",
        "I just wanted you to know and would appreciate a check-in.",
        "Camera heart-rate readings are estimates and can be affected by light and movement.",
        "If this is an emergency, call or text 988 (US) or your local emergency number.",
    ]
    return "\n".join(lines)
