import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import enabled as auth_enabled, require_user
from .config import get_settings
from .db import close_db, init_db
from .routes import auth, checkins, contacts, data, insights, live, notes, prompts, screenings, sessions

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not auth_enabled():
        logging.getLogger(__name__).warning("APP_PASSWORD is not set: login is OFF. Set it before deploying.")
    await init_db()
    yield
    await close_db()


app = FastAPI(title="BipolarBird API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Everything under /api needs a login. The WebSockets check their own tokens (routes/live.py).
for r in (checkins, contacts, prompts, sessions, insights, data, notes, screenings):
    app.include_router(r.router, dependencies=[Depends(require_user)])
app.include_router(auth.router)
app.include_router(live.router)


@app.get("/health")
async def health():
    return {"ok": True}
