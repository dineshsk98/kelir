"""Received (prd.md > Received): the capsules sent to your email, without needing the link."""

import uuid
from datetime import timedelta

from sqlalchemy import update

from app.delivery.scheduler import run_tick
from app.models import Capsule
from tests.test_delivery import DUE, NOW, deliver, schedule
from tests.test_media import JPEG, upload


async def test_received_needs_sign_in(client):
    assert (await client.get("/v1/received")).status_code == 401
    assert (await client.get(f"/v1/received/{uuid.uuid4()}")).status_code == 401


async def test_lists_delivered_capsules_sent_to_my_email(
    client, sign_in, act_as, freeze_now, sessionmaker, mailer, settings
):
    sam = await sign_in("sam@example.com", "Sam Sender")
    delivered = await schedule(client, freeze_now)  # aiko@gmail.com, 14 March in Tokyo
    later = await schedule(client, freeze_now, birth_month=12, birth_day=25)  # still a surprise
    await schedule(client, freeze_now, recipient_email="ben@gmail.com", recipient_name="Ben")  # not hers
    await run_tick(sessionmaker, mailer, settings, DUE)

    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    r = await client.get("/v1/received")
    assert r.status_code == 200 and r.headers["cache-control"] == "no-store"
    (row,) = r.json()
    assert row == {
        "id": delivered["id"],
        "sender_name": "Sam Sender",
        "delivered_at": row["delivered_at"],
        "opened_at": None,
        "message_lang": "en",
        "replied": False,
    }
    assert "message_text" not in row  # nothing from inside it
    # Not yet delivered: not listed, and can't be opened by id either
    assert (await client.get(f"/v1/received/{later['id']}")).status_code == 404

    # A cancelled one disappears
    async with sessionmaker() as s, s.begin():
        await s.execute(update(Capsule).where(Capsule.id == delivered["id"]).values(status="cancelled"))
    assert (await client.get("/v1/received")).json() == []
    assert sam


async def test_newest_delivery_first(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in("sam@example.com", "Sam Sender")
    first = await schedule(client, freeze_now, send_mode="now")
    await run_tick(sessionmaker, mailer, settings, NOW)
    second = await schedule(client, freeze_now)
    await run_tick(sessionmaker, mailer, settings, DUE)
    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    assert [r["id"] for r in (await client.get("/v1/received")).json()] == [second["id"], first["id"]]


async def test_open_reply_and_media_from_received(client, sign_in, act_as, freeze_now, sessionmaker, mailer, settings):
    sam = await sign_in("sam@example.com", "Sam Sender")
    photo = (await upload(client, JPEG, "p.jpg", "image/jpeg")).json()["id"]
    c = await schedule(client, freeze_now, upload_ids=[photo])
    link = await deliver(sessionmaker, mailer, settings)
    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    base = f"/v1/received/{c['id']}"
    freeze_now(DUE + timedelta(hours=1))

    shown = (await client.get(base)).json()
    assert shown["message_text"] == "Happy birthday!" and shown["opened_at"] is None
    media = await client.get(f"{base}/media/{photo}")
    assert media.status_code == 200 and media.content == JPEG

    # Opening here opens it everywhere: the link shows the contents too
    assert (await client.post(f"{base}/opened")).status_code == 200
    assert (await client.get(link)).json()["opened_at"] is not None
    r = await client.post(f"{base}/reply", json={"text": "Thank you, Sam!"})
    assert r.status_code == 201
    assert (await client.post(f"{base}/reply", json={"text": "Again"})).status_code == 409
    assert (await client.get("/v1/received")).json()[0]["replied"] is True

    act_as(sam.id)  # the sender sees it opened, with the thank-you
    (sent,) = (await client.get("/v1/capsules")).json()
    assert sent["status"] == "opened" and sent["reply"]["text"] == "Thank you, Sam!"


async def test_someone_elses_capsule_is_not_found(
    client, sign_in, act_as, freeze_now, sessionmaker, mailer, settings
):
    sam = await sign_in("sam@example.com", "Sam Sender")
    c = await schedule(client, freeze_now)
    await run_tick(sessionmaker, mailer, settings, DUE)
    base = f"/v1/received/{c['id']}"

    await sign_in("ben@gmail.com", "Ben")  # someone else
    for r in (
        await client.get(base),
        await client.post(f"{base}/opened"),
        await client.post(f"{base}/reply", json={"text": "hi"}),
    ):
        assert r.status_code == 404 and "Happy birthday" not in r.text
    assert (await client.get("/v1/received")).json() == []

    act_as(sam.id)  # the sender sent it, but didn't receive it
    assert (await client.get(base)).status_code == 404
    assert (await client.get("/v1/received")).json() == []


async def test_unread_counts_delivered_capsules_not_yet_opened(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    assert (await client.get("/v1/received/unread")).status_code == 401
    await sign_in("sam@example.com", "Sam Sender")
    first = await schedule(client, freeze_now)
    await schedule(client, freeze_now, message_text="Another one")
    await schedule(client, freeze_now, birth_month=12, birth_day=25)  # not delivered yet: not counted
    await schedule(client, freeze_now, recipient_email="ben@gmail.com", recipient_name="Ben")  # not hers
    await run_tick(sessionmaker, mailer, settings, DUE)

    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    r = await client.get("/v1/received/unread")
    assert r.json() == {"unread": 2} and r.headers["cache-control"] == "no-store"
    await client.post(f"/v1/received/{first['id']}/opened")
    assert (await client.get("/v1/received/unread")).json() == {"unread": 1}
