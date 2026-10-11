import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import auth

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


@router.get("/status")
async def status():
    return {"enabled": auth.enabled()}


@router.post("/login")
async def login(body: LoginIn):
    if not auth.enabled():
        return {"token": None, "expires": None, "username": "local"}
    if not auth.check_password(body.username, body.password):
        await asyncio.sleep(1)  # slow down password guessing
        raise HTTPException(401, "Wrong username or password")
    token, expires = auth.issue_token(body.username)
    return {"token": token, "expires": expires, "username": body.username}


@router.get("/me")
async def me(user: str = Depends(auth.require_user)):
    return {"username": user}
