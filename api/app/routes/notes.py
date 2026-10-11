from fastapi import APIRouter, HTTPException

from ..db import pool
from ..models import ReleaseNoteIn

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("")
async def list_notes():
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM release_notes ORDER BY created_at DESC")
        return await cur.fetchall()


@router.post("")
async def add_note(body: ReleaseNoteIn):
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO release_notes (text) VALUES (%s) RETURNING *", (body.text.strip(),)
        )
        return await cur.fetchone()


@router.delete("/{note_id}")
async def release_note(note_id: int):
    """Crumpled away: deleted for good."""
    async with pool.connection() as conn:
        cur = await conn.execute("DELETE FROM release_notes WHERE id = %s RETURNING id", (note_id,))
        if not await cur.fetchone():
            raise HTTPException(404, "Note not found")
    return {"deleted": True}
