from datetime import date, timedelta

from fastapi import APIRouter

from .. import alerts, rules
from ..db import pool
from ..models import CheckinIn

router = APIRouter(prefix="/api/checkins", tags=["checkins"])

FIELDS = (
    "mood", "energy", "sleep_hours", "less_sleep_need", "irritable",
    "racing_thoughts", "unusual_activity", "off_baseline",
)


@router.get("")
async def list_checkins(days: int = 30):
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT * FROM checkins WHERE day > current_date - %s::int ORDER BY day DESC", (days,)
        )
        return await cur.fetchall()


@router.get("/latest")
async def latest_checkin():
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM checkins ORDER BY day DESC LIMIT 1")
        return await cur.fetchone()


@router.put("")
async def upsert_checkin(body: CheckinIn):
    """One check-in per day; saving again the same day replaces it."""
    day = body.day or date.today()
    values = [getattr(body, f) for f in FIELDS]
    cols = ", ".join(FIELDS)
    placeholders = ", ".join(["%s"] * len(FIELDS))
    updates = ", ".join(f"{f} = EXCLUDED.{f}" for f in FIELDS)
    async with pool.connection() as conn:
        cur = await conn.execute(
            f"""INSERT INTO checkins (day, {cols}) VALUES (%s, {placeholders})
                ON CONFLICT (day) DO UPDATE SET {updates}, created_at = now(), is_sample = FALSE
                RETURNING *""",
            [day, *values],
        )
        saved = await cur.fetchone()
        new_prompts = await run_rules(conn, day)
    return {"checkin": saved, "prompts": new_prompts}


async def run_rules(conn, today: date) -> list[dict]:
    cur = await conn.execute(
        "SELECT * FROM checkins WHERE day BETWEEN %s AND %s",
        (today - timedelta(days=28), today),
    )
    rows = await cur.fetchall()
    created = []
    for rule_id, message in rules.evaluate(rows, today):
        prompt = await alerts.insert_prompt_once(conn, rule_id, message)
        if prompt:
            created.append(prompt)
    return created
