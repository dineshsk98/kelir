"""Sign-in endpoints (prd.md > Sign-in and history)."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from google.auth.exceptions import TransportError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import auth
from app.auth import CurrentSender
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Sender
from app.schemas import GoogleSignIn, Me, PublicConfig

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1")


@router.get("/config")
async def public_config(settings: Annotated[Settings, Depends(get_settings)]) -> PublicConfig:
    """What the web app needs to render the Google button (the client ID isn't secret)."""
    return PublicConfig(google_client_id=settings.google_client_id)


@router.post("/auth/google")
async def sign_in_with_google(
    body: GoogleSignIn,
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Me:
    if not settings.google_client_id:
        raise HTTPException(503, detail={"code": "SIGN_IN_NOT_CONFIGURED"})
    try:
        claims = await auth.verify_google_credential_async(
            body.credential, settings.google_client_id
        )
    except TransportError:
        log.exception("Could not reach Google to verify sign-in")
        raise HTTPException(503, detail={"code": "GOOGLE_UNREACHABLE"})
    except ValueError as e:
        # The reason (expired, wrong audience, clock skew...) stays in the server log only
        log.warning("Rejected Google sign-in: %s", e)
        raise HTTPException(401, detail={"code": "INVALID_GOOGLE_CREDENTIAL"})

    sender = await session.scalar(select(Sender).where(Sender.google_sub == claims["sub"]))
    name = claims.get("name") or claims["email"].split("@")[0]
    if sender is None:
        sender = Sender(google_sub=claims["sub"], email=claims["email"], name=name)
        session.add(sender)
    else:
        sender.email, sender.name = claims["email"], name
    await session.commit()

    auth.set_session_cookie(response, sender.id, settings)
    return Me(id=sender.id, email=sender.email, name=sender.name)


@router.post("/auth/logout", status_code=204)
async def sign_out(response: Response) -> None:
    auth.clear_session_cookie(response)


@router.get("/me")
async def me(sender: CurrentSender) -> Me:
    return Me(id=sender.id, email=sender.email, name=sender.name)
