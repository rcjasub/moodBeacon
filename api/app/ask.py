"""Answer a question about the person's own timeline.

The code builds the data (a per-day table plus week-over-week aggregates); Gemini only answers
from it. Check-in notes and Let-it-go notes are never included.
"""

import re
from datetime import date, timedelta
from statistics import mean, median

from pydantic import BaseModel

from . import gemini

DAYS = 30

MOOD = {"low": "Low", "slightly_low": "A bit low", "steady": "Steady", "lifted": "Lifted", "very_high": "Very high"}
ENERGY = {"very_low": "Very low", "lower": "Lower than usual", "usual": "Usual",
          "higher": "Higher than usual", "very_high": "Hard to slow down"}
FLAGS = {"racing_thoughts": "racing thoughts", "irritable": "irritable", "less_sleep_need": "needed less sleep",
         "unusual_activity": "unusual activity", "off_baseline": "off usual baseline"}

CRISIS = re.compile(r"\b(suicid\w*|kill (my|him|her)self|end (my|it all)|self[- ]?harm|hurt myself|want to die)\b", re.I)
CRISIS_ANSWER = (
    "It sounds like you might be going through something really hard. You don't have to handle it alone: "
    "call or text 988 (US) or your local emergency number to talk to someone right now. "
    "Your wellness plan also lists people you can reach out to."
)

SYSTEM_INSTRUCTION = """You answer questions about a person's own self-tracking data, which is given to you.
Rules you must follow:
- Use only the data given. If it doesn't contain the answer, say so plainly.
- Prefer the precomputed totals and averages; mention specific dates when helpful (e.g. "Oct 3").
- Never diagnose, never name a condition, never predict episodes, never give a risk level.
  If asked something like that, say the app can't answer it and suggest talking with their clinician.
- Never give medical or medication advice. You may point to their wellness plan or the Timeline.
- Calm, plain, second-person language. 1 to 4 sentences. No lists, no markdown, no emojis."""


class Answer(BaseModel):
    answer: str
    answerable: bool


def _fmt(d: date) -> str:
    return d.strftime("%b %-d")


def build_data(checkins: list[dict], measured: list[dict], today: date) -> str:
    by_day = {c["day"]: c for c in checkins}
    cam = {m["day"]: m for m in measured}
    rows = ["date | mood | energy | sleep h | flags | camera heart rate (bpm) | camera breathing (/min)"]
    for i in range(DAYS - 1, -1, -1):
        d = today - timedelta(days=i)
        c, m = by_day.get(d), cam.get(d)
        if not c and not m:
            continue
        flags = ", ".join(v for k, v in FLAGS.items() if c and c[k]) or "-"
        hr = f"{m['hr']:.0f}" if m and m["hr"] is not None else "-"
        br = f"{m['br']:.0f}" if m and m["br"] is not None else "-"
        rows.append(" | ".join([
            _fmt(d), MOOD.get(c["mood"], "-") if c else "-", ENERGY.get(c["energy"], "-") if c else "-",
            f"{c['sleep_hours']:g}" if c and c["sleep_hours"] is not None else "-", flags, hr, br,
        ]))

    def window(start: int, end: int) -> str:
        span = [today - timedelta(days=i) for i in range(start, end)]
        cs = [by_day[d] for d in span if d in by_day]
        sleeps = [c["sleep_hours"] for c in cs if c["sleep_hours"] is not None]
        hrs = [cam[d]["hr"] for d in span if d in cam and cam[d]["hr"] is not None]
        parts = [f"{len(cs)} check-ins"]
        if sleeps:
            parts.append(f"average sleep {mean(sleeps):.1f} h")
        for k, v in FLAGS.items():
            n = sum(c[k] for c in cs)
            if n:
                parts.append(f"{v} on {n} day{'s' if n != 1 else ''}")
        moods = [MOOD[c["mood"]] for c in cs]
        if moods:
            parts.append("moods: " + ", ".join(f"{m} x{moods.count(m)}" for m in dict.fromkeys(moods)))
        if hrs:
            parts.append(f"typical camera heart rate {median(hrs):.0f} bpm over {len(hrs)} day{'s' if len(hrs) != 1 else ''}")
        return "; ".join(parts)

    return "\n".join([
        f"Today is {_fmt(today)}. Data covers the last {DAYS} days; days with nothing recorded are left out.",
        "",
        "Precomputed:",
        f"- This week (last 7 days): {window(0, 7)}",
        f"- Last week (8-14 days ago): {window(7, 14)}",
        f"- Whole period ({DAYS} days): {window(0, DAYS)}",
        "",
        "Per day:",
        *rows,
    ])


async def answer(question: str, data: str) -> dict:
    if CRISIS.search(question):
        return {"answer": CRISIS_ANSWER, "source": "safety"}
    if not gemini.enabled():
        return {"answer": None, "source": "unavailable"}
    out = await gemini.generate(SYSTEM_INSTRUCTION, f"My data:\n{data}\n\nMy question: {question}", schema=Answer)
    if not out or not out.answer.strip() or out.answer.lstrip().startswith(("*", "-", "#")):
        return {"answer": "Gemini couldn't answer just now (it may be busy or out of quota). Try again later.", "source": "error"}
    return {"answer": out.answer.strip(), "source": "gemini", "answerable": out.answerable}
