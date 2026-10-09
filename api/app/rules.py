"""Deterministic follow-up rules.

Each rule looks only at the person's own recent check-ins and returns a calm,
non-diagnostic message when it matches. No scores, no predictions.
"""

from collections.abc import Callable
from datetime import date, timedelta
from statistics import median

Checkin = dict  # row from the checkins table
Rule = Callable[[list[Checkin], date], str | None]

DEFAULT_USUAL_SLEEP = 7.0


def _by_day(rows: list[Checkin]) -> dict[date, Checkin]:
    return {r["day"]: r for r in rows}


def _last_n_days(rows: list[Checkin], today: date, n: int) -> list[Checkin | None]:
    days = _by_day(rows)
    return [days.get(today - timedelta(days=i)) for i in range(n)]


def usual_sleep(rows: list[Checkin], today: date) -> float:
    """Median sleep over days 4-28 back, so recent nights don't define 'usual'."""
    hist = [
        r["sleep_hours"]
        for r in rows
        if r["sleep_hours"] is not None and 4 <= (today - r["day"]).days <= 28
    ]
    return median(hist) if len(hist) >= 5 else DEFAULT_USUAL_SLEEP


def short_sleep_streak(rows: list[Checkin], today: date) -> str | None:
    recent = _last_n_days(rows, today, 3)
    if any(r is None or r["sleep_hours"] is None for r in recent):
        return None
    usual = usual_sleep(rows, today)
    if all(r["sleep_hours"] <= usual - 1.5 for r in recent):
        avg = sum(r["sleep_hours"] for r in recent) / 3
        less_need = all(r["less_sleep_need"] for r in recent)
        extra = " and less need for sleep" if less_need else ""
        return (
            f"About {avg:.0f} hours of sleep{extra}, three days in a row. "
            "Worth reviewing. It does not mean anything is wrong."
        )
    return None


def racing_thoughts(rows: list[Checkin], today: date) -> str | None:
    recent = [r for r in _last_n_days(rows, today, 5) if r]
    if sum(r["racing_thoughts"] for r in recent) >= 3:
        return (
            "You noted racing thoughts on 3 or more of the last 5 days. "
            "Worth a look alongside your sleep. It does not mean anything is wrong."
        )
    return None


def energy_up(rows: list[Checkin], today: date) -> str | None:
    recent = _last_n_days(rows, today, 3)
    if all(r and r["energy"] in ("higher", "very_high") for r in recent):
        return (
            "Energy higher than usual three days in a row. "
            "You may want to compare this with your wellness plan."
        )
    return None


def mood_low(rows: list[Checkin], today: date) -> str | None:
    recent = [r for r in _last_n_days(rows, today, 7) if r]
    if sum(r["mood"] in ("low", "slightly_low") for r in recent) >= 5:
        return (
            "Your mood has been low or a bit low on most days this week. "
            "Worth reviewing, and a good time to look at what helps."
        )
    return None


RULES: dict[str, Rule] = {
    "short_sleep_streak": short_sleep_streak,
    "racing_thoughts": racing_thoughts,
    "energy_up": energy_up,
    "mood_low": mood_low,
}


def evaluate(rows: list[Checkin], today: date) -> list[tuple[str, str]]:
    out = []
    for rule_id, rule in RULES.items():
        msg = rule(rows, today)
        if msg:
            out.append((rule_id, msg))
    return out
