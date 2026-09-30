"""The recipient's private link: lookup by hash, first open, cancelled and unknown links."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from app.delivery.scheduler import run_tick
from app.links import new_link_secret
from app.models import Capsule
from tests.test_delivery import DUE, schedule


async def delivered_link(client, sign_in, freeze_now, sessionmaker, mailer, settings, **overrides) -> tuple[str, dict]:
    await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now, **overrides)
    await run_tick(sessionmaker, mailer, settings, DUE)
    (link,) = mailer.links()
    client.cookies.clear()  # the recipient has no account
    return link.removeprefix("http://testserver"), c


async def test_link_opens_the_capsule_without_an_account(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    path, _ = await delivered_link(
        client, sign_in, freeze_now, sessionmaker, mailer, settings,
        gift_kind="code", gift_value="ABCD-1234", gift_note="For Steam",
    )
    r = await client.get(f"/v1{path}")
    assert r.status_code == 200
    body = r.json()
    assert body.pop("reply") is None and len(body.pop("reply_presets")) > 0  # see test_replies.py
    assert body == {
        "sender_name": "Sam Sender",
        "recipient_name": "Aiko Tanaka",
        "message_text": "Happy birthday!",
        "media_kind": None,
        "gift_kind": "code",
        "gift_value": "ABCD-1234",
        "gift_note": "For Steam",
    }  # nothing about emails, delivery or the sender's account
    assert r.headers["cache-control"] == "no-store"
    assert "noindex" in r.headers["x-robots-tag"]
    assert r.headers["referrer-policy"] == "no-referrer"


async def test_first_open_marks_opened_once(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    path, c = await delivered_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    first = datetime(2027, 3, 13, 23, 0, tzinfo=timezone.utc)
    freeze_now(first)
    await client.get(f"/v1{path}")
    freeze_now(first + timedelta(days=2))
    replay = await client.get(f"/v1{path}")
    assert replay.status_code == 200  # replay keeps working

    async with sessionmaker() as s:
        row = await s.get(Capsule, c["id"])
    assert row.status == "opened" and row.opened_at == first


async def test_sender_sees_opened_in_history(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    sender = await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    await run_tick(sessionmaker, mailer, settings, DUE)
    (link,) = mailer.links()
    await client.get("/v1" + link.removeprefix("http://testserver"))
    listed = (await client.get("/v1/capsules")).json()
    assert [x["status"] for x in listed] == ["opened"] and listed[0]["id"] == c["id"]
    assert sender  # opening didn't need the sender's session, but listing does


async def test_unknown_and_malformed_links_are_not_found(client):
    secret, _ = new_link_secret()  # right shape, never issued
    for path in (f"/v1/c/{secret}", "/v1/c/short", "/v1/c/" + "x" * 43 + "!"):
        r = await client.get(path)
        assert r.status_code == 404, path
        assert r.headers["cache-control"] == "no-store"


async def test_cancelled_capsule_link_is_gone(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    path, c = await delivered_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    async with sessionmaker() as s, s.begin():
        await s.execute(update(Capsule).where(Capsule.id == c["id"]).values(status="cancelled"))
    r = await client.get(f"/v1{path}")
    assert r.status_code == 410
    assert r.json()["detail"]["code"] == "CAPSULE_CANCELLED"


async def test_capsule_page_is_private(client, settings, tmp_path):
    (tmp_path / "index.html").write_text("<!doctype html>app")
    settings.frontend_dist = tmp_path
    r = await client.get("/c/some-secret-value")
    assert r.text == "<!doctype html>app"
    assert "noindex" in r.headers["x-robots-tag"]
    assert r.headers["referrer-policy"] == "no-referrer"  # the secret never leaks to gift sites
