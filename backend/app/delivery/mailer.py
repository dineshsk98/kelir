"""Sending email: real Gmail SMTP, or printing to the console (development and tests)."""

import logging
from email.message import EmailMessage
from typing import Protocol

import aiosmtplib

from app.config import Settings, get_settings

log = logging.getLogger(__name__)


class Mailer(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleMailer:
    """Prints each email instead of sending it, and keeps them for tests to inspect."""

    def __init__(self) -> None:
        self.sent: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.sent.append(message)
        body = message.get_body(("plain",))
        text = body.get_content() if body else ""
        print(
            "\n----- email (MAILER=console, not sent) -----\n"
            f"From: {message['From']}\nReply-To: {message['Reply-To']}\n"
            f"To: {message['To']}\nSubject: {message['Subject']}\n\n{text}"
            "--------------------------------------------\n",
            flush=True,
        )


class SmtpMailer:
    """Gmail SMTP with STARTTLS, logging in with the app's Gmail address and app password."""

    def __init__(self, user: str, app_password: str) -> None:
        if not user or not app_password:
            raise ValueError("MAILER=smtp needs SMTP_USER and SMTP_APP_PASSWORD in .env")
        self.user, self.app_password = user, app_password

    async def send(self, message: EmailMessage) -> None:
        await aiosmtplib.send(
            message,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=self.user,
            password=self.app_password,
            timeout=30,
        )


def make_mailer(settings: Settings) -> Mailer:
    if settings.mailer == "smtp":
        return SmtpMailer(settings.smtp_user, settings.smtp_app_password)
    return ConsoleMailer()


_mailer: Mailer | None = None


def get_mailer() -> Mailer:
    """The process-wide mailer (a FastAPI dependency; tests override it)."""
    global _mailer
    if _mailer is None:
        _mailer = make_mailer(get_settings())
    return _mailer
