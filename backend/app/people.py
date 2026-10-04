"""Saved people (prd.md > Regular recipients): every capsule saves or updates who it's for."""

import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Person
from app.schemas import CapsuleCreate


async def save_person(
    session: AsyncSession, sender_id: uuid.UUID, details: CapsuleCreate, now: datetime
) -> uuid.UUID:
    """Save the capsule's recipient as one of the sender's people, or update them if their
    email is already saved. One statement, so two capsules saved at once can't make two."""
    values = {
        "name": details.recipient_name,
        "birth_month": details.birth_month,
        "birth_day": details.birth_day,
        "feb29_pref": details.feb29_pref,
        "city_label": details.city_label,
        "tz": details.tz,
        "updated_at": now,
    }
    statement = (
        insert(Person)
        .values(id=uuid.uuid4(), sender_id=sender_id, email=details.recipient_email, created_at=now, **values)
        .on_conflict_do_update(constraint="uq_people_sender_email", set_=values)
        .returning(Person.id)
    )
    return await session.scalar(statement)
