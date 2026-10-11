from fastapi import APIRouter, HTTPException

from ..db import pool
from ..models import ContactIn

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
async def list_contacts():
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT * FROM contacts ORDER BY relation, name")
        return await cur.fetchall()


@router.post("")
async def add_contact(body: ContactIn):
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO contacts (name, email, relation) VALUES (%s, %s, %s) RETURNING *",
            (body.name.strip(), body.email.strip(), body.relation),
        )
        return await cur.fetchone()


@router.delete("/{contact_id}")
async def remove_contact(contact_id: int):
    async with pool.connection() as conn:
        cur = await conn.execute("DELETE FROM contacts WHERE id = %s RETURNING id", (contact_id,))
        if not await cur.fetchone():
            raise HTTPException(404, "Contact not found")
    return {"deleted": True}
