from collections import Counter

from fastapi import APIRouter

from ..db import pool
from ..live import hub
from ..config import get_settings
from ..summary import gemini_summary, template_summary

router = APIRouter(prefix="/api", tags=["insights"])

MOOD_LABELS = {
    "low": "Low", "slightly_low": "A bit low", "steady": "Steady",
    "lifted": "Lifted", "very_high": "Very high",
}


@router.get("/status")
async def status():
    async with pool.connection() as conn:
        cur = await conn.execute(
            """SELECT (SELECT max(created_at) FROM checkins) AS last_checkin,
                      (SELECT max(started_at) FROM sessions WHERE started_at::date = current_date)
                        AS last_session_today,
                      EXISTS (SELECT 1 FROM checkins WHERE is_sample) AS has_sample"""
        )
        row = await cur.fetchone()
    return {
        **row,
        "sidecar_connected": hub.sidecar_connected,
        "active_session": hub.active_session,
        "gemini_enabled": bool(get_settings().gemini_api_key),
    }


@router.get("/timeline")
async def timeline(days: int = 14):
    """Two separate lanes: what you reported, and what the camera measured. Never merged."""
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT * FROM checkins WHERE day > current_date - %s::int ORDER BY day", (days,)
        )
        reported = await cur.fetchall()
        cur = await conn.execute(
            """SELECT date_trunc('day', ts)::date AS day,
                      percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS avg_heart_rate,
                      percentile_cont(0.5) WITHIN GROUP (ORDER BY breathing_rate) AS avg_breathing_rate,
                      count(heart_rate) AS good_readings,
                      count(*) AS total_readings,
                      bool_or(is_sample) AS is_sample
               FROM readings WHERE ts > now() - make_interval(days => %s)
               GROUP BY 1 ORDER BY 1""",
            (days,),
        )
        measured = await cur.fetchall()
    return {"reported": reported, "measured": measured}


@router.get("/summary")
async def summary():
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM checkins WHERE day > current_date - 7")
        rows = await cur.fetchall()
        cur = await conn.execute(
            "SELECT count(*) AS n FROM sessions WHERE started_at > now() - interval '7 days'"
        )
        n_sessions = (await cur.fetchone())["n"]
    sleeps = [r["sleep_hours"] for r in rows if r["sleep_hours"] is not None]
    moods = Counter(r["mood"] for r in rows)
    facts = {
        "checkins": len(rows),
        "avg_sleep": sum(sleeps) / len(sleeps) if sleeps else None,
        "racing_days": sum(r["racing_thoughts"] for r in rows),
        "common_mood": MOOD_LABELS.get(moods.most_common(1)[0][0]) if moods else None,
        "camera_sessions": n_sessions,
    }
    worded = await gemini_summary(facts)
    return {"facts": facts, "text": worded or template_summary(facts), "source": "gemini" if worded else "template"}
