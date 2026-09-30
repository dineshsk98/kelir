"""The recipient's private link (prd.md > The opening moment). No account: the link's
secret is the only key, looked up by its hash."""

import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.clock import Now
from app.db import get_session
from app.links import hash_link_secret
from app.models import Capsule, Sender
from app.schemas import RecipientCapsuleOut

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


@router.get("/{secret}")
async def open_capsule(secret: str, session: Session, now: Now, response: Response) -> RecipientCapsuleOut:
    capsule, sender = await _find(session, secret)
    # First open marks it Opened; the condition makes this happen exactly once
    await session.execute(
        update(Capsule)
        .where(Capsule.id == capsule.id, Capsule.status == "delivered")
        .values(status="opened", opened_at=now)
    )
    await session.commit()
    response.headers.update(PRIVATE_HEADERS)
    return RecipientCapsuleOut(
        sender_name=sender.name,
        recipient_name=capsule.recipient_name,
        message_text=capsule.message_text,
        media_kind=capsule.media_kind,
        gift_kind=capsule.gift_kind,
        gift_value=capsule.gift_value,
        gift_note=capsule.gift_note,
    )
