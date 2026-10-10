import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..config import get_settings
from ..db import pool
from ..live import hub
from ..models import ReadingIn

log = logging.getLogger(__name__)
router = APIRouter(tags=["live"])


EMOTIONS = ("angry", "disgust", "fear", "happy", "sad", "surprise", "neutral")


def clean_emotion(msg: dict) -> dict:
    """Facial-expression scores (0-1 per FER2013 label) for the live radar. Display only, never stored."""
    scores = msg.get("scores")
    if not msg.get("face") or not isinstance(scores, dict):
        return {"type": "emotion", "face": False, "scores": None}
    num = lambda v: min(1.0, max(0.0, float(v))) if isinstance(v, (int, float)) else 0.0  # noqa: E731
    return {"type": "emotion", "face": True, "scores": {k: num(scores.get(k)) for k in EMOTIONS}}


@router.websocket("/ws/live")
async def browser_ws(ws: WebSocket):
    """Browser subscribes here for live readings and session state."""
    await ws.accept()
    hub.browsers.add(ws)
    await ws.send_text(json.dumps({
        "type": "status",
        "sidecar_connected": hub.sidecar_connected,
        "active_session": str(hub.active_session) if hub.active_session else None,
    }))
    try:
        while True:
            await ws.receive_text()  # keepalive; browser doesn't send commands here
    except WebSocketDisconnect:
        hub.browsers.discard(ws)


@router.websocket("/ws/sidecar")
async def sidecar_ws(ws: WebSocket, token: str = ""):
    """The Presage sidecar connects here and streams readings while a session is active."""
    if token != get_settings().sidecar_token:
        await ws.close(code=4401)
        return
    await ws.accept()
    hub.sidecar = ws
    await hub.broadcast({"type": "status", "sidecar_connected": True})
    if hub.active_session:
        await hub.send_sidecar({"type": "start", "session_id": str(hub.active_session)})
    min_q = get_settings().min_quality
    try:
        while True:
            msg = json.loads(await ws.receive_text())
            if not hub.active_session:
                continue
            # Live preview frames, waveforms and positioning tips go straight to the browser; never stored.
            if msg.get("type") == "frame" and isinstance(msg.get("jpeg"), str):
                await hub.broadcast({"type": "frame", "jpeg": msg["jpeg"]})
                continue
            if msg.get("type") == "trace":
                clean = lambda xs: [float(x) for x in (xs or [])[-200:] if isinstance(x, (int, float))]  # noqa: E731
                await hub.broadcast({
                    "type": "trace", "pulse": clean(msg.get("pulse")), "breathing": clean(msg.get("breathing")),
                })
                continue
            if msg.get("type") == "hint":
                await hub.broadcast({"type": "hint", "text": str(msg.get("text") or "")[:200]})
                continue
            if msg.get("type") == "emotion":
                await hub.broadcast(clean_emotion(msg))
                continue
            if msg.get("type") != "reading":
                continue
            try:
                r = ReadingIn.model_validate(msg)
            except ValidationError:
                continue
            ok = r.reliable if r.reliable is not None else r.quality >= min_q
            hr = r.heart_rate if ok else None
            br = r.breathing_rate if ok else None
            ts = datetime.now(timezone.utc)
            async with pool.connection() as conn:
                await conn.execute(
                    "INSERT INTO readings (ts, session_id, heart_rate, breathing_rate, quality) "
                    "VALUES (%s, %s, %s, %s, %s)",
                    (ts, hub.active_session, hr, br, r.quality),
                )
            await hub.broadcast({
                "type": "reading", "ts": ts.isoformat(), "heart_rate": hr,
                "breathing_rate": br, "quality": r.quality, "reliable": ok,
            })
    except (WebSocketDisconnect, json.JSONDecodeError) as e:
        log.info("sidecar disconnected: %s", e)
    finally:
        if hub.sidecar is ws:
            hub.sidecar = None
            await hub.broadcast({"type": "status", "sidecar_connected": False})
