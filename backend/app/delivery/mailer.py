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
        shown = (
            "\n----- email (MAILER=console, not sent) -----\n"
            f"From: {message['From']}\nReply-To: {message['Reply-To']}\n"
            f"To: {message['To']}\nSubject: {message['Subject']}\n\n{text}"
            "--------------------------------------------\n"
        )
        try:
            print(shown, flush=True)
        except UnicodeEncodeError:
            # A console that can't show the script (Windows' cp1252 and Korean, say) must not
            # fail the "send": those characters are shown as escapes (the digits stay readable)
            print(shown.encode("ascii", "backslashreplace").decode("ascii"), flush=True)


class SmtpMailer:
    """SMTP with STARTTLS (Gmail by default), logging in with the app's address and app password."""

    def __init__(self, user: str, app_password: str, host: str = "smtp.gmail.com", port: int = 587) -> None:
        if not user or not app_password:
            raise ValueError("MAILER=smtp needs SMTP_USER and SMTP_APP_PASSWORD in .env")
        self.user, self.app_password = user, app_password
        self.host, self.port = host, port

    async def send(self, message: EmailMessage) -> None:
        await aiosmtplib.send(
            message,
            hostname=self.host,
            port=self.port,
            start_tls=True,
            username=self.user,
            password=self.app_password,
            timeout=30,
        )


def make_mailer(settings: Settings) -> Mailer:
    if settings.mailer == "smtp":
        return SmtpMailer(settings.smtp_user, settings.smtp_app_password, settings.smtp_host, settings.smtp_port)
    return ConsoleMailer()


_mailer: Mailer | None = None


def get_mailer() -> Mailer:
    """The process-wide mailer (a FastAPI dependency; tests override it)."""
    global _mailer
    if _mailer is None:
        _mailer = make_mailer(get_settings())
    return _mailer
