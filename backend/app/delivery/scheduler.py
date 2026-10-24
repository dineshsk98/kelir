"""The delivery loop (spec.md > Delivery loop and mailer).

Every tick has two steps:

1. Deliver: due capsules move scheduled -> delivered. Rows are claimed with
   FOR UPDATE SKIP LOCKED and the status change is conditional, so a capsule is
   delivered exactly once even with two loops running.
2. Email: delivered capsules whose email hasn't gone out are claimed the same way.
   Each attempt gets a fresh link secret (only its hash is stored, so a failed
   link can't be resent) and a short lease, then the email is sent after commit.
   Success sets emailed_at; failure records send_error and backs off. If the
   process dies mid-send, the lease expires and the next tick retries.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.clock import utcnow
from app.config import Settings
from app.delivery.email_templates import birthday_email
from app.delivery.mailer import Mailer
from app.links import capsule_url, new_link_secret
from app.models import Capsule, Sender

log = logging.getLogger(__name__)

MAX_SEND_ATTEMPTS = 5
SEND_LEASE = timedelta(minutes=2)  # how long a claimed email is "in flight" before a retry may take it
BATCH = 50


def retry_delay(attempts: int) -> timedelta:
    """1, 2, 4, 8 minutes after the 1st..4th failure."""
    return timedelta(minutes=2 ** (attempts - 1))


@dataclass
class TickResult:
    delivered: int = 0
    emailed: int = 0
    failed: int = 0


@dataclass
class _Outgoing:
    capsule_id: object
    secret: str
    sender_name: str
    sender_email: str
    recipient_name: str
    recipient_email: str
    lang: str


async def _deliver_due(session: AsyncSession, now: datetime) -> int:
    rows = await session.scalars(
        select(Capsule)
        .where(Capsule.status == "scheduled", Capsule.deliver_at <= now)
        .order_by(Capsule.deliver_at)
        .limit(BATCH)
        .with_for_update(skip_locked=True)
    )
    count = 0
    for capsule in rows:
        capsule.status = "delivered"
        capsule.delivered_at = now
        capsule.next_send_at = now
        capsule.send_attempts = 0
        capsule.send_error = None
        count += 1
    return count


async def _claim_emails(session: AsyncSession, now: datetime) -> list[_Outgoing]:
    rows = await session.execute(
        select(Capsule, Sender)
        .join(Sender, Sender.id == Capsule.sender_id)
        .where(
            Capsule.status == "delivered",
            Capsule.emailed_at.is_(None),
            Capsule.send_attempts < MAX_SEND_ATTEMPTS,
            Capsule.next_send_at <= now,
        )
        .order_by(Capsule.next_send_at)
        .limit(BATCH)
        .with_for_update(of=Capsule, skip_locked=True)
    )
    outgoing = []
    for capsule, sender in rows:
        secret, secret_hash = new_link_secret()
        capsule.link_token_hash = secret_hash
        capsule.send_attempts += 1
        capsule.next_send_at = now + SEND_LEASE
        outgoing.append(
            _Outgoing(
                capsule.id, secret, capsule.sender_name, sender.email,
                capsule.recipient_name, capsule.recipient_email, capsule.message_lang,
            )
        )
    return outgoing


async def run_tick(
    sessionmaker: async_sessionmaker[AsyncSession],
    mailer: Mailer,
    settings: Settings,
    now: datetime | None = None,
) -> TickResult:
    now = now or utcnow()
    result = TickResult()

    async with sessionmaker() as session, session.begin():
        result.delivered = await _deliver_due(session, now)
    async with sessionmaker() as session, session.begin():
        outgoing = await _claim_emails(session, now)

    # Send after commit: a slow or failing mail server never holds database locks.
    for item in outgoing:
        message = birthday_email(
            sender_name=item.sender_name,
            sender_email=item.sender_email,
            recipient_name=item.recipient_name,
            recipient_email=item.recipient_email,
            link=capsule_url(settings.app_base_url, item.secret),
            app_name=settings.app_name,
            from_address=settings.smtp_user,
            lang=item.lang,
        )
        error: str | None = None
        try:
            await mailer.send(message)
        except Exception as e:  # any mail failure is recorded and retried, never crashes the loop
            error = f"{type(e).__name__}: {e}"[:500]
            log.warning("Email for capsule %s failed: %s", item.capsule_id, error)

        async with sessionmaker() as session, session.begin():
            capsule = await session.get(Capsule, item.capsule_id, with_for_update=True)
            if capsule is None:
                continue
            if error is None:
                capsule.emailed_at = now
                capsule.send_error = None
                capsule.next_send_at = None
                result.emailed += 1
            else:
                capsule.send_error = error
                capsule.next_send_at = now + retry_delay(capsule.send_attempts)
                result.failed += 1
    return result


async def delivery_loop(
    sessionmaker: async_sessionmaker[AsyncSession], mailer: Mailer, settings: Settings
) -> None:
    log.info("Delivery loop started (every %ss)", settings.scheduler_interval_seconds)
    while True:
        try:
            result = await run_tick(sessionmaker, mailer, settings)
            if result.delivered or result.emailed or result.failed:
                log.info("Delivery tick: %s", result)
        except Exception:
            log.exception("Delivery tick failed; retrying next tick")
        await asyncio.sleep(settings.scheduler_interval_seconds)
