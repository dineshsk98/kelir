"""Received (prd.md > Received): the capsules sent to the signed-in account's email, so a lost
link doesn't lose the capsule. The same opening, contents, reply and media as the link, found
by id and the email instead of the link's secret."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session
from app.models import Capsule, Sender
from app.routes.recipient import PRIVATE_HEADERS, capsule_out, media_response, opened, reply
from app.schemas import OpenedOut, ReceivedOut, RecipientCapsuleOut, ReplyIn, ReplyOut, UnreadOut

router = APIRouter(prefix="/v1/received")
Session = Annotated[AsyncSession, Depends(get_session)]

# Scheduled ones are still a surprise; cancelled ones were taken back
SHOWN = ("delivered", "opened")


def _mine(me: Sender):
    return Capsule.recipient_email == me.email, Capsule.status.in_(SHOWN)


@router.get("")
async def list_received(me: CurrentSender, session: Session, response: Response) -> list[ReceivedOut]:
    rows = await session.execute(
        select(Capsule, Sender)
        .join(Sender, Sender.id == Capsule.sender_id)
        .where(*_mine(me))
        .order_by(Capsule.delivered_at.desc(), Capsule.id)
    )
    response.headers.update(PRIVATE_HEADERS)
    return [
        ReceivedOut(
            id=c.id,
            sender_name=s.name,
            delivered_at=c.delivered_at,
            opened_at=c.opened_at,
            message_lang=c.message_lang,
            replied=c.reply is not None,
        )
        for c, s in rows
    ]


@router.get("/unread")
async def unread(me: CurrentSender, session: Session, response: Response) -> UnreadOut:
    """How many delivered capsules are waiting to be opened: the Received tab's counter."""
    count = await session.scalar(
        select(func.count())
        .select_from(Capsule)
        .where(Capsule.recipient_email == me.email, Capsule.status == "delivered")
    )
    response.headers.update(PRIVATE_HEADERS)
    return UnreadOut(unread=count or 0)


async def _find(session: AsyncSession, me: Sender, capsule_id: uuid.UUID) -> tuple[Capsule, Sender]:
    row = (
        await session.execute(
            select(Capsule, Sender)
            .join(Sender, Sender.id == Capsule.sender_id)
            .where(Capsule.id == capsule_id, *_mine(me))
        )
    ).first()
    if row is None:
        # Same answer for "not yours", "not delivered yet" and "doesn't exist": nothing to probe
        raise HTTPException(404, detail={"code": "CAPSULE_NOT_FOUND"}, headers=PRIVATE_HEADERS)
    return row[0], row[1]


@router.get("/{capsule_id}")
async def open_received(
    capsule_id: uuid.UUID, me: CurrentSender, session: Session, response: Response
) -> RecipientCapsuleOut:
    capsule, sender = await _find(session, me, capsule_id)
    response.headers.update(PRIVATE_HEADERS)
    return capsule_out(capsule, sender)


@router.post("/{capsule_id}/opened")
async def mark_received_opened(
    capsule_id: uuid.UUID, me: CurrentSender, session: Session, now: Now, response: Response
) -> OpenedOut:
    capsule, _ = await _find(session, me, capsule_id)
    response.headers.update(PRIVATE_HEADERS)
    return await opened(session, capsule, now)


@router.get("/{capsule_id}/media/{media_id}")
async def stream_received_media(
    capsule_id: uuid.UUID,
    media_id: uuid.UUID,
    me: CurrentSender,
    session: Session,
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    capsule, _ = await _find(session, me, capsule_id)
    return media_response(capsule, media_id, settings)


@router.post("/{capsule_id}/reply", status_code=201)
async def reply_received(
    capsule_id: uuid.UUID, body: ReplyIn, me: CurrentSender, session: Session, now: Now, response: Response
) -> ReplyOut:
    capsule, _ = await _find(session, me, capsule_id)
    response.headers.update(PRIVATE_HEADERS)
    return await reply(session, capsule, body, now)
