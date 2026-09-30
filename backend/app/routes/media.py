"""Uploads (spec.md > Capsules API): a sender uploads photos, audio and video before
saving a capsule; each upload joins the capsule when it's created."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session
from app.media import (
    MAX_UNATTACHED_PER_SENDER,
    SERVE_HEADERS,
    MediaError,
    media_file,
    save_upload,
)
from app.models import CapsuleMedia
from app.schemas import MediaOut

router = APIRouter(prefix="/v1/uploads")
Session = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]

NOT_FOUND = HTTPException(404, detail={"code": "UPLOAD_NOT_FOUND"})


def _rejected(message: str) -> HTTPException:
    return HTTPException(422, detail=[{"loc": ["body", "file"], "msg": message, "type": "media_rejected"}])


@router.post("", status_code=201)
async def upload(file: UploadFile, sender: CurrentSender, session: Session, settings: AppSettings, now: Now) -> MediaOut:
    waiting = await session.scalar(
        select(func.count())
        .select_from(CapsuleMedia)
        .where(CapsuleMedia.sender_id == sender.id, CapsuleMedia.capsule_id.is_(None))
    )
    if waiting >= MAX_UNATTACHED_PER_SENDER:
        raise _rejected("Too many files waiting. Save or discard your current capsule first.")
    try:
        media_id, kind, size, path = await save_upload(file, sender.id, settings.uploads_dir)
    except MediaError as e:
        raise _rejected(str(e))
    item = CapsuleMedia(
        id=media_id, sender_id=sender.id, kind=kind.kind, mime=kind.mime,
        size_bytes=size, path=str(path), created_at=now,
    )
    session.add(item)
    await session.commit()
    return MediaOut.model_validate(item)


async def _own(session: AsyncSession, sender_id: uuid.UUID, media_id: uuid.UUID) -> CapsuleMedia:
    item = await session.get(CapsuleMedia, media_id)
    if item is None or item.sender_id != sender_id:
        raise NOT_FOUND  # same answer for "not yours" and "doesn't exist"
    return item


@router.get("/{media_id}")
async def stream_own(media_id: uuid.UUID, sender: CurrentSender, session: Session, settings: AppSettings) -> FileResponse:
    """The sender's own file, for Preview (range requests supported for seeking)."""
    item = await _own(session, sender.id, media_id)
    headers = SERVE_HEADERS | {"Cache-Control": "private, no-store"}
    return FileResponse(media_file(item, settings.uploads_dir), media_type=item.mime, headers=headers)


@router.delete("/{media_id}", status_code=204)
async def discard(media_id: uuid.UUID, sender: CurrentSender, session: Session, settings: AppSettings) -> None:
    """Remove a file the sender added but no longer wants (only before it joins a capsule)."""
    item = await _own(session, sender.id, media_id)
    if item.capsule_id is not None:
        raise HTTPException(409, detail={"code": "UPLOAD_IN_CAPSULE"})
    path = media_file(item, settings.uploads_dir)
    await session.delete(item)
    await session.commit()
    path.unlink(missing_ok=True)
