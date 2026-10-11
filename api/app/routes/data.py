from fastapi import APIRouter

from ..db import pool
from ..models import WellnessPlanIn

router = APIRouter(prefix="/api", tags=["data"])


@router.get("/plan")
async def get_plan():
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM wellness_plan WHERE id = 1")
        return await cur.fetchone() or WellnessPlanIn().model_dump()


@router.put("/plan")
async def save_plan(body: WellnessPlanIn):
    async with pool.connection() as conn:
        cur = await conn.execute(
            """INSERT INTO wellness_plan (id, early_signs, what_helps, clinician_name, clinician_contact)
               VALUES (1, %(early_signs)s, %(what_helps)s, %(clinician_name)s, %(clinician_contact)s)
               ON CONFLICT (id) DO UPDATE SET
                 early_signs = EXCLUDED.early_signs, what_helps = EXCLUDED.what_helps,
                 clinician_name = EXCLUDED.clinician_name,
                 clinician_contact = EXCLUDED.clinician_contact, updated_at = now()
               RETURNING *""",
            body.model_dump(),
        )
        return await cur.fetchone()


@router.get("/data/export")
async def export_data():
    async with pool.connection() as conn:
        out = {}
        for table in ("checkins", "sessions", "readings", "prompts", "wellness_plan", "release_notes", "screenings", "contacts"):
            cur = await conn.execute(f"SELECT * FROM {table}")
            out[table] = await cur.fetchall()
    return out


@router.delete("/data")
async def delete_all():
    """Delete all my data: check-ins, sessions, readings, prompts, screenings, contacts, the wellness plan and notes."""
    async with pool.connection() as conn:
        await conn.execute("TRUNCATE contacts, screenings, readings, sessions, checkins, prompts, wellness_plan, release_notes")
    return {"deleted": True}


@router.delete("/data/sample")
async def delete_sample():
    async with pool.connection() as conn:
        await conn.execute("DELETE FROM screenings WHERE is_sample")
        await conn.execute("DELETE FROM readings WHERE is_sample")
        await conn.execute("DELETE FROM sessions WHERE is_sample")
        await conn.execute("DELETE FROM checkins WHERE is_sample")
        await conn.execute("DELETE FROM prompts WHERE is_sample")
    return {"deleted": True}
