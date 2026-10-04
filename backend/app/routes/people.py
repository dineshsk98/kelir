"""People API (prd.md > Regular recipients): the sender's people, soonest birthday first."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentSender
from app.clock import Now
from app.db import get_session
from app.engine.schedule import next_delivery
from app.models import Person
from app.schemas import PersonOut, PersonUpdate

router = APIRouter(prefix="/v1/people")
Session = Annotated[AsyncSession, Depends(get_session)]


def _out(person: Person, now) -> PersonOut:
    at = next_delivery(person.birth_month, person.birth_day, person.feb29_pref, person.tz, now)
    return PersonOut.from_model(person, at)


async def _own_person(session: AsyncSession, sender_id: uuid.UUID, person_id: uuid.UUID) -> Person:
    person = await session.get(Person, person_id)
    if person is None or person.sender_id != sender_id:
        # Same answer for "not yours" and "doesn't exist", so ids can't be probed
        raise HTTPException(404, detail={"code": "PERSON_NOT_FOUND"})
    return person


@router.get("")
async def list_people(sender: CurrentSender, session: Session, now: Now) -> list[PersonOut]:
    people = await session.scalars(select(Person).where(Person.sender_id == sender.id))
    # Each by their own midnight, so "soonest" is right across time zones; ties by name
    return sorted((_out(p, now) for p in people), key=lambda p: (p.next_delivery, p.name.casefold()))


@router.patch("/{person_id}")
async def update_person(
    person_id: uuid.UUID, body: PersonUpdate, sender: CurrentSender, session: Session, now: Now
) -> PersonOut:
    """Change a person's name, birthday or city. Capsules already made keep their own copy."""
    person = await _own_person(session, sender.id, person_id)
    for name, value in body.model_dump().items():
        setattr(person, name, value)
    person.updated_at = now
    await session.commit()
    return _out(person, now)


@router.delete("/{person_id}", status_code=204)
async def remove_person(person_id: uuid.UUID, sender: CurrentSender, session: Session) -> Response:
    """Forget a person. Their capsules stay (they're only unlinked); sending to them again
    saves them again."""
    await session.delete(await _own_person(session, sender.id, person_id))
    await session.commit()
    return Response(status_code=204)
