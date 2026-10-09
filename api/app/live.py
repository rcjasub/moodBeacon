"""In-memory hub between the Presage sidecar and browser clients."""

import asyncio
import json
import uuid

from fastapi import WebSocket


class LiveHub:
    def __init__(self) -> None:
        self.sidecar: WebSocket | None = None
        self.browsers: set[WebSocket] = set()
        self.active_session: uuid.UUID | None = None
        self._lock = asyncio.Lock()

    @property
    def sidecar_connected(self) -> bool:
        return self.sidecar is not None

    async def send_sidecar(self, msg: dict) -> bool:
        if not self.sidecar:
            return False
        try:
            await self.sidecar.send_text(json.dumps(msg))
            return True
        except Exception:  # noqa: BLE001
            self.sidecar = None
            return False

    async def broadcast(self, msg: dict) -> None:
        data = json.dumps(msg, default=str)
        dead = []
        for ws in self.browsers:
            try:
                await ws.send_text(data)
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.browsers.discard(ws)


hub = LiveHub()
