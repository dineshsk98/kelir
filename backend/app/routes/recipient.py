"""The recipient's link (prd.md > The opening moment, Proving it's them). The link's secret
finds the capsule (looked up by its hash); opening it also takes being signed in as the
recipient's email (Google or an emailed code, routes/auth.py). So a forwarded or leaked link
shows nothing inside, and a gift code can't be taken from it."""

import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import MaybeSignedIn
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session
from app.links import hash_link_secret
from app.media import SERVE_HEADERS, media_file
from app.models import Capsule, Reply, Sender
from app.replies import REPLY_PRESETS
from app.schemas import AccessOut, MediaOut, OpenedOut, RecipientCapsuleOut, ReplyIn, ReplyOut, ReplyPreset

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


def _is_recipient(viewer: Sender | None, capsule: Capsule) -> bool:
    return viewer is not None and viewer.email == capsule.recipient_email.lower()


async def _find_for(session: AsyncSession, secret: str, viewer: Sender | None) -> tuple[Capsule, Sender]:
    """The capsule, only for its recipient: 401 if not signed in, 403 if signed in as someone
    else. Either way nothing inside is sent."""
    capsule, sender = await _find(session, secret)
    if not _is_recipient(viewer, capsule):
        if viewer is not None:
            raise HTTPException(403, detail={"code": "WRONG_ACCOUNT"}, headers=PRIVATE_HEADERS)
        raise HTTPException(401, detail={"code": "RECIPIENT_NOT_VERIFIED"}, headers=PRIVATE_HEADERS)
    return capsule, sender


def mask_email(email: str) -> str:
    """aiko@gmail.com → a•••@gmail.com: enough to know which account, not the address."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}•••@{domain}"


def _access(capsule: Capsule, sender: Sender, viewer: Sender | None) -> AccessOut:
    return AccessOut(
        sender_first_name=capsule.sender_name.split(" ")[0],
        recipient_hint=mask_email(capsule.recipient_email),
        message_lang=capsule.message_lang,
        allowed=_is_recipient(viewer, capsule),
        signed_in_as=viewer.email if viewer is not None else None,
    )


async def _mark_opened(session: AsyncSession, capsule: Capsule, now) -> None:
    """Reaching the open box (or replying) marks it Opened; the condition makes this happen
    once, so `opened_at` is the first time."""
    await session.execute(
        update(Capsule)
        .where(Capsule.id == capsule.id, Capsule.status == "delivered")
        .values(status="opened", opened_at=now)
    )


@router.get("/{secret}/access")
async def access(secret: str, session: Session, viewer: MaybeSignedIn, response: Response) -> AccessOut:
    """What the link may say before it's opened: who sent it and whose email opens it (masked),
    and whether the person looking has proved that email."""
    capsule, sender = await _find(session, secret)
    response.headers.update(PRIVATE_HEADERS)
    return _access(capsule, sender, viewer)


# --- What the recipient can do, shared by the link and Received (routes/received.py) ---


def capsule_out(capsule: Capsule, sender: Sender) -> RecipientCapsuleOut:
    return RecipientCapsuleOut(
        sender_name=capsule.sender_name,
        recipient_name=capsule.recipient_name,
        message_text=capsule.message_text,
        message_lang=capsule.message_lang,
        media=[MediaOut.model_validate(m) for m in capsule.media],
        gift_kind=capsule.gift_kind,
        gift_value=capsule.gift_value,
        gift_note=capsule.gift_note,
        reply=ReplyOut.from_model(capsule.reply),
        reply_presets=[ReplyPreset(key=k, texts=t) for k, t in REPLY_PRESETS.items()],
        opened_at=capsule.opened_at,
    )


async def opened(session: AsyncSession, capsule: Capsule, now) -> OpenedOut:
    await _mark_opened(session, capsule, now)
    await session.commit()
    return OpenedOut(opened_at=await session.scalar(select(Capsule.opened_at).where(Capsule.id == capsule.id)))


def media_response(capsule: Capsule, media_id: uuid.UUID, settings: Settings) -> FileResponse:
    item = next((m for m in capsule.media if m.id == media_id), None)
    if item is None:
        raise HTTPException(404, detail={"code": "MEDIA_NOT_FOUND"}, headers=PRIVATE_HEADERS)
    return FileResponse(
        media_file(item, settings.uploads_dir),
        media_type=item.mime,
        # Not kept in the browser's cache, so whoever uses this device next can't find it there
        headers=SERVE_HEADERS | PRIVATE_HEADERS,
    )


async def reply(session: AsyncSession, capsule: Capsule, body: ReplyIn, now) -> ReplyOut:
    """The recipient's thank-you: one per capsule (it also counts as opening it)."""
    already_replied = HTTPException(409, detail={"code": "REPLY_EXISTS"}, headers=PRIVATE_HEADERS)
    if capsule.reply is not None:
        raise already_replied
    row = Reply(
        capsule_id=capsule.id, preset_key=body.preset_key, text=body.text, lang=body.lang, created_at=now
    )
    try:
        session.add(row)
        # The INSERT is flushed by this next statement (autoflush), so it belongs inside the try
        await _mark_opened(session, capsule, now)
        await session.commit()
    except IntegrityError:  # a double-tap raced us: the unique capsule_id kept it to one
        await session.rollback()
        raise already_replied
    return ReplyOut.from_model(row)


# --- The link ----------------------------------------------------------------------


@router.get("/{secret}")
async def open_capsule(
    secret: str, session: Session, viewer: MaybeSignedIn, response: Response
) -> RecipientCapsuleOut:
    """What's inside, for the recipient. Loading it changes nothing: an interrupted first visit
    still gets the whole opening next time. `opened_at` tells the page whether to play it."""
    capsule, sender = await _find_for(session, secret, viewer)
    response.headers.update(PRIVATE_HEADERS)
    return capsule_out(capsule, sender)


@router.post("/{secret}/opened")
async def mark_opened(
    secret: str, session: Session, viewer: MaybeSignedIn, now: Now, response: Response
) -> OpenedOut:
    """She has reached the open box (or skipped to it): from now on the capsule shows its
    contents without the opening. Repeating it is harmless and keeps the first time."""
    capsule, _ = await _find_for(session, secret, viewer)
    response.headers.update(PRIVATE_HEADERS)
    return await opened(session, capsule, now)


@router.get("/{secret}/media/{media_id}")
async def stream_media(
    secret: str,
    media_id: uuid.UUID,
    session: Session,
    viewer: MaybeSignedIn,
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    """One of this capsule's photos/audio/video, for the recipient (range requests for seeking)."""
    capsule, _ = await _find_for(session, secret, viewer)
    return media_response(capsule, media_id, settings)


@router.post("/{secret}/reply", status_code=201)
async def send_reply(
    secret: str, body: ReplyIn, session: Session, viewer: MaybeSignedIn, now: Now, response: Response
) -> ReplyOut:
    capsule, _ = await _find_for(session, secret, viewer)
    response.headers.update(PRIVATE_HEADERS)
    return await reply(session, capsule, body, now)
