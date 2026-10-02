"""Editing and cancelling until opened (prd.md > Editing and cancelling)."""

import asyncio
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.delivery.scheduler import run_tick
from app.models import Capsule, CapsuleMedia
from tests.test_delivery import DUE, NOW, capsule_body
from tests.test_media import JPEG, MP4, PNG, upload


async def make(client, freeze_now, **overrides) -> dict:
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()


async def patch(client, capsule: dict, **changes):
    body = capsule_body(**{k: capsule[k] for k in capsule_body() if k in capsule})
    body["upload_ids"] = [m["id"] for m in capsule.get("media", [])]
    body.update(changes)
    return await client.patch(f"/v1/capsules/{capsule['id']}", json=body)


async def deliver(client, sessionmaker, mailer, settings) -> str:
    await run_tick(sessionmaker, mailer, settings, DUE)
    return "/v1" + mailer.links()[-1].removeprefix("http://testserver")


async def test_edit_while_scheduled_recomputes_delivery(client, sign_in, freeze_now):
    await sign_in()
    c = await make(client, freeze_now)
    r = await patch(client, c, tz="Asia/Kolkata", city_label="Chennai, Tamil Nadu, India", message_text="New words")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["message_text"] == "New words"
    assert body["deliver_at"].startswith("2027-03-13T18:30")  # 00:00 on 14 Mar in India


async def test_edit_to_send_now_goes_out(client, sign_in, freeze_now, mailer):
    await sign_in()
    c = await make(client, freeze_now)
    r = await patch(client, c, send_mode="now")
    assert r.status_code == 200
    assert len(mailer.sent) == 1


async def test_edit_after_delivery_changes_what_the_link_shows(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    c = await make(client, freeze_now)
    link = await deliver(client, sessionmaker, mailer, settings)
    r = await patch(client, {**c, "status": "delivered"}, message_text="Edited after delivery")
    assert r.status_code == 200
    assert r.json()["status"] == "delivered"
    assert (await client.get(link)).json()["message_text"] == "Edited after delivery"


async def test_who_and_when_are_locked_after_delivery(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    c = await make(client, freeze_now)
    await deliver(client, sessionmaker, mailer, settings)
    r = await patch(client, c, recipient_email="someone.else@gmail.com", birth_day=15)
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "CAPSULE_DELIVERED"
    assert sorted(r.json()["detail"]["fields"]) == ["birth_day", "recipient_email"]


async def test_opened_capsules_are_final(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await make(client, freeze_now)
    link = await deliver(client, sessionmaker, mailer, settings)
    await client.get(link)  # the recipient opens it
    assert (await patch(client, c, message_text="Too late")).json()["detail"]["code"] == "CAPSULE_FINAL"
    cancel = await client.post(f"/v1/capsules/{c['id']}/cancel")
    assert cancel.status_code == 409 and cancel.json()["detail"]["code"] == "CAPSULE_FINAL"


async def test_cancel_before_delivery_means_no_email(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await make(client, freeze_now)
    r = await client.post(f"/v1/capsules/{c['id']}/cancel")
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    result = await run_tick(sessionmaker, mailer, settings, DUE)
    assert (result.delivered, mailer.sent) == (0, [])
    again = await client.post(f"/v1/capsules/{c['id']}/cancel")
    assert again.status_code == 200  # cancelling twice is harmless
    assert (await patch(client, c)).json()["detail"]["code"] == "CAPSULE_CANCELLED"


async def test_cancel_after_delivery_closes_the_link_and_stops_retries(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    c = await make(client, freeze_now)
    mailer.fail_next = 1
    await run_tick(sessionmaker, mailer, settings, DUE)  # delivered, email failed, retry pending
    await client.post(f"/v1/capsules/{c['id']}/cancel")
    retry = await run_tick(sessionmaker, mailer, settings, datetime(2027, 3, 14, tzinfo=timezone.utc))
    assert retry.emailed == 0 and mailer.sent == []


async def test_cancelled_link_is_gone(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await make(client, freeze_now)
    link = await deliver(client, sessionmaker, mailer, settings)
    await client.post(f"/v1/capsules/{c['id']}/cancel")
    assert (await client.get(link)).status_code == 410


async def test_edit_media_add_remove_reorder(client, sign_in, freeze_now, sessionmaker, settings):
    sender = await sign_in()
    a, b = [(await upload(client, d)).json()["id"] for d in (JPEG, PNG)]
    c = await make(client, freeze_now, upload_ids=[a, b])
    new = (await upload(client, MP4, "v.mp4", "video/mp4")).json()["id"]

    r = await patch(client, c, upload_ids=[new, b])  # add a video first, keep b, drop a
    assert r.status_code == 200, r.text
    assert [m["id"] for m in r.json()["media"]] == [new, b]
    assert not (settings.uploads_dir / str(sender.id) / a).exists()  # removed file deleted
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(CapsuleMedia)) == 2

    swapped = await patch(client, {**c, "media": r.json()["media"]}, upload_ids=[b, new])
    assert [m["id"] for m in swapped.json()["media"]] == [b, new]


async def test_edit_cannot_steal_another_capsules_media(client, sign_in, freeze_now):
    await sign_in()
    a = (await upload(client, JPEG)).json()["id"]
    first = await make(client, freeze_now, upload_ids=[a])
    second = await make(client, freeze_now)
    r = await patch(client, second, upload_ids=[a])
    assert r.status_code == 422
    assert first


async def test_only_the_owner_can_edit_or_cancel(client, sign_in, freeze_now):
    await sign_in("sam@example.com")
    c = await make(client, freeze_now)
    await sign_in("other@example.com")
    assert (await patch(client, c, message_text="Mine now")).status_code == 404
    assert (await client.post(f"/v1/capsules/{c['id']}/cancel")).status_code == 404


async def test_edit_and_delivery_tick_dont_collide(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in()
    c = await make(client, freeze_now)
    edit, _ = await asyncio.gather(
        patch(client, c, message_text="Edited at midnight"),
        run_tick(sessionmaker, mailer, settings, DUE),
    )
    await run_tick(sessionmaker, mailer, settings, DUE)  # in case the edit held the lock first
    # Whichever won the row lock, the message edit stands (it's allowed before and after
    # delivery) and the capsule was delivered and emailed exactly once
    assert edit.status_code == 200, edit.text
    async with sessionmaker() as s:
        row = await s.get(Capsule, c["id"])
    assert row.status == "delivered" and row.message_text == "Edited at midnight"
    assert len(mailer.sent) == 1
