"""Google ID-token check, signed session cookie, and the current_sender dependency."""

import uuid
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from itsdangerous import BadSignature, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Sender

SESSION_COOKIE = "capsule_session"

_google_request = google_requests.Request()


def verify_google_credential(credential: str, client_id: str) -> dict:
    """Check a Google Identity Services ID token and return its claims.

    Raises ValueError if the token is invalid, expired, for another app, or
    the email isn't verified. Blocking (it may fetch Google's public keys), so
    call it from a thread.
    """
    claims = id_token.verify_oauth2_token(credential, _google_request, client_id)
    if not claims.get("email_verified"):
        raise ValueError("Google account email is not verified")
    return claims


async def verify_google_credential_async(credential: str, client_id: str) -> dict:
    return await run_in_threadpool(verify_google_credential, credential, client_id)


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="capsule-session")


def set_session_cookie(response: Response, sender_id: uuid.UUID, settings: Settings) -> None:
    token = _serializer(settings).dumps({"sid": str(sender_id)})
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_days * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=settings.app_base_url.startswith("https://"),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


async def current_sender(
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_session)],
    capsule_session: Annotated[str | None, Cookie()] = None,
) -> Sender:
    not_signed_in = HTTPException(401, detail={"code": "NOT_SIGNED_IN"})
    if not capsule_session:
        raise not_signed_in
    try:
        data = _serializer(settings).loads(
            capsule_session, max_age=settings.session_days * 24 * 3600
        )
        sender_id = uuid.UUID(data["sid"])
    except (BadSignature, KeyError, ValueError, TypeError):
        raise not_signed_in
    sender = await session.get(Sender, sender_id)
    if sender is None:
        raise not_signed_in
    return sender


CurrentSender = Annotated[Sender, Depends(current_sender)]
