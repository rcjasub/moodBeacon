import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import close_db, init_db
from .routes import checkins, data, insights, live, notes, prompts, sessions

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
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

for r in (checkins, prompts, sessions, insights, data, live, notes):
    app.include_router(r.router)


@app.get("/health")
async def health():
    return {"ok": True}
