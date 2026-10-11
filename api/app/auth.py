"""Single-account login. The username and password come from .env (APP_USERNAME / APP_PASSWORD).

Login returns a signed, expiring token (HMAC-SHA256, no server-side session store). The browser
sends it as `Authorization: Bearer <token>`, or as `?token=` on the live WebSocket.
If APP_PASSWORD is empty, auth is off (local development).
"""

import base64
import hashlib
import hmac
import logging
import secrets
import time

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings

log = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)

# Without SESSION_SECRET a random one is used, so logins don't survive an API restart.
_fallback_secret = secrets.token_bytes(32)


def enabled() -> bool:
    return bool(get_settings().app_password)


def _secret() -> bytes:
    s = get_settings().session_secret
    return s.encode() if s else _fallback_secret


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def check_password(username: str, password: str) -> bool:
    s = get_settings()
    # Compare both in constant time, and always both, so timing doesn't reveal which was wrong.
    user_ok = hmac.compare_digest(username.encode(), s.app_username.encode())
    pass_ok = hmac.compare_digest(password.encode(), s.app_password.encode())
    return user_ok and pass_ok


def issue_token(username: str) -> tuple[str, int]:
    expires = int(time.time()) + get_settings().session_days * 86400
    payload = _b64(f"{username}:{expires}".encode())
    sig = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}", expires


def verify_token(token: str | None) -> str | None:
    """The username if the token is genuine and not expired, else None."""
    if not token or "." not in token:
        return None
    payload, sig = token.rsplit(".", 1)
    good = _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, good):
        return None
    try:
        username, expires = _unb64(payload).decode().rsplit(":", 1)
        if int(expires) < time.time():
            return None
    except (ValueError, UnicodeDecodeError):
        return None
    return username


async def require_user(request: Request, creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if not enabled():
        return "local"
    user = verify_token(creds.credentials if creds else None)
    if not user:
        raise HTTPException(401, "Please log in", headers={"WWW-Authenticate": "Bearer"})
    return user
