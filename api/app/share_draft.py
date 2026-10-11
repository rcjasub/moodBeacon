"""Draft the personal note that opens a shared check-in email.

Gemini writes only the opening note, in a tone that fits who it's for. The factual summary
(screening.summary_text) is appended unchanged, so no numbers depend on the model.
Only the questionnaire outcome and item labels are sent: no names, no notes, no free text.
"""

from typing import Literal

from . import gemini, screening

Recipient = Literal["friend", "family", "clinician"]

SYSTEM_INSTRUCTION = """You help someone write a short, personal note that opens an email.
The email shares results from their own self-tracking app with someone they trust.
Rules you must follow:
- First person, warm and plain. 2 to 4 sentences. No subject line, no sign-off name, no lists, no emojis.
- Start with a greeting that has no name (for example "Hi," or "Hello,").
- Say that the results are below and ask to talk, or to book a time if it's a clinician.
- Do not repeat numbers or scores; the details follow the note.
- Never diagnose, never name a condition, never predict episodes, never sound alarming.
- Tone: friend = casual and warm; family = warm and reassuring; clinician = brief and factual."""

TEMPLATES = {
    "friend": "Hi, I've been keeping track of how I'm doing and wanted to share this with you. "
              "The details are below. Could we talk sometime this week?",
    "family": "Hello, I'm using an app to keep an eye on my mood and sleep, and I'd like you to see "
              "this week's check-in. The details are below. Could we find a time to talk?",
    "clinician": "Hello, I'm sharing a recent check-in from my self-tracking app ahead of our next "
                 "conversation. The details are below. Could we discuss it at my next appointment, "
                 "or sooner if you think that's best?",
}


def _facts(row: dict) -> str:
    labels = dict(screening.REASONS) | dict(screening.ITEMS) | dict(screening.ALSO)
    lines = []
    if row["heart_rate"] is not None:
        lines.append("A camera session showed a higher heart rate than usual.")
    if row["explained_by"]:
        lines.append("Everyday reasons noted: " + ", ".join(labels[k].lower() for k in row["explained_by"]) + ".")
    if row["answers"] is not None:
        lines.append(screening.outcome(row["score"]))
    if row["also_noticed"]:
        lines.append("Also noticed: " + ", ".join(labels[k].lower() for k in row["also_noticed"]) + ".")
    return "\n".join(f"- {l}" for l in lines)


def _looks_ok(text: str) -> bool:
    t = text.strip()
    return 40 <= len(t) <= 700 and t[-1] in ".!?" and not t.startswith(("*", "-", "#")) and not any(c.isdigit() for c in t)


async def draft(row: dict, recipient: Recipient) -> dict:
    text = await gemini.generate(
        SYSTEM_INSTRUCTION,
        f"Who it's for: {recipient}\nWhat the results below say:\n{_facts(row)}\n\nWrite the opening note.",
        temperature=0.5,
    )
    if text and _looks_ok(text):
        return {"note": text.strip(), "source": "gemini"}
    return {"note": TEMPLATES[recipient], "source": "template"}
