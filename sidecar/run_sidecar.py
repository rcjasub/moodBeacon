"""BipolarBird camera sidecar.

Connects to the API at /ws/sidecar, waits for a "start" command, then streams
heart-rate / breathing readings (with a quality score) until "stop".
Video is never written to disk; a small preview goes only to your own browser.

Sources:
  mock     fake readings for UI development (no camera, no key)
  presage  runs the SmartSpectra Node SDK (presage_node/stream.mjs): readings, a small
           live preview (forwarded to your browser, never stored) and positioning tips
"""

import asyncio
import json
import logging
import os
import random
import shlex
from collections.abc import AsyncIterator
from contextlib import aclosing
from pathlib import Path

import websockets
from dotenv import load_dotenv

# All keys live in one git-ignored file at the repo root: mbeacon/.env
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
logging.basicConfig(level=logging.INFO, format="%(asctime)s sidecar %(message)s")
log = logging.getLogger()

API_WS_URL = os.getenv("API_WS_URL", "ws://localhost:8000/ws/sidecar")
TOKEN = os.getenv("SIDECAR_TOKEN", "change-me")
SOURCE = os.getenv("SOURCE", "mock")
PRESAGE_API_KEY = os.getenv("PRESAGE_API_KEY", "")
PRESAGE_CMD = os.getenv("PRESAGE_CMD", "node presage_node/stream.mjs")
SIDECAR_DIR = Path(__file__).resolve().parent


async def mock_readings() -> AsyncIterator[dict]:
    """Fake readings (1/s) and waveforms (4/s) so the UI can be built without a camera."""
    import math

    hr, br, t = 68.0, 14.0, 0.0
    tick = 0
    while True:
        await asyncio.sleep(0.25)
        samples = [t + i * 0.025 for i in range(10)]
        t += 0.25
        yield {
            "type": "trace",
            "pulse": [round(math.sin(2 * math.pi * hr / 60 * x) ** 9, 3) for x in samples],
            "breathing": [round(math.sin(2 * math.pi * br / 60 * x), 3) for x in samples],
        }
        tick += 1
        if tick % 4 == 0:
            hr += random.gauss(0, 0.8)
            br += random.gauss(0, 0.3)
            yield {"type": "reading", "heart_rate": round(hr, 1), "breathing_rate": round(br, 1),
                   "quality": round(random.uniform(0.35, 1.0), 2)}


MESSAGE_TYPES = {"reading", "frame", "hint", "trace"}


def parse_presage_line(line: str) -> dict | None:
    """Parse one JSON line from presage_node/stream.mjs (reading, frame or hint)."""
    try:
        d = json.loads(line)
    except json.JSONDecodeError:
        return None  # SDK log noise
    if not isinstance(d, dict) or d.get("type") not in MESSAGE_TYPES:
        return None
    if d["type"] == "reading":
        d["quality"] = float(d.get("quality") or 0)
    return d


async def presage_readings() -> AsyncIterator[dict]:
    if not PRESAGE_API_KEY:
        raise RuntimeError("PRESAGE_API_KEY is not set (root .env)")
    if not PRESAGE_CMD:
        raise RuntimeError("PRESAGE_CMD is not set (root .env)")
    cmd = shlex.split(PRESAGE_CMD.replace("{PRESAGE_API_KEY}", PRESAGE_API_KEY))
    # Runs from sidecar/ and inherits PRESAGE_API_KEY via the environment (not argv).
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, cwd=SIDECAR_DIR, env=os.environ.copy(),
        limit=4 * 1024 * 1024,  # preview frames are long base64 lines
    )
    try:
        assert proc.stdout
        async for raw in proc.stdout:
            msg = parse_presage_line(raw.decode(errors="ignore").strip())
            if msg:
                yield msg
    finally:
        if proc.returncode is None:
            proc.terminate()
            await proc.wait()


SOURCES = {"mock": mock_readings, "presage": presage_readings}


async def stream(ws) -> None:
    # aclosing() makes cancellation run the source's cleanup right away, so the camera is released.
    async with aclosing(SOURCES[SOURCE]()) as messages:
        async for msg in messages:
            await ws.send(json.dumps(msg))


async def run() -> None:
    if SOURCE not in SOURCES:
        raise SystemExit(f"SOURCE={SOURCE!r} in .env is not valid; use one of: {', '.join(SOURCES)}")
    url = f"{API_WS_URL}?token={TOKEN}"
    while True:
        try:
            async with websockets.connect(url) as ws:
                log.info("connected to %s (source=%s)", API_WS_URL, SOURCE)
                task: asyncio.Task | None = None
                async for raw in ws:
                    msg = json.loads(raw)
                    if msg["type"] == "start" and not task:
                        log.info("session %s started, camera on", msg.get("session_id"))
                        task = asyncio.create_task(stream(ws))
                    elif msg["type"] == "stop" and task:
                        task.cancel()
                        task = None
                        log.info("session stopped, camera off")
        except (OSError, websockets.ConnectionClosed) as e:
            log.info("API not reachable (%s), retrying in 3s", e)
            await asyncio.sleep(3)


if __name__ == "__main__":
    asyncio.run(run())
