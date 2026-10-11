from uuid import UUID

from fastapi import APIRouter, HTTPException

from .. import alerts, heart
from ..db import pool
from ..live import hub

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

STATS_SQL = """
SELECT s.*,
       -- Median ("typical") rather than mean, so a stray reading can't skew the summary.
       percentile_cont(0.5) WITHIN GROUP (ORDER BY r.heart_rate)     AS avg_heart_rate,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY r.breathing_rate) AS avg_breathing_rate,
       count(r.heart_rate)   AS good_readings,
       count(r.ts)           AS total_readings
FROM sessions s LEFT JOIN readings r ON r.session_id = s.id
"""


@router.get("")
async def list_sessions(days: int = 30):
    async with pool.connection() as conn:
        cur = await conn.execute(
            STATS_SQL + " WHERE s.started_at > now() - make_interval(days => %s) "
            "GROUP BY s.id ORDER BY s.started_at DESC",
            (days,),
        )
        return await cur.fetchall()


@router.post("/start")
async def start_session():
    if hub.active_session:
        raise HTTPException(409, "A session is already running")
    if not hub.sidecar_connected:
        raise HTTPException(503, "Camera service is not running. Start the sidecar first.")
    async with pool.connection() as conn:
        cur = await conn.execute("INSERT INTO sessions DEFAULT VALUES RETURNING *")
        session = await cur.fetchone()
    hub.active_session = session["id"]
    await hub.send_sidecar({"type": "start", "session_id": str(session["id"])})
    await hub.broadcast({"type": "session", "state": "started", "session": session})
    return session


@router.post("/stop")
async def stop_session():
    sid = hub.active_session
    if not sid:
        raise HTTPException(409, "No session is running")
    hub.active_session = None
    await hub.send_sidecar({"type": "stop"})
    async with pool.connection() as conn:
        await conn.execute("UPDATE sessions SET ended_at = now() WHERE id = %s", (sid,))
        cur = await conn.execute(STATS_SQL + " WHERE s.id = %s GROUP BY s.id", (sid,))
        session = await cur.fetchone()
        cur = await conn.execute(
            """SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS hr
               FROM readings WHERE session_id <> %s AND ts > now() - interval '60 days'
               GROUP BY session_id HAVING count(heart_rate) >= 5""",
            (sid,),
        )
        past = [r["hr"] for r in await cur.fetchall()]
    # Too few good readings and the typical value isn't worth acting on.
    typical = session["avg_heart_rate"] if session["good_readings"] >= 5 else None
    session["heart_check"] = heart.check(typical, past)
    async with pool.connection() as conn:
        alert = await alerts.check_sessions(conn)
    session["alert"] = alert
    await hub.broadcast({"type": "session", "state": "stopped", "session": session})
    return session


@router.get("/{session_id}")
async def get_session(session_id: UUID):
    async with pool.connection() as conn:
        cur = await conn.execute(STATS_SQL + " WHERE s.id = %s GROUP BY s.id", (session_id,))
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Session not found")
    return row
