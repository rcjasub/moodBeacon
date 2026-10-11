import asyncio
import json
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, HTTPException

from .. import screening
from ..config import get_settings
from ..db import pool
from ..models import ScreeningIn, ShareEmailIn

router = APIRouter(prefix="/api/screenings", tags=["screenings"])

SUBJECT = "A BipolarBird check-in I wanted to share"


@router.get("/form")
async def get_form():
    return {**screening.form(), "email_enabled": get_settings().email_enabled}


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


@router.post("/{screening_id}/email")
async def email_screening(screening_id: int, body: ShareEmailIn):
    settings = get_settings()
    if not settings.email_enabled:
        raise HTTPException(503, "Email sending is not set up. Use your own email app instead.")
    row = _with_text(await _fetch(screening_id))
    msg = EmailMessage()
    msg["Subject"] = SUBJECT
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = body.to
    msg.set_content((body.note.strip() + "\n\n" if body.note.strip() else "") + row["text"])
    try:
        await asyncio.to_thread(_send, msg)
    except (smtplib.SMTPException, OSError) as e:
        raise HTTPException(502, f"Could not send the email: {e}") from e
    return {"sent": True}


def _send(msg: EmailMessage) -> None:
    s = get_settings()
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        if s.smtp_user:
            smtp.login(s.smtp_user, s.smtp_password)
        smtp.send_message(msg)


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
