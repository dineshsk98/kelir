"""Google ID-token check, signed session cookie, and the current_sender dependency.

An account is one verified email. Google sign-in and an emailed one-time code
(`routes/auth.py`) both sign into it; either can send capsules and open the ones sent to it.
"""

import uuid
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from itsdangerous import BadData, URLSafeTimedSerializer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Sender

SESSION_COOKIE = "capsule_session"

_google_request = google_requests.Request()

# google-auth allows no clock difference by default, so a laptop clock a second or
# two behind Google's rejects fresh tokens as "used too early". Allow a little slack.
GOOGLE_CLOCK_SKEW_SECONDS = 10


def verify_google_credential(credential: str, client_id: str) -> dict:
    """Check a Google Identity Services ID token and return its claims.

    Raises ValueError if the token is invalid, expired, for another app, or
    the email isn't verified. Blocking (it may fetch Google's public keys), so
    call it from a thread.
    """
    claims = id_token.verify_oauth2_token(
        credential, _google_request, client_id, clock_skew_in_seconds=GOOGLE_CLOCK_SKEW_SECONDS
    )
    if not claims.get("email_verified"):
        raise ValueError("Google account email is not verified")
    return claims


async def verify_google_credential_async(credential: str, client_id: str) -> dict:
    return await run_in_threadpool(verify_google_credential, credential, client_id)


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="capsule-session")


def set_session_cookie(response: Response, sender_id: uuid.UUID, settings: Settings) -> None:
    """A browser-session cookie (no Max-Age: cleared when the browser closes). Browsers that
    restore cookies on reopen are covered by the server-side limit in _signed_in."""
    token = _serializer(settings).dumps({"sid": str(sender_id)})
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=settings.app_base_url.startswith("https://"),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


async def _signed_in(
    settings: Annotated[Settings, Depends(get_settings)],
    session: Annotated[AsyncSession, Depends(get_session)],
    capsule_session: Annotated[str | None, Cookie()] = None,
) -> Sender | None:
    """The signed-in account, or None (no cookie, tampered, too old, or account gone)."""
    if not capsule_session:
        return None
    try:
        # The signed token carries its sign-in time: older than session_hours means signed out
        data = _serializer(settings).loads(capsule_session, max_age=settings.session_hours * 3600)
        sender_id = uuid.UUID(data["sid"])
    except (BadData, KeyError, ValueError, TypeError):
        return None
    return await session.get(Sender, sender_id)


async def current_sender(sender: Annotated[Sender | None, Depends(_signed_in)]) -> Sender:
    if sender is None:
        raise HTTPException(401, detail={"code": "NOT_SIGNED_IN"})
    return sender


CurrentSender = Annotated[Sender, Depends(current_sender)]
# For pages anyone may reach, like a capsule link, that show more to the right account
MaybeSignedIn = Annotated[Sender | None, Depends(_signed_in)]
