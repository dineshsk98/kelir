"""Signing in with a one-time code emailed to you (prd.md > Sign-in and history), and how it
shares one account per email with Google sign-in."""

import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select

from app.models import Sender
from tests.test_auth import CLAIMS, fake_google
from tests.test_delivery import capsule_body

T0 = datetime(2027, 1, 10, 12, 0, tzinfo=timezone.utc)


def emailed_code(mailer) -> str:
    return re.search(r"\b\d{6}\b", mailer.sent[-1].get_body(("plain",)).get_content())[0]


async def send_code(client, mailer, email="aiko.tanaka@gmail.com", **extra) -> str:
    r = await client.post("/v1/auth/email/code", json={"email": email, **extra})
    assert r.status_code == 201, r.text
    return emailed_code(mailer)


def other_than(code: str) -> str:
    return "000000" if code != "000000" else "111111"


@pytest.fixture(autouse=True)
def at_t0(freeze_now):
    freeze_now(T0)


async def test_a_code_signs_you_in(client, mailer):
    r = await client.post("/v1/auth/email/code", json={"email": "Aiko.Tanaka@Gmail.com"})
    assert r.status_code == 201 and r.json() == {"sent_to": "aiko.tanaka@gmail.com", "resend_after": 60}
    email = mailer.sent[-1]
    code = emailed_code(mailer)
    assert email["To"].addresses[0].addr_spec == "aiko.tanaka@gmail.com"
    assert email["Subject"] == f"{code} is your Birthday Capsule sign-in code"
    assert "http" not in email.get_body(("plain",)).get_content()  # no link to click

    wrong = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": other_than(code)})
    assert wrong.status_code == 400 and wrong.json()["detail"] == {"code": "CODE_WRONG", "tries_left": 4}
    assert (await client.get("/v1/me")).status_code == 401

    r = await client.post("/v1/auth/email/verify", json={"email": "AIKO.TANAKA@gmail.com", "code": f" {code} "})
    assert r.status_code == 200
    assert (r.json()["email"], r.json()["name"], r.json()["created"]) == ("aiko.tanaka@gmail.com", "Aiko Tanaka", True)
    assert "HttpOnly" in r.headers["set-cookie"]
    assert (await client.get("/v1/me")).json()["email"] == "aiko.tanaka@gmail.com"

    again = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    assert again.status_code == 400 and again.json()["detail"]["code"] == "CODE_EXPIRED"  # used once


async def test_an_email_account_is_a_full_account(client, mailer):
    code = await send_code(client, mailer)
    await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    r = await client.post("/v1/capsules", json=capsule_body(recipient_email="ben@gmail.com"))
    assert r.status_code == 201, r.text
    assert (await client.get("/v1/capsules")).json()[0]["recipient_email"] == "ben@gmail.com"


async def test_signing_in_again_finds_the_same_account(client, mailer, freeze_now, sessionmaker):
    first = await send_code(client, mailer)
    me = (await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": first})).json()
    await client.post("/v1/auth/logout")
    freeze_now(T0 + timedelta(minutes=5))
    second = await send_code(client, mailer)
    again = (await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": second})).json()
    assert again["id"] == me["id"] and again["created"] is False
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Sender)) == 1


async def test_a_code_works_only_for_its_email(client, mailer):
    code = await send_code(client, mailer, email="aiko.tanaka@gmail.com")
    r = await client.post("/v1/auth/email/verify", json={"email": "ben@gmail.com", "code": code})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CODE_EXPIRED"


async def test_the_code_email_speaks_the_pages_language(client, mailer):
    code = await send_code(client, mailer, lang="ta")
    assert mailer.sent[-1]["Subject"] == f"Birthday Capsule உள்நுழைவுக் குறியீடு: {code}"


async def test_codes_expire_after_ten_minutes(client, mailer, freeze_now):
    code = await send_code(client, mailer)
    freeze_now(T0 + timedelta(minutes=10))
    r = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CODE_EXPIRED"


async def test_five_wrong_tries_use_up_a_code(client, mailer):
    code = await send_code(client, mailer)
    for left in (4, 3, 2, 1, 0):
        r = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": other_than(code)})
        assert r.json()["detail"] == {"code": "CODE_WRONG", "tries_left": left}
    r = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CODE_EXPIRED"


async def test_a_new_code_replaces_the_last(client, mailer, freeze_now):
    first = await send_code(client, mailer)
    freeze_now(T0 + timedelta(seconds=61))
    second = await send_code(client, mailer)
    if first != second:  # (one in a million they match)
        old = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": first})
        assert old.status_code == 400 and old.json()["detail"]["code"] == "CODE_WRONG"
    ok = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": second})
    assert ok.status_code == 200


