"""Creating and listing capsules (prd.md > Creating a capsule)."""

from datetime import datetime, timedelta, timezone

import pytest

from app.engine.schedule import next_delivery

NOW = datetime(2027, 1, 10, 12, 0, tzinfo=timezone.utc)


def capsule(**overrides):
    body = {
        "recipient_name": "Aiko",
        "recipient_email": "Aiko@Example.com",
        "birth_month": 3,
        "birth_day": 14,
        "city_label": "Tokyo, Japan",
        "tz": "Asia/Tokyo",
        "message_text": "Happy birthday!",
        "send_mode": "birthday",
    }
    body.update(overrides)
    return body


def utc(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def test_capsules_require_sign_in(client):
    assert (await client.get("/v1/capsules")).status_code == 401
    assert (await client.post("/v1/capsules", json=capsule())).status_code == 401
    assert (await client.post("/v1/delivery-preview", json=capsule())).status_code == 401


async def test_create_schedules_at_recipients_midnight(client, sign_in, freeze_now):
    await sign_in()
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule())
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "scheduled"
    assert body["recipient_email"] == "aiko@example.com"
    expected = next_delivery(3, 14, None, "Asia/Tokyo", NOW)
    assert utc(body["deliver_at"]) == expected == datetime(2027, 3, 13, 15, tzinfo=timezone.utc)


async def test_preview_matches_what_create_stores(client, sign_in, freeze_now):
    await sign_in()
    freeze_now(NOW)
    details = capsule(tz="Asia/Kathmandu", birth_month=2, birth_day=29, feb29_pref="MAR_1")
    preview = await client.post("/v1/delivery-preview", json=details)
    created = await client.post("/v1/capsules", json=details)
    assert preview.status_code == 200
    assert utc(preview.json()["deliver_at"]) == utc(created.json()["deliver_at"])
    assert utc(created.json()["deliver_at"]) == datetime(2027, 2, 28, 18, 15, tzinfo=timezone.utc)


async def test_send_now_delivers_immediately(client, sign_in, freeze_now):
    await sign_in()
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule(send_mode="now"))
    assert utc(r.json()["deliver_at"]) == NOW


async def test_feb29_pref_is_dropped_for_other_birthdays(client, sign_in):
    await sign_in()
    r = await client.post("/v1/capsules", json=capsule(feb29_pref="MAR_1"))
    assert r.json()["feb29_pref"] is None


async def test_gift_is_optional_and_cleared_when_none(client, sign_in):
    await sign_in()
    r = await client.post(
        "/v1/capsules", json=capsule(gift_kind=None, gift_value="leftover", gift_note="x")
    )
    assert r.status_code == 201
    assert r.json()["gift_value"] is None and r.json()["gift_note"] is None

    r = await client.post(
        "/v1/capsules",
        json=capsule(gift_kind="code", gift_value="ABCD-1234", gift_note="  For Steam  "),
    )
    assert (r.json()["gift_kind"], r.json()["gift_value"], r.json()["gift_note"]) == (
        "code",
        "ABCD-1234",
        "For Steam",
    )


@pytest.mark.parametrize(
    "overrides",
    [
        {"recipient_name": "   "},
        {"recipient_email": "not-an-email"},
        {"birth_month": 4, "birth_day": 31},
        {"birth_month": 13},
        {"birth_month": 2, "birth_day": 29},  # Feb 29 needs a non-leap-year choice
        {"tz": "Mars/Olympus_Mons"},
        {"tz": "../../etc/passwd"},
        {"city_label": ""},
        {"message_text": "   "},
        {"message_text": "x" * 5001},
        {"gift_kind": "link"},  # no value
        {"gift_kind": "link", "gift_value": "javascript:alert(1)"},
        {"gift_kind": "link", "gift_value": "amazon.com/gift"},
        {"gift_kind": "code", "gift_value": "x" * 201},
        {"send_mode": "later"},
        {"status": "opened"},  # clients can't set server-owned fields
    ],
)
async def test_invalid_capsules_are_rejected(client, sign_in, overrides):
    await sign_in()
    r = await client.post("/v1/capsules", json=capsule(**overrides))
    assert r.status_code == 422, overrides


async def test_undeliverable_domain_is_rejected(client, sign_in, fake_dns):
    await sign_in()
    fake_dns["gmial.com"] = False
    r = await client.post("/v1/capsules", json=capsule(recipient_email="aiko@gmial.com"))
    assert r.status_code == 422
    assert "can't receive mail" in r.json()["detail"][0]["msg"]


async def test_unknown_dns_result_does_not_block(client, sign_in, fake_dns):
    await sign_in()
    fake_dns["offline.example"] = None  # e.g. no network: couldn't check
    r = await client.post("/v1/capsules", json=capsule(recipient_email="aiko@offline.example"))
    assert r.status_code == 201


async def test_email_check_endpoint(client, sign_in, fake_dns):
    assert (await client.post("/v1/email-check", json={"email": "a@b.com"})).status_code == 401
    await sign_in()
    fake_dns["gmial.com"] = False

    async def check(email):
        return (await client.post("/v1/email-check", json={"email": email})).json()

    assert await check("aiko@gmail.com") == {"valid_format": True, "accepts_mail": True}
    assert await check("aiko@gmial.com") == {"valid_format": True, "accepts_mail": False}
    assert await check("aiko@") == {"valid_format": False, "accepts_mail": False}


async def test_list_shows_only_your_own_capsules(client, sign_in):
    await sign_in("sam@example.com")
    await client.post("/v1/capsules", json=capsule(recipient_name="Sam's"))

    await sign_in("other@example.com")
    await client.post("/v1/capsules", json=capsule(recipient_name="Other's"))
    names = [c["recipient_name"] for c in (await client.get("/v1/capsules")).json()]
    assert names == ["Other's"]

    await sign_in("new@example.com")
    assert (await client.get("/v1/capsules")).json() == []


async def test_list_order(client, sign_in, freeze_now):
    await sign_in()
    freeze_now(NOW)
    await client.post("/v1/capsules", json=capsule(recipient_name="First"))
    freeze_now(NOW + timedelta(minutes=5))
    await client.post("/v1/capsules", json=capsule(recipient_name="Second"))
    names = [c["recipient_name"] for c in (await client.get("/v1/capsules")).json()]
    assert names == ["Second", "First"]


async def test_capsule_detail_is_owner_only(client, sign_in):
    await sign_in("sam@example.com")
    created = (await client.post("/v1/capsules", json=capsule())).json()
    assert (await client.get(f"/v1/capsules/{created['id']}")).status_code == 200

    await sign_in("other@example.com")
    r = await client.get(f"/v1/capsules/{created['id']}")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "CAPSULE_NOT_FOUND"
