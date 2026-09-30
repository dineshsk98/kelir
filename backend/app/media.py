"""Uploaded photos, audio and video: identify the real file type from its first bytes,
enforce size limits while streaming to disk, and serve files back safely.

The browser's claimed Content-Type is only a hint (audio vs video for containers that
hold both); the file's own bytes decide what it is. Only these image/audio/video
formats are ever stored, so nothing uploaded can be served back as HTML or script.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import CapsuleMedia

MB = 1024 * 1024
MAX_BYTES = {"image": 15 * MB, "audio": 50 * MB, "video": 50 * MB}
MAX_ITEMS_PER_CAPSULE = 6
MAX_CAPSULE_BYTES = 150 * MB
MAX_UNATTACHED_PER_SENDER = 30  # uploads not yet in a capsule (stops disk filling up)
UNATTACHED_TTL = timedelta(hours=24)
CHUNK = 1024 * 1024


class MediaError(ValueError):
    """A file we won't store; the message is shown to the sender."""


@dataclass(frozen=True)
class Sniffed:
    kind: str  # image | audio | video
    mime: str


def _iso_brand(head: bytes) -> str | None:
    """The major brand of an ISO base media file (MP4, MOV, M4A, HEIC)."""
    return head[8:12].decode("latin-1") if head[4:8] == b"ftyp" else None


def sniff(head: bytes, claimed: str | None) -> Sniffed | None:
    """What the file really is, from its first bytes. `claimed` (the browser's
    Content-Type) only decides audio vs video for containers that can hold either."""
    claimed = (claimed or "").lower()
    wants_audio = claimed.startswith("audio/")

    if head.startswith(b"\xff\xd8\xff"):
        return Sniffed("image", "image/jpeg")
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return Sniffed("image", "image/png")
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return Sniffed("image", "image/gif")
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return Sniffed("image", "image/webp")
    if head[:4] == b"RIFF" and head[8:12] == b"WAVE":
        return Sniffed("audio", "audio/wav")
    if head[:4] == b"OggS":
        return Sniffed("audio", "audio/ogg")
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return Sniffed("audio", "audio/mpeg")
    if head[:4] == b"\x1a\x45\xdf\xa3":  # Matroska/WebM: MediaRecorder on Chrome/Firefox
        return Sniffed("audio", "audio/webm") if wants_audio else Sniffed("video", "video/webm")
    brand = _iso_brand(head)
    if brand:
        if brand in ("heic", "heix", "mif1", "msf1", "hevc", "heim", "heis"):
            return Sniffed("image", "image/heic")
        if brand == "qt  ":
            return Sniffed("video", "video/quicktime")
        if brand.startswith("M4A") or wants_audio:  # Safari records audio as MP4
            return Sniffed("audio", "audio/mp4")
        return Sniffed("video", "video/mp4")
    return None


async def save_upload(file: UploadFile, sender_id: uuid.UUID, uploads_dir: Path) -> tuple[uuid.UUID, Sniffed, int, Path]:
    """Stream an upload to disk, checking its type from the first bytes and its size as it
    arrives. Returns (id, type, size, path). Raises MediaError; never leaves a partial file."""
    head = await file.read(64)
    kind = sniff(head, file.content_type)
    if kind is None:
        raise MediaError("That file type isn't supported. Use a photo (JPEG, PNG, WebP, GIF), "
                         "audio (MP3, M4A, WAV, OGG, WebM) or video (MP4, MOV, WebM).")
    if kind.mime == "image/heic":
        # Only Safari can display HEIC; the recipient might open the capsule anywhere
        raise MediaError("HEIC photos can't be shown in every browser. Please choose a JPEG or PNG "
                         "(on iPhone: Settings → Camera → Formats → Most Compatible).")
    limit = MAX_BYTES[kind.kind]

    media_id = uuid.uuid4()
    folder = uploads_dir / str(sender_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / str(media_id)
    size = 0
    try:
        with path.open("wb") as out:
            chunk = head
            while chunk:
                size += len(chunk)
                if size > limit:
                    raise MediaError(f"That {kind.kind} is too large. The limit is {limit // MB} MB.")
                out.write(chunk)
                chunk = await file.read(CHUNK)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    if size == 0:
        path.unlink(missing_ok=True)
        raise MediaError("That file is empty.")
    return media_id, kind, size, path


SERVE_HEADERS = {
    # Never let a browser guess a different type, and never render a file as a page
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
}


async def remove_stale_uploads(session: AsyncSession, now: datetime, uploads_dir: Path) -> int:
    """Delete uploads that never joined a capsule within UNATTACHED_TTL (files and rows)."""
    stale = (
        await session.scalars(
            select(CapsuleMedia).where(
                CapsuleMedia.capsule_id.is_(None), CapsuleMedia.created_at < now - UNATTACHED_TTL
            )
        )
    ).all()
    for item in stale:
        _safe_path(item.path, uploads_dir).unlink(missing_ok=True)
        await session.delete(item)
    await session.commit()
    return len(stale)


def _safe_path(stored: str, uploads_dir: Path) -> Path:
    """Stored paths are always inside uploads_dir; refuse anything else."""
    path = Path(stored).resolve()
    if not path.is_relative_to(uploads_dir.resolve()):
        raise ValueError(f"media path outside uploads dir: {stored}")
    return path


def media_file(item: CapsuleMedia, uploads_dir: Path) -> Path:
    return _safe_path(item.path, uploads_dir)
