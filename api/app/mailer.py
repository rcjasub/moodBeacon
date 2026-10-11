"""Send a plain-text email through the SMTP server in .env (optional feature)."""

import asyncio
import smtplib
from email.message import EmailMessage

from fastapi import HTTPException

from .config import get_settings


async def send(to: list[str], subject: str, body: str) -> None:
    s = get_settings()
    if not s.email_enabled:
        raise HTTPException(503, "Email sending is not set up. Use your own email app instead.")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s.smtp_from or s.smtp_user
    msg["To"] = ", ".join(to)
    msg.set_content(body)
    try:
        await asyncio.to_thread(_send, msg)
    except (smtplib.SMTPException, OSError) as e:
        raise HTTPException(502, f"Could not send the email: {e}") from e


def _send(msg: EmailMessage) -> None:
    s = get_settings()
    with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
        smtp.starttls()
        if s.smtp_user:
            smtp.login(s.smtp_user, s.smtp_password)
        smtp.send_message(msg)
