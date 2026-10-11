from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from .. import alerts, mailer

from ..db import pool
from ..models import NotifyIn, PromptAction

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


SHARE_SUBJECT = "Something from my BipolarBird check-ins"


async def _prompt(prompt_id: int) -> dict:
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM prompts WHERE id = %s", (prompt_id,))
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Prompt not found")
    return row


@router.get("/{prompt_id}/share")
async def share_prompt(prompt_id: int):
    """Subject and text for letting trusted people know (used for the email-app fallback too)."""
    return {"subject": SHARE_SUBJECT, "text": alerts.share_text(await _prompt(prompt_id))}


@router.post("/{prompt_id}/notify")
async def notify_contacts(prompt_id: int, body: NotifyIn):
    """Email the chosen contacts. Only ever called by an explicit tap; nothing is sent automatically."""
    prompt = await _prompt(prompt_id)
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT email FROM contacts WHERE id = ANY(%s)", (body.contact_ids,))
        emails = [r["email"] for r in await cur.fetchall()]
    if not emails:
        raise HTTPException(400, "Pick at least one person to notify")
    note = body.note.strip()
    await mailer.send(emails, SHARE_SUBJECT, (note + "\n\n" if note else "") + alerts.share_text(prompt))
    return {"sent": len(emails)}
