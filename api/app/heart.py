"""Was this session's heart rate high for you? Compared with your own earlier sessions.

Flags only; never says why. The follow-up asks the person about everyday causes first.
"""

from statistics import median

RESTING_HIGH = 100.0  # bpm: common upper bound for an adult at rest
ABOVE_USUAL = 20.0    # bpm over your own typical session
MIN_HISTORY = 3       # earlier sessions needed before "usual" means anything


def check(typical: float | None, past: list[float]) -> dict:
    if typical is None:
        return {"elevated": False, "typical": None, "usual": None, "message": None}
    usual = median(past) if len(past) >= MIN_HISTORY else None
    above_usual = usual is not None and typical >= usual + ABOVE_USUAL
    elevated = typical >= RESTING_HIGH or above_usual
    message = None
    if elevated:
        compared = (
            f"about {round(typical - usual)} bpm above your usual {round(usual)}"
            if above_usual else "above the usual resting range"
        )
        message = f"Your heart rate this session was {round(typical)} bpm, {compared}."
    return {"elevated": elevated, "typical": typical, "usual": usual, "message": message}
