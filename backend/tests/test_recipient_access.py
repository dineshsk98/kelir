"""Proving it's the recipient (prd.md > Proving it's them): the link alone shows nothing
inside; being signed in as the recipient's email (Google or an emailed code) opens it."""

import re
from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.models import Capsule
from tests.test_auth import CLAIMS, fake_google
from tests.test_delivery import DUE, capsule_body, deliver, schedule
from tests.test_media import JPEG, upload


async def stranger_link(client, sign_in, freeze_now, sessionmaker, mailer, settings, **overrides):
    """A delivered capsule's API path, with the client signed out (someone holding the link)."""
    sender = await sign_in("sam@example.com", "Sam Sender")
    c = await schedule(client, freeze_now, **overrides)
    path = await deliver(sessionmaker, mailer, settings)
    client.cookies.clear()
    freeze_now(DUE + timedelta(hours=1))
    return path, c, sender


@pytest.fixture
async def link(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    path, _, _ = await stranger_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    return path


async def test_the_link_alone_shows_nothing_inside(client, link, sessionmaker):
    for r in (
        await client.get(link),
        await client.post(f"{link}/opened"),
        await client.post(f"{link}/reply", json={"text": "Thanks"}),
    ):
        assert r.status_code == 401 and r.json()["detail"]["code"] == "RECIPIENT_NOT_VERIFIED"
        assert "Happy birthday" not in r.text and r.headers["cache-control"] == "no-store"
    async with sessionmaker() as s:
        (row,) = (await s.scalars(select(Capsule))).all()
    assert row.status == "delivered" and row.reply is None  # nothing was opened or sent


async def test_the_locked_link_says_who_and_whose_email(client, link):
    r = await client.get(f"{link}/access")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    assert r.json() == {
        "sender_first_name": "Sam",
        "recipient_hint": "a•••@gmail.com",
        "message_lang": "en",
        "allowed": False,
        "signed_in_as": None,
    }


async def test_another_account_is_refused(client, link, sign_in):
    await sign_in("someone.else@gmail.com", "Someone Else")
    r = await client.get(link)
    assert r.status_code == 403 and r.json()["detail"]["code"] == "WRONG_ACCOUNT"
    access = (await client.get(f"{link}/access")).json()
    assert (access["allowed"], access["signed_in_as"]) == (False, "someone.else@gmail.com")


async def test_the_sender_cannot_open_it_either(client, sign_in, act_as, freeze_now, sessionmaker, mailer, settings):
    path, _, sender = await stranger_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    act_as(sender.id)
    assert (await client.get(path)).status_code == 403


async def test_the_recipients_google_account_opens_it(client, link, monkeypatch):
    fake_google(monkeypatch, {**CLAIMS, "sub": "aiko-sub", "email": "Aiko@Gmail.com", "name": "Aiko Tanaka"})
    await client.post("/v1/auth/google", json={"credential": "good-token"})
    assert (await client.get(link)).json()["message_text"] == "Happy birthday!"
    assert (await client.get(f"{link}/access")).json()["allowed"] is True


async def test_signing_in_by_email_code_opens_it(client, link, mailer):
    access = (await client.get(f"{link}/access")).json()
    await client.post("/v1/auth/email/code", json={"email": "aiko@gmail.com", "lang": access["message_lang"]})
    code = re.search(r"\b\d{6}\b", mailer.sent[-1].get_body(("plain",)).get_content())[0]
    await client.post("/v1/auth/email/verify", json={"email": "aiko@gmail.com", "code": code})
    assert (await client.get(link)).json()["message_text"] == "Happy birthday!"
    assert (await client.post(f"{link}/opened")).status_code == 200
    assert (await client.post(f"{link}/reply", json={"text": "Thank you!"})).status_code == 201


async def test_media_is_locked_until_signed_in(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in("sam@example.com", "Sam Sender")
    photo = (await upload(client, JPEG, "p.jpg", "image/jpeg")).json()["id"]
    freeze_now(DUE - timedelta(days=30))
    r = await client.post("/v1/capsules", json=capsule_body(upload_ids=[photo]))
    assert r.status_code == 201, r.text
    path = await deliver(sessionmaker, mailer, settings)
    client.cookies.clear()

    locked = await client.get(f"{path}/media/{photo}")
    assert locked.status_code == 401 and locked.content != JPEG
    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    shown = await client.get(f"{path}/media/{photo}")
    assert shown.status_code == 200 and shown.content == JPEG
    assert shown.headers["cache-control"] == "no-store"  # not left in the browser's cache


async def test_the_locked_link_speaks_the_capsules_language(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    path, _, _ = await stranger_link(client, sign_in, freeze_now, sessionmaker, mailer, settings, message_lang="ta")
    assert (await client.get(f"{path}/access")).json()["message_lang"] == "ta"


async def test_unknown_or_cancelled_links_say_nothing(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    assert (await client.get("/v1/c/" + "a" * 43 + "/access")).status_code == 404
    path, c, _ = await stranger_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    async with sessionmaker() as s, s.begin():
        await s.execute(update(Capsule).where(Capsule.id == c["id"]).values(status="cancelled"))
    assert (await client.get(f"{path}/access")).status_code == 410
