"""The recipient's private link (prd.md > The opening moment). No account: the link's
secret is the only key, looked up by its hash."""

import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session
from app.links import hash_link_secret
from app.media import SERVE_HEADERS, media_file
from app.models import Capsule, Reply, Sender
from app.replies import REPLY_PRESETS
from app.schemas import MediaOut, RecipientCapsuleOut, ReplyIn, ReplyOut, ReplyPreset

router = APIRouter(prefix="/v1/c")
Session = Annotated[AsyncSession, Depends(get_session)]

# token_urlsafe(32) gives 43 URL-safe characters; anything else can't be a real link
SECRET_RE = re.compile(r"^[A-Za-z0-9_-]{43}$")

PRIVATE_HEADERS = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
}


async def _find(session: AsyncSession, secret: str) -> tuple[Capsule, Sender]:
    not_found = HTTPException(404, detail={"code": "CAPSULE_NOT_FOUND"}, headers=PRIVATE_HEADERS)
    if not SECRET_RE.match(secret):
        raise not_found
    row = (
        await session.execute(
            select(Capsule, Sender)
            .join(Sender, Sender.id == Capsule.sender_id)
            .where(Capsule.link_token_hash == hash_link_secret(secret))
        )
    ).first()
    if row is None:
        raise not_found
    capsule, sender = row
    if capsule.status == "cancelled":
        raise HTTPException(410, detail={"code": "CAPSULE_CANCELLED"}, headers=PRIVATE_HEADERS)
    return capsule, sender


async def _mark_opened(session: AsyncSession, capsule: Capsule, now) -> None:
    """The first open (or a reply) marks it Opened; the condition makes this happen once."""
    await session.execute(
        update(Capsule)
        .where(Capsule.id == capsule.id, Capsule.status == "delivered")
        .values(status="opened", opened_at=now)
    )


@router.get("/{secret}")
async def open_capsule(secret: str, session: Session, now: Now, response: Response) -> RecipientCapsuleOut:
    capsule, sender = await _find(session, secret)
    await _mark_opened(session, capsule, now)
    await session.commit()
    response.headers.update(PRIVATE_HEADERS)
    return RecipientCapsuleOut(
        sender_name=sender.name,
        recipient_name=capsule.recipient_name,
        message_text=capsule.message_text,
        media=[MediaOut.model_validate(m) for m in capsule.media],
        gift_kind=capsule.gift_kind,
        gift_value=capsule.gift_value,
        gift_note=capsule.gift_note,
        reply=ReplyOut.from_model(capsule.reply),
        reply_presets=[ReplyPreset(key=k, text=t) for k, t in REPLY_PRESETS.items()],
    )


@router.get("/{secret}/media/{media_id}")
async def stream_media(
    secret: str, media_id: uuid.UUID, session: Session, settings: Annotated[Settings, Depends(get_settings)]
) -> FileResponse:
    """One of this capsule's photos/audio/video, for the recipient (range requests for seeking)."""
    capsule, _ = await _find(session, secret)
    item = next((m for m in capsule.media if m.id == media_id), None)
    if item is None:
        raise HTTPException(404, detail={"code": "MEDIA_NOT_FOUND"}, headers=PRIVATE_HEADERS)
    return FileResponse(
        media_file(item, settings.uploads_dir),
        media_type=item.mime,
        headers=SERVE_HEADERS | PRIVATE_HEADERS | {"Cache-Control": "private, max-age=3600"},
    )


@router.post("/{secret}/reply", status_code=201)
async def send_reply(
    secret: str, body: ReplyIn, session: Session, now: Now, response: Response
) -> ReplyOut:
    """The recipient's thank-you: one per capsule, no account needed."""
    capsule, _ = await _find(session, secret)
    already_replied = HTTPException(409, detail={"code": "REPLY_EXISTS"}, headers=PRIVATE_HEADERS)
    if capsule.reply is not None:
        raise already_replied
    reply = Reply(capsule_id=capsule.id, preset_key=body.preset_key, text=body.text, created_at=now)
    try:
        session.add(reply)
        # The INSERT is flushed by this next statement (autoflush), so it belongs inside the try
        await _mark_opened(session, capsule, now)
        await session.commit()
    except IntegrityError:  # a double-tap raced us: the unique capsule_id kept it to one
        await session.rollback()
        raise already_replied
    response.headers.update(PRIVATE_HEADERS)
    return ReplyOut.from_model(reply)