async def test_codes_are_rate_limited_per_email(client, mailer, freeze_now):
    await send_code(client, mailer)
    soon = await client.post("/v1/auth/email/code", json={"email": "aiko.tanaka@gmail.com"})
    assert soon.status_code == 429 and soon.json()["detail"]["code"] == "CODE_TOO_SOON"
    assert 0 < soon.json()["detail"]["retry_after"] <= 61
    await send_code(client, mailer, email="ben@gmail.com")  # another email isn't held up

    for minute in range(1, 5):  # five in the hour in all
        freeze_now(T0 + timedelta(minutes=minute, seconds=1))
        await send_code(client, mailer)
    freeze_now(T0 + timedelta(minutes=10))
    limit = await client.post("/v1/auth/email/code", json={"email": "aiko.tanaka@gmail.com"})
    assert limit.status_code == 429 and limit.json()["detail"]["code"] == "CODE_LIMIT"

    freeze_now(T0 + timedelta(hours=1, minutes=5))
    await send_code(client, mailer)


async def test_a_code_that_could_not_be_emailed_does_not_count(client, mailer):
    mailer.fail_next = 1
    r = await client.post("/v1/auth/email/code", json={"email": "aiko.tanaka@gmail.com"})
    assert r.status_code == 503 and r.json()["detail"]["code"] == "CODE_NOT_SENT"
    await send_code(client, mailer)  # not "too soon"


async def test_undeliverable_or_invalid_emails_get_no_code(client, mailer, fake_dns):
    fake_dns["gmial.com"] = False
    assert (await client.post("/v1/auth/email/code", json={"email": "aiko@gmial.com"})).status_code == 422
    assert (await client.post("/v1/auth/email/code", json={"email": "not-an-email"})).status_code == 422
    assert mailer.sent == []


@pytest.mark.parametrize("code", ["12345", "1234567", "abcdef", "", "12 456"])
async def test_codes_are_six_digits(client, code):
    r = await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    assert r.status_code == 422


async def test_google_then_a_code_is_one_account(client, mailer, monkeypatch):
    fake_google(monkeypatch)  # sender@example.com
    google = (await client.post("/v1/auth/google", json={"credential": "good-token"})).json()
    await client.post("/v1/auth/logout")
    code = await send_code(client, mailer, email="sender@example.com")
    by_code = (await client.post("/v1/auth/email/verify", json={"email": "sender@example.com", "code": code})).json()
    assert by_code["id"] == google["id"] and by_code["name"] == "Sam Sender"


async def test_a_code_then_google_is_one_account(client, mailer, monkeypatch, sessionmaker):
    code = await send_code(client, mailer, email="sender@example.com")
    by_code = (await client.post("/v1/auth/email/verify", json={"email": "sender@example.com", "code": code})).json()
    await client.post("/v1/auth/logout")
    fake_google(monkeypatch, {**CLAIMS, "email": "Sender@Example.com"})  # Google verified it
    google = (await client.post("/v1/auth/google", json={"credential": "good-token"})).json()
    assert google["id"] == by_code["id"] and google["name"] == "Sam Sender"
    async with sessionmaker() as s:
        (account,) = (await s.scalars(select(Sender))).all()
    assert account.google_sub == CLAIMS["sub"]


async def test_a_google_address_change_never_takes_another_account(client, mailer, monkeypatch):
    code = await send_code(client, mailer, email="taken@example.com")
    await client.post("/v1/auth/email/verify", json={"email": "taken@example.com", "code": code})
    await client.post("/v1/auth/logout")
    fake_google(monkeypatch)  # the Google account, sender@example.com
    await client.post("/v1/auth/google", json={"credential": "good-token"})
    fake_google(monkeypatch, {**CLAIMS, "email": "taken@example.com"})  # its address changes
    me = (await client.post("/v1/auth/google", json={"credential": "good-token"})).json()
    assert me["email"] == "sender@example.com"  # kept: the other account owns that email


async def test_change_your_name(client, mailer):
    assert (await client.patch("/v1/me", json={"name": "Aiko"})).status_code == 401
    code = await send_code(client, mailer)
    await client.post("/v1/auth/email/verify", json={"email": "aiko.tanaka@gmail.com", "code": code})
    r = await client.patch("/v1/me", json={"name": "  Aiko T.  "})
    assert r.status_code == 200 and r.json()["name"] == "Aiko T."
    assert (await client.get("/v1/me")).json()["name"] == "Aiko T."
    assert (await client.patch("/v1/me", json={"name": " "})).status_code == 422
