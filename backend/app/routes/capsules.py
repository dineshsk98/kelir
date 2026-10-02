"""Capsules API (prd.md > Creating a capsule)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session, get_sessionmaker
from app.delivery.mailer import Mailer, get_mailer
from app.delivery.scheduler import run_tick
from app.email_check import domain_accepts_mail, is_valid_format
from app.engine.schedule import due_now
from app.media import MAX_CAPSULE_BYTES, MB, media_file
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
    media = await _claim_uploads(session, sender.id, None, body.upload_ids)
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
    session: AsyncSession,
    sender_id: uuid.UUID,
    capsule_id: uuid.UUID | None,
    upload_ids: list[uuid.UUID],
) -> list[CapsuleMedia]:
    """The sender's own uploads, locked and in the requested order: unused ones, plus (when
    editing) ones already in this capsule."""
    if not upload_ids:
        return []
    usable = CapsuleMedia.capsule_id.is_(None)
    if capsule_id is not None:
        usable = or_(usable, CapsuleMedia.capsule_id == capsule_id)
    rows = (
        await session.scalars(
            select(CapsuleMedia)
            .where(CapsuleMedia.id.in_(upload_ids), CapsuleMedia.sender_id == sender_id, usable)
            .with_for_update()  # two saves racing for the same upload: only one gets it
        )
    ).all()
    by_id = {item.id: item for item in rows}
    if len(by_id) != len(upload_ids):
        raise _media_rejected("One of the files is missing or already used. Please add it again")
    if sum(item.size_bytes for item in rows) > MAX_CAPSULE_BYTES:
        raise _media_rejected(f"Together the files are over {MAX_CAPSULE_BYTES // MB} MB. Remove one")
    return [by_id[i] for i in upload_ids]


async def _own_capsule(
    session: AsyncSession, sender_id: uuid.UUID, capsule_id: uuid.UUID, *, lock: bool = False
) -> Capsule:
    capsule = await session.get(Capsule, capsule_id, with_for_update=lock, populate_existing=lock)
    if capsule is None or capsule.sender_id != sender_id:
        # Same answer for "not yours" and "doesn't exist", so ids can't be probed
        raise HTTPException(404, detail={"code": "CAPSULE_NOT_FOUND"})
    return capsule


def _not_editable(capsule: Capsule) -> HTTPException | None:
    if capsule.status == "opened":
        # "Just like how you cannot take back anything you say or do"
        return HTTPException(409, detail={"code": "CAPSULE_FINAL"})
    if capsule.status == "cancelled":
        return HTTPException(409, detail={"code": "CAPSULE_CANCELLED"})
    return None


@router.get("/capsules/{capsule_id}")
async def get_capsule(capsule_id: uuid.UUID, sender: CurrentSender, session: Session) -> CapsuleOut:
    return CapsuleOut.model_validate(await _own_capsule(session, sender.id, capsule_id))


# Once the email has gone out, who it's for and when it arrives are settled
DELIVERED_LOCKED_FIELDS = (
    "recipient_name", "recipient_email", "birth_month", "birth_day", "feb29_pref",
    "city_label", "tz", "send_mode",
)


@router.patch("/capsules/{capsule_id}")
async def update_capsule(
    capsule_id: uuid.UUID,
    body: CapsuleCreate,
    sender: CurrentSender,
    session: Session,
    now: Now,
    background: BackgroundTasks,
    settings: Annotated[Settings, Depends(get_settings)],
    mailer: Annotated[Mailer, Depends(get_mailer)],
    sessionmaker: Annotated[async_sessionmaker[AsyncSession], Depends(get_sessionmaker)],
) -> CapsuleOut:
    """Replace a capsule's details until it's opened. The row stays locked for the whole
    edit, so the delivery loop and a first open wait for it (and vice versa)."""
    capsule = await _own_capsule(session, sender.id, capsule_id, lock=True)
    if problem := _not_editable(capsule):
        raise problem
    fields = body.model_dump(exclude={"upload_ids"})

    if capsule.status == "delivered":
        changed = [f for f in DELIVERED_LOCKED_FIELDS if getattr(capsule, f) != fields[f]]
        if changed:
            raise HTTPException(409, detail={"code": "CAPSULE_DELIVERED", "fields": changed})
    elif fields["recipient_email"] != capsule.recipient_email:
        if await domain_accepts_mail(body.recipient_email) is False:
            raise UNDELIVERABLE_EMAIL

    wanted = await _claim_uploads(session, sender.id, capsule.id, body.upload_ids)
    current = list(capsule.media)
    removed = [m for m in current if m.id not in set(body.upload_ids)]
    removed_paths = [media_file(m, settings.uploads_dir) for m in removed]

    # Positions are unique per capsule, so detach everything first, then attach in the new order
    session.expire(capsule, ["media"])
    for item in current:
        item.capsule_id = item.position = None
    await session.flush()
    for item in removed:
        await session.delete(item)
    for position, item in enumerate(wanted):
        item.capsule_id, item.position = capsule.id, position

    for name, value in fields.items():
        setattr(capsule, name, value)
    if capsule.status == "scheduled":
        capsule.deliver_at = due_now(
            body.send_mode, body.birth_month, body.birth_day, body.feb29_pref, body.tz, now
        )
    await session.commit()

    for path in removed_paths:
        path.unlink(missing_ok=True)
    await session.refresh(capsule, ["media", "reply"])
    if capsule.status == "scheduled" and capsule.deliver_at <= now:
        background.add_task(run_tick, sessionmaker, mailer, settings, now)
    return CapsuleOut.model_validate(capsule)


@router.post("/capsules/{capsule_id}/cancel")
async def cancel_capsule(capsule_id: uuid.UUID, sender: CurrentSender, session: Session) -> CapsuleOut:
    """Take a capsule back until it's opened: no delivery, no more email retries, and its
    link says it's no longer available."""
    capsule = await _own_capsule(session, sender.id, capsule_id, lock=True)
    if capsule.status == "opened":
        raise HTTPException(409, detail={"code": "CAPSULE_FINAL"})
    if capsule.status != "cancelled":
        capsule.status = "cancelled"
        capsule.next_send_at = None
        await session.commit()
        await session.refresh(capsule, ["media", "reply"])
    return CapsuleOut.model_validate(capsule)
