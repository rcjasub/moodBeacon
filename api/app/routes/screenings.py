import json

from fastapi import APIRouter, HTTPException

from .. import gemini, mailer, screening, share_draft
from ..config import get_settings
from ..db import pool
from ..models import ScreeningIn, ShareDraftIn, ShareEmailIn

router = APIRouter(prefix="/api/screenings", tags=["screenings"])

SUBJECT = "A BipolarBird check-in I wanted to share"


@router.get("/form")
async def get_form():
    return {**screening.form(), "email_enabled": get_settings().email_enabled, "draft_enabled": gemini.enabled()}


@router.post("")
async def create_screening(body: ScreeningIn):
    score = sum(body.answers.values()) if body.answers is not None else None
    async with pool.connection() as conn:
        hr = usual = None
        if body.session_id:
            # Heart-rate numbers come from the stored session, not the browser.
            cur = await conn.execute(
                "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS hr "
                "FROM readings WHERE session_id = %s",
                (body.session_id,),
            )
            hr = (await cur.fetchone())["hr"]
            cur = await conn.execute(
                """SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY hr) AS usual FROM (
                     SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY heart_rate) AS hr
                     FROM readings WHERE session_id <> %s AND ts > now() - interval '60 days'
                     GROUP BY session_id HAVING count(heart_rate) >= 5) s""",
                (body.session_id,),
            )
            usual = (await cur.fetchone())["usual"]
        cur = await conn.execute(
            """INSERT INTO screenings
                 (session_id, heart_rate, usual_heart_rate, explained_by, answers, also_noticed, score)
               VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *""",
            (body.session_id, hr, usual, body.explained_by,
             json.dumps(body.answers) if body.answers is not None else None,
             body.also_noticed, score),
        )
        row = await cur.fetchone()
    return _with_text(row)


@router.get("/{screening_id}")
async def get_screening(screening_id: int):
    return _with_text(await _fetch(screening_id))


@router.post("/{screening_id}/draft")
async def draft_note(screening_id: int, body: ShareDraftIn):
    """A personal opening note for the share email, in a tone that fits who it's for."""
    return await share_draft.draft(await _fetch(screening_id), body.recipient)


@router.post("/{screening_id}/email")
async def email_screening(screening_id: int, body: ShareEmailIn):
    row = _with_text(await _fetch(screening_id))
    await mailer.send([body.to], SUBJECT, (body.note.strip() + "\n\n" if body.note.strip() else "") + row["text"])
    return {"sent": True}


async def _fetch(screening_id: int) -> dict:
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM screenings WHERE id = %s", (screening_id,))
        row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Screening not found")
    return row


def _with_text(row: dict) -> dict:
    return {**row, "outcome": screening.outcome(row["score"]), "subject": SUBJECT,
            "text": screening.summary_text(row)}
