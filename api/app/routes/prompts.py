from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from ..db import pool
from ..models import PromptAction

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("/active")
async def active_prompts():
    async with pool.connection() as conn:
        cur = await conn.execute(
            """SELECT * FROM prompts
               WHERE status = 'open' OR (status = 'snoozed' AND snooze_until <= current_date)
               ORDER BY created_at DESC"""
        )
        return await cur.fetchall()


@router.post("/{prompt_id}")
async def act_on_prompt(prompt_id: int, body: PromptAction):
    status = {"review": "reviewed", "snooze": "snoozed", "dismiss": "dismissed"}[body.action]
    snooze = date.today() + timedelta(days=1) if body.action == "snooze" else None
    async with pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE prompts SET status = %s, snooze_until = %s WHERE id = %s RETURNING *",
            (status, snooze, prompt_id),
        )
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Prompt not found")
    return row
