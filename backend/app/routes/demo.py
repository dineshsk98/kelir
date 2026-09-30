"""Demo controls (prd.md > Delivery at the recipient's midnight, demo). Only when DEMO_MODE=true."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session, get_sessionmaker
from app.delivery.mailer import Mailer, get_mailer
from app.delivery.scheduler import run_tick
from app.models import Capsule
from app.schemas import CapsuleOut

router = APIRouter(prefix="/v1/demo")


@router.post("/capsules/{capsule_id}/simulate-midnight")
async def simulate_midnight(
    capsule_id: uuid.UUID,
    sender: CurrentSender,
    session: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
    sessionmaker: Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)],
    now: Now,
) -> CapsuleOut:
    """Pretend the recipient's midnight is now: deliver this capsule and send its email."""
    if not settings.demo_mode:
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    capsule = await session.get(Capsule, capsule_id)
    if capsule is None or capsule.sender_id != sender.id:
        raise HTTPException(404, detail={"code": "CAPSULE_NOT_FOUND"})
    if capsule.status != "scheduled":
        raise HTTPException(409, detail={"code": "CAPSULE_NOT_SCHEDULED"})
    capsule.deliver_at = now
    await session.commit()

    await run_tick(sessionmaker, mailer, settings, now)

    # The tick changed it in other sessions: reload its columns and its (empty) reply here,
    # inside async code, so building the response never triggers a lazy load
    await session.refresh(capsule)
    await session.refresh(capsule, ["reply", "media"])
    return CapsuleOut.model_validate(capsule)
