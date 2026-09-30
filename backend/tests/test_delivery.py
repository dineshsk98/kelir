"""The delivery loop: exactly-once delivery, email after commit, retries (prd.md > Delivery)."""

import asyncio
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.delivery import scheduler
from app.delivery.scheduler import MAX_SEND_ATTEMPTS, run_tick
from app.models import Capsule

NOW = datetime(2027, 1, 10, 12, 0, tzinfo=timezone.utc)
DUE = datetime(2027, 3, 13, 15, 0, tzinfo=timezone.utc)  # 00:00 on 14 Mar in Tokyo


def capsule_body(**overrides):
    body = {
        "recipient_name": "Aiko Tanaka",
        "recipient_email": "aiko@gmail.com",
        "birth_month": 3,
        "birth_day": 14,
        "city_label": "Tokyo, Japan",
        "tz": "Asia/Tokyo",
        "message_text": "Happy birthday!",
        "send_mode": "birthday",
    }
    body.update(overrides)
    return body


async def schedule(client, freeze_now, **overrides) -> dict:
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()


async def capsule_row(sessionmaker, capsule_id) -> Capsule:
    async with sessionmaker() as s:
        return await s.get(Capsule, capsule_id)


async def test_nothing_happens_before_their_midnight(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await schedule(client, freeze_now)
    result = await run_tick(sessionmaker, mailer, settings, DUE - timedelta(seconds=1))
    assert (result.delivered, result.emailed) == (0, 0)
    assert (await capsule_row(sessionmaker, c["id"])).status == "scheduled"
    assert mailer.sent == []


async def test_delivers_and_emails_at_their_midnight(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    result = await run_tick(sessionmaker, mailer, settings, DUE)
    assert (result.delivered, result.emailed, result.failed) == (1, 1, 0)

    row = await capsule_row(sessionmaker, c["id"])
    assert row.status == "delivered" and row.delivered_at == DUE and row.emailed_at == DUE
    assert row.link_token_hash and len(row.link_token_hash) == 64  # only the hash is stored

    (email,) = mailer.sent
    assert email["Subject"] == "Sam Sender has sent you a surprise for your special day."
    assert email["To"].addresses[0].addr_spec == "aiko@gmail.com"
    (link,) = mailer.links()
    assert row.link_token_hash not in link  # the URL carries the secret, never the hash
    # The email links to the web page /c/<secret>; the page loads the capsule from /v1/c/<secret>
    opened = await client.get("/v1" + link.removeprefix("http://testserver"))
    assert opened.status_code == 200 and opened.json()["message_text"] == "Happy birthday!"


async def test_each_capsule_is_delivered_and_emailed_once(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    await schedule(client, freeze_now)
    await run_tick(sessionmaker, mailer, settings, DUE)
    await run_tick(sessionmaker, mailer, settings, DUE)
    await run_tick(sessionmaker, mailer, settings, DUE + timedelta(days=1))
    assert len(mailer.sent) == 1


async def test_concurrent_ticks_never_double_deliver(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    for i in range(6):
        await schedule(client, freeze_now, recipient_email=f"friend{i}@gmail.com")
    results = await asyncio.gather(*(run_tick(sessionmaker, mailer, settings, DUE) for _ in range(4)))
    assert sum(r.delivered for r in results) == 6
    assert sum(r.emailed for r in results) == 6
    recipients = sorted(m["To"].addresses[0].addr_spec for m in mailer.sent)
    assert recipients == sorted(f"friend{i}@gmail.com" for i in range(6))


async def test_failed_email_is_retried_with_backoff_and_a_fresh_link(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    c = await schedule(client, freeze_now)
    mailer.fail_next = 1
    first = await run_tick(sessionmaker, mailer, settings, DUE)
    assert (first.delivered, first.emailed, first.failed) == (1, 0, 1)
    row = await capsule_row(sessionmaker, c["id"])
    failed_hash = row.link_token_hash
    assert row.status == "delivered" and row.delivery_trouble and "SMTP unreachable" in row.send_error

    listed = (await client.get("/v1/capsules")).json()[0]
    assert listed["delivery_trouble"] is True

    too_soon = await run_tick(sessionmaker, mailer, settings, DUE + timedelta(seconds=30))
    assert too_soon.emailed == 0  # backing off

    retry = await run_tick(sessionmaker, mailer, settings, DUE + scheduler.retry_delay(1))
    assert retry.emailed == 1
    row = await capsule_row(sessionmaker, c["id"])
    assert not row.delivery_trouble and row.send_error is None and row.send_attempts == 2
    assert row.link_token_hash != failed_hash  # the failed attempt's link never worked


async def test_gives_up_after_max_attempts(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await schedule(client, freeze_now)
    mailer.fail_next = 100
    for hour in range(MAX_SEND_ATTEMPTS + 3):
        await run_tick(sessionmaker, mailer, settings, DUE + timedelta(hours=hour))
    row = await capsule_row(sessionmaker, c["id"])
    assert row.send_attempts == MAX_SEND_ATTEMPTS and row.delivery_trouble
    assert mailer.fail_next == 100 - MAX_SEND_ATTEMPTS


async def test_send_interrupted_mid_flight_is_retried_after_the_lease(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    await schedule(client, freeze_now)
    # Deliver and claim the email, then "crash" before sending
    async with sessionmaker() as s, s.begin():
        await scheduler._deliver_due(s, DUE)
    async with sessionmaker() as s, s.begin():
        assert len(await scheduler._claim_emails(s, DUE)) == 1

    during = await run_tick(sessionmaker, mailer, settings, DUE + timedelta(minutes=1))
    assert during.emailed == 0  # still leased to the "crashed" sender
    after = await run_tick(sessionmaker, mailer, settings, DUE + scheduler.SEND_LEASE)
    assert after.emailed == 1


async def test_send_now_goes_out_straight_away(client, sign_in, freeze_now, sessionmaker, mailer):
    await sign_in()
    c = await schedule(client, freeze_now, send_mode="now")
    assert len(mailer.sent) == 1  # the background tick ran after the response
    assert (await capsule_row(sessionmaker, c["id"])).status == "delivered"


async def test_simulate_midnight_delivers_now(client, sign_in, freeze_now, sessionmaker, mailer):
    await sign_in()
    c = await schedule(client, freeze_now)
    r = await client.post(f"/v1/demo/capsules/{c['id']}/simulate-midnight")
    assert r.status_code == 200
    assert r.json()["status"] == "delivered"
    assert len(mailer.sent) == 1

    again = await client.post(f"/v1/demo/capsules/{c['id']}/simulate-midnight")
    assert again.status_code == 409
    assert len(mailer.sent) == 1


async def test_simulate_midnight_is_owner_only_and_demo_only(client, sign_in, freeze_now, settings, mailer):
    await sign_in("sam@example.com")
    c = await schedule(client, freeze_now)

    await sign_in("other@example.com")
    assert (await client.post(f"/v1/demo/capsules/{c['id']}/simulate-midnight")).status_code == 404

    settings.demo_mode = False
    await sign_in("sam2@example.com")
    assert (await client.post(f"/v1/demo/capsules/{c['id']}/simulate-midnight")).status_code == 404
    assert mailer.sent == []


async def test_only_due_scheduled_capsules_are_claimed(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    await schedule(client, freeze_now)  # due 13 Mar
    await schedule(client, freeze_now, birth_month=6, birth_day=1)  # due in June
    await run_tick(sessionmaker, mailer, settings, DUE)
    async with sessionmaker() as s:
        statuses = sorted((await s.scalars(select(Capsule.status))).all())
    assert statuses == ["delivered", "scheduled"]
