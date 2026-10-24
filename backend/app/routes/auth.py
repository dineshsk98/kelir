"""Sign-in endpoints (prd.md > Sign-in and history): Google, or a one-time code emailed to you.

Both sign into the same account, one per verified email. A new email gets an account on its
first sign-in, so nothing here says whether an email already has one.
"""

import hmac
import logging
import re
import secrets
from datetime import timedelta
from hashlib import sha256
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from google.auth.exceptions import TransportError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import auth
from app.auth import CurrentSender
from app.clock import Now
from app.config import Settings, get_settings
from app.db import get_session
from app.delivery.email_templates import code_email
from app.delivery.mailer import Mailer, get_mailer
from app.email_check import domain_accepts_mail
from app.models import EmailCode, Sender
from app.schemas import (
    CodeSentOut,
    EmailCodeIn,
    EmailVerifyIn,
    GoogleSignIn,
    Me,
    MeUpdate,
    PublicConfig,
    SignedIn,
)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/v1")
Session = Annotated[AsyncSession, Depends(get_session)]
AppSettings = Annotated[Settings, Depends(get_settings)]


@router.get("/config")
async def public_config(settings: AppSettings) -> PublicConfig:
    """What the web app needs to render the Google button (the client ID isn't secret)."""
    return PublicConfig(google_client_id=settings.google_client_id, demo_mode=settings.demo_mode)


def _me(sender: Sender) -> Me:
    return Me(id=sender.id, email=sender.email, name=sender.name)


async def _account(session: AsyncSession, email: str, make) -> tuple[Sender, bool]:
    """The account for this email, made by `make()` if there is none, and whether it was just
    made. Two first sign-ins at once can't make two: the unique email keeps one, and the
    other finds it."""
    sender = await session.scalar(select(Sender).where(Sender.email == email))
    if sender is not None:
        return sender, False
    try:
        async with session.begin_nested():
            sender = make()
            session.add(sender)
        return sender, True
    except IntegrityError:
        return await session.scalar(select(Sender).where(Sender.email == email)), False


@router.post("/auth/google")
async def sign_in_with_google(
    body: GoogleSignIn, response: Response, settings: AppSettings, session: Session
) -> Me:
    if not settings.google_client_id:
        raise HTTPException(503, detail={"code": "SIGN_IN_NOT_CONFIGURED"})
    try:
        claims = await auth.verify_google_credential_async(
            body.credential, settings.google_client_id
        )
    except TransportError:
        log.exception("Could not reach Google to verify sign-in")
        raise HTTPException(503, detail={"code": "GOOGLE_UNREACHABLE"})
    except ValueError as e:
        # The reason (expired, wrong audience, clock skew...) stays in the server log only
        log.warning("Rejected Google sign-in: %s", e)
        raise HTTPException(401, detail={"code": "INVALID_GOOGLE_CREDENTIAL"})

    email = claims["email"].lower()
    name = claims.get("name") or email.split("@")[0]
    sender = await session.scalar(select(Sender).where(Sender.google_sub == claims["sub"]))
    if sender is None:
        # Google has verified this email: if it already has an account (made with a code),
        # this is the same person, so the account now signs in with Google too
        sender, _ = await _account(session, email, lambda: Sender(email=email, name=name))
        sender.google_sub = claims["sub"]
    elif sender.email != email:
        # The Google account's address changed: follow it, unless another account has it
        taken = await session.scalar(select(func.count()).select_from(Sender).where(Sender.email == email))
        if not taken:
            sender.email = email
    if not sender.name_edited:  # a name the owner chose in the app wins over Google's
        sender.name = name
    await session.commit()

    auth.set_session_cookie(response, sender.id, settings)
    return _me(sender)


# One-time codes: six digits, ten minutes, five tries. A new code replaces the last; at most
# one a minute and five an hour per email, so the app can't be used to flood an inbox.
CODE_TTL = timedelta(minutes=10)
CODE_TRIES = 5
CODE_RESEND = timedelta(minutes=1)
CODES_PER_HOUR = 5


def _code_hash(settings: Settings, email: str, code: str) -> str:
    # Keyed, so a copied database can't simply be checked against the million possible codes
    return hmac.new(settings.session_secret.encode(), f"{email}:{code}".encode(), sha256).hexdigest()


