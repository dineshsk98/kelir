"""Capsules API (prd.md > Creating a capsule)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session, get_sessionmaker
from app.delivery.mailer import Mailer, get_mailer
from app.delivery.scheduler import run_tick
from app.email_check import domain_accepts_mail, is_valid_format
from app.engine.schedule import due_now
from app.media import MAX_CAPSULE_BYTES, MB
from app.models import Capsule, CapsuleMedia
from app.schemas import (
    CapsuleCreate,
    CapsuleOut,
    DeliveryPreviewIn,
    DeliveryPreviewOut,
    EmailCheckIn,
    EmailCheckOut,
)

router = APIRouter(prefix="/v1")
Session = Annotated[AsyncSession, Depends(get_session)]


UNDELIVERABLE_EMAIL = HTTPException(
    422,
    detail=[
        {
            "loc": ["body", "recipient_email"],
            "msg": "That email's domain can't receive mail. Check it for a typo",
            "type": "email_undeliverable",
        }
    ],
)


@router.post("/email-check")
async def email_check(body: EmailCheckIn, _: CurrentSender) -> EmailCheckOut:
    """Can this address plausibly receive a capsule? Format first, then the domain's DNS."""
    if not is_valid_format(body.email):
        return EmailCheckOut(valid_format=False, accepts_mail=False)
    return EmailCheckOut(valid_format=True, accepts_mail=await domain_accepts_mail(body.email))


@router.post("/delivery-preview")
async def delivery_preview(body: DeliveryPreviewIn, _: CurrentSender, now: Now) -> DeliveryPreviewOut:
    """When a capsule with these details would be delivered, without saving anything."""
    at = due_now(body.send_mode, body.birth_month, body.birth_day, body.feb29_pref, body.tz, now)
    return DeliveryPreviewOut(deliver_at=at)


@router.get("/capsules")
async def list_capsules(sender: CurrentSender, session: Session) -> list[CapsuleOut]:
    rows = await session.scalars(
        select(Capsule)
        .where(Capsule.sender_id == sender.id)
        .order_by(Capsule.created_at.desc(), Capsule.id)
    )
    return [CapsuleOut.model_validate(c) for c in rows]


@router.post("/capsules", status_code=201)
async def create_capsule(
    body: CapsuleCreate,
    sender: CurrentSender,
    session: Session,
    now: Now,
    background: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
    sessionmaker: Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)],
) -> CapsuleOut:
    if await domain_accepts_mail(body.recipient_email) is False:
        raise UNDELIVERABLE_EMAIL
    deliver_at = due_now(
        body.send_mode, body.birth_month, body.birth_day, body.feb29_pref, body.tz, now
    )
    media = await _claim_uploads(session, sender.id, body.upload_ids)
    capsule = Capsule(
        sender_id=sender.id,
        **body.model_dump(exclude={"upload_ids"}),
        deliver_at=deliver_at,
        status="scheduled",
        created_at=now,
        reply=None,  # a new capsule has no thank-you; setting it avoids a lazy load later
        media=[],
    )
    for position, item in enumerate(media):
        item.position = position
        capsule.media.append(item)
    session.add(capsule)
    await session.commit()
    if deliver_at <= now:
        # "Send now", or their birthday has already begun: don't wait for the next loop tick
        background.add_task(run_tick, sessionmaker, mailer, settings, now)
    return CapsuleOut.model_validate(capsule)


def _media_rejected(message: str) -> HTTPException:
    return HTTPException(
        422, detail=[{"loc": ["body", "upload_ids"], "msg": message, "type": "media_rejected"}]
    )


async def _claim_uploads(
    session: AsyncSession, sender_id: uuid.UUID, upload_ids: list[uuid.UUID]
) -> list[CapsuleMedia]:
    """The sender's own, not-yet-used uploads, locked and in the requested order."""
    if not upload_ids:
        return []
    rows = (
        await session.scalars(
            select(CapsuleMedia)
            .where(
                CapsuleMedia.id.in_(upload_ids),
                CapsuleMedia.sender_id == sender_id,
                CapsuleMedia.capsule_id.is_(None),
            )
            .with_for_update()  # two saves racing for the same upload: only one gets it
        )
    ).all()
    by_id = {item.id: item for item in rows}
    if len(by_id) != len(upload_ids):
        raise _media_rejected("One of the files is missing or already used. Please add it again")
    if sum(item.size_bytes for item in rows) > MAX_CAPSULE_BYTES:
        raise _media_rejected(f"Together the files are over {MAX_CAPSULE_BYTES // MB} MB. Remove one")
    return [by_id[i] for i in upload_ids]


@router.get("/capsules/{capsule_id}")
async def get_capsule(capsule_id: uuid.UUID, sender: CurrentSender, session: Session) -> CapsuleOut:
    capsule = await session.get(Capsule, capsule_id)
    if capsule is None or capsule.sender_id != sender.id:
        # Same answer for "not yours" and "doesn't exist", so ids can't be probed
        raise HTTPException(404, detail={"code": "CAPSULE_NOT_FOUND"})
    return CapsuleOut.model_validate(capsule)