@router.post("/auth/email/code", status_code=201)
async def send_sign_in_code(
    body: EmailCodeIn,
    session: Session,
    now: Now,
    settings: AppSettings,
    mailer: Annotated[Mailer, Depends(get_mailer)],
) -> CodeSentOut:
    """Email a one-time sign-in code. The same answer whether or not the email has an account."""
    if await domain_accepts_mail(body.email) is False:
        raise HTTPException(
            422,
            detail=[{"loc": ["body", "email"], "msg": "That email's domain can't receive mail. Check it for a typo",
                     "type": "email_undeliverable"}],
        )
    # One request at a time per email (there may be no row to lock), so the limits can't be raced
    await session.execute(select(func.pg_advisory_xact_lock(func.hashtext(body.email))))
    recent = (
        await session.scalars(
            select(EmailCode.created_at)
            .where(EmailCode.email == body.email, EmailCode.created_at > now - timedelta(hours=1))
            .order_by(EmailCode.created_at.desc())
        )
    ).all()
    if recent and recent[0] > now - CODE_RESEND:
        wait = int((recent[0] + CODE_RESEND - now).total_seconds()) + 1
        raise HTTPException(429, detail={"code": "CODE_TOO_SOON", "retry_after": wait})
    if len(recent) >= CODES_PER_HOUR:
        raise HTTPException(429, detail={"code": "CODE_LIMIT"})

    code = f"{secrets.randbelow(10**6):06d}"
    row = EmailCode(
        email=body.email,
        code_hash=_code_hash(settings, body.email, code),
        expires_at=now + CODE_TTL,
        created_at=now,
    )
    session.add(row)
    await session.commit()
    try:
        await mailer.send(
            code_email(
                code=code, to=body.email, app_name=settings.app_name, from_address=settings.smtp_user, lang=body.lang
            )
        )
    except Exception:
        log.exception("Could not email a sign-in code")
        await session.delete(row)  # it never arrived: don't count it against the limits
        await session.commit()
        raise HTTPException(503, detail={"code": "CODE_NOT_SENT"})
    return CodeSentOut(sent_to=body.email, resend_after=int(CODE_RESEND.total_seconds()))


def _name_from(email: str) -> str:
    """A starting name for an account made by code: "aiko.tanaka@…" → "Aiko Tanaka"."""
    words = [w for w in re.split(r"[._+\-]+", email.split("@")[0]) if w]
    return " ".join(w.capitalize() for w in words) or email.split("@")[0]


@router.post("/auth/email/verify")
async def sign_in_with_code(
    body: EmailVerifyIn, response: Response, session: Session, now: Now, settings: AppSettings
) -> SignedIn:
    """Check the newest code for this email; the right one signs in (making the account the
    first time). Used once."""
    latest = await session.scalar(
        select(EmailCode)
        .where(EmailCode.email == body.email)
        .order_by(EmailCode.created_at.desc(), EmailCode.id)
        .limit(1)
        .with_for_update()
    )
    if (
        latest is None
        or latest.used_at is not None
        or latest.expires_at <= now
        or latest.attempts >= CODE_TRIES
    ):
        raise HTTPException(400, detail={"code": "CODE_EXPIRED"})
    if not hmac.compare_digest(latest.code_hash, _code_hash(settings, body.email, body.code)):
        latest.attempts += 1
        await session.commit()
        raise HTTPException(400, detail={"code": "CODE_WRONG", "tries_left": CODE_TRIES - latest.attempts})
    latest.used_at = now
    sender, created = await _account(
        session, body.email, lambda: Sender(email=body.email, name=_name_from(body.email))
    )
    await session.commit()

    auth.set_session_cookie(response, sender.id, settings)
    return SignedIn(**_me(sender).model_dump(), created=created)


@router.post("/auth/logout", status_code=204)
async def sign_out(response: Response) -> None:
    auth.clear_session_cookie(response)


@router.get("/me")
async def me(sender: CurrentSender) -> Me:
    return _me(sender)


@router.patch("/me")
async def update_me(body: MeUpdate, sender: CurrentSender, session: Session) -> Me:
    """Change your name: it's how recipients see you ("Sam has sent you a surprise…")."""
    sender.name = body.name
    sender.name_edited = True
    await session.commit()
    return _me(sender)
