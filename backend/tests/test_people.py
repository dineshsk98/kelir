"""Saved people (prd.md > Regular recipients (People))."""

import uuid
from datetime import datetime, timezone

import pytest

from app.models import Capsule, Person
from tests.test_capsules_api import utc
from tests.test_delivery import DUE, NOW, capsule_body, capsule_row, deliver, schedule
from tests.test_edit_cancel import patch


async def people(client) -> list[dict]:
    r = await client.get("/v1/people")
    assert r.status_code == 200, r.text
    return r.json()


def person_body(**overrides):
    body = {
        "name": "Aiko Tanaka",
        "birth_month": 3,
        "birth_day": 14,
        "city_label": "Tokyo, Japan",
        "tz": "Asia/Tokyo",
    }
    body.update(overrides)
    return body


async def test_people_require_sign_in(client):
    some_id = uuid.uuid4()
    assert (await client.get("/v1/people")).status_code == 401
    assert (await client.patch(f"/v1/people/{some_id}", json=person_body())).status_code == 401
    assert (await client.delete(f"/v1/people/{some_id}")).status_code == 401


async def test_sending_a_capsule_saves_the_person(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    c = await schedule(client, freeze_now)
    (person,) = await people(client)
    assert person == {
        "id": person["id"],
        "name": "Aiko Tanaka",
        "email": "aiko@gmail.com",
        "birth_month": 3,
        "birth_day": 14,
        "feb29_pref": None,
        "city_label": "Tokyo, Japan",
        "tz": "Asia/Tokyo",
        "next_delivery": person["next_delivery"],
    }
    assert utc(person["next_delivery"]) == DUE  # 00:00 on 14 Mar in Tokyo
    assert str((await capsule_row(sessionmaker, c["id"])).person_id) == person["id"]


async def test_the_same_email_in_any_case_is_one_person(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    first = await schedule(client, freeze_now, recipient_email="Aiko@Gmail.com")
    second = await schedule(
        client, freeze_now, recipient_email="aiko@gmail.com", recipient_name="Aiko T.",
        city_label="Chennai, Tamil Nadu, India", tz="Asia/Kolkata",
    )
    (person,) = await people(client)
    # The latest capsule's details win
    assert (person["name"], person["city_label"], person["tz"]) == (
        "Aiko T.", "Chennai, Tamil Nadu, India", "Asia/Kolkata",
    )
    rows = [await capsule_row(sessionmaker, c["id"]) for c in (first, second)]
    assert {str(r.person_id) for r in rows} == {person["id"]}
    assert rows[0].city_label == "Tokyo, Japan"  # the first capsule keeps its own copy


async def test_soonest_birthday_first_by_each_persons_midnight(client, sign_in, freeze_now):
    # NOW is 12:00 UTC on 10 Jan 2027
    await sign_in()
    for name, month, day, tz, pref in [
        ("Jo", 1, 9, "Asia/Kolkata", None),  # just passed: next year
        ("Lisa", 1, 11, "America/Los_Angeles", None),
        ("Feb", 2, 29, "Europe/London", "MAR_1"),  # 2027 isn't a leap year: 1 March
        ("Tom", 1, 11, "Asia/Tokyo", None),  # same date as Lisa, but Tokyo's midnight is sooner
        ("Kiri", 1, 11, "Pacific/Kiritimati", None),  # already 11 Jan there: today
        ("Ana", 1, 11, "Pacific/Kiritimati", None),  # the same moment as Kiri: by name
    ]:
        await schedule(
            client, freeze_now, recipient_name=name, recipient_email=f"{name.lower()}@gmail.com",
            birth_month=month, birth_day=day, tz=tz, city_label=tz, feb29_pref=pref,
        )
    listed = [(p["name"], utc(p["next_delivery"])) for p in await people(client)]
    assert listed == [
        ("Ana", NOW),
        ("Kiri", NOW),
        ("Tom", datetime(2027, 1, 10, 15, 0, tzinfo=timezone.utc)),
        ("Lisa", datetime(2027, 1, 11, 8, 0, tzinfo=timezone.utc)),
        ("Feb", datetime(2027, 3, 1, 0, 0, tzinfo=timezone.utc)),
        ("Jo", datetime(2028, 1, 8, 18, 30, tzinfo=timezone.utc)),
    ]


async def test_edit_a_person(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    c = await schedule(client, freeze_now)
    (person,) = await people(client)
    r = await client.patch(
        f"/v1/people/{person['id']}",
        json=person_body(name="Aiko", birth_month=2, birth_day=29, feb29_pref="FEB_28",
                         city_label="London, UK", tz="Europe/London"),
    )
    assert r.status_code == 200, r.text
    edited = r.json()
    assert (edited["name"], edited["feb29_pref"], edited["tz"]) == ("Aiko", "FEB_28", "Europe/London")
    assert utc(edited["next_delivery"]) == datetime(2027, 2, 28, 0, 0, tzinfo=timezone.utc)
    assert await people(client) == [edited]
    # The capsule already made is unchanged
    row = await capsule_row(sessionmaker, c["id"])
    assert (row.recipient_name, row.tz, row.deliver_at) == ("Aiko Tanaka", "Asia/Tokyo", DUE)


@pytest.mark.parametrize(
    "changes",
    [
        {"name": "  "},
        {"birth_month": 2, "birth_day": 30},
        {"birth_month": 2, "birth_day": 29},  # needs a non-leap-year choice
        {"tz": "Mars/Olympus_Mons"},
        {"city_label": ""},
        {"email": "new@gmail.com"},  # the email is who they are: not editable
    ],
)
async def test_invalid_person_edits_are_rejected(client, sign_in, freeze_now, changes):
    await sign_in()
    await schedule(client, freeze_now)
    (person,) = await people(client)
    r = await client.patch(f"/v1/people/{person['id']}", json=person_body(**changes))
    assert r.status_code == 422, changes


async def test_only_the_sender_sees_and_changes_their_people(client, sign_in, freeze_now):
    await sign_in("sam@example.com")
    await schedule(client, freeze_now)
    (person,) = await people(client)

    await sign_in("other@example.com")
    assert await people(client) == []
    path = f"/v1/people/{person['id']}"
    for r in (await client.patch(path, json=person_body()), await client.delete(path)):
        assert r.status_code == 404 and r.json()["detail"]["code"] == "PERSON_NOT_FOUND"
    assert (await client.delete(f"/v1/people/{uuid.uuid4()}")).status_code == 404


async def test_removing_a_person_keeps_their_capsules(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    c = await schedule(client, freeze_now)
    (person,) = await people(client)
    assert (await client.delete(f"/v1/people/{person['id']}")).status_code == 204
    assert await people(client) == []
    row = await capsule_row(sessionmaker, c["id"])
    assert row.person_id is None and row.status == "scheduled"
    assert [x["id"] for x in (await client.get("/v1/capsules")).json()] == [c["id"]]

    # Sending to them again saves them again
    await schedule(client, freeze_now)
    assert [p["email"] for p in await people(client)] == ["aiko@gmail.com"]


async def test_editing_a_scheduled_capsule_updates_its_person(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    c = await schedule(client, freeze_now)
    r = await patch(client, c, city_label="Chennai, Tamil Nadu, India", tz="Asia/Kolkata")
    assert r.status_code == 200, r.text
    (person,) = await people(client)
    assert person["tz"] == "Asia/Kolkata"

    # A different email is a different person; the first one stays saved
    r = await patch(client, c, recipient_email="aiko.new@gmail.com")
    assert r.status_code == 200, r.text
    saved = {p["email"]: p for p in await people(client)}
    assert set(saved) == {"aiko@gmail.com", "aiko.new@gmail.com"}
    row = await capsule_row(sessionmaker, c["id"])
    assert str(row.person_id) == saved["aiko.new@gmail.com"]["id"]


async def test_editing_a_delivered_capsule_keeps_people_page_edits(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    sender = await sign_in()
    c = await schedule(client, freeze_now)
    await deliver(sessionmaker, mailer, settings)
    (person,) = await people(client)
    await client.patch(f"/v1/people/{person['id']}", json=person_body(name="Aiko-chan"))

    r = await patch(client, {**c, "status": "delivered"}, message_text="Edited after delivery")
    assert r.status_code == 200, r.text
    assert [p["name"] for p in await people(client)] == ["Aiko-chan"]
    async with sessionmaker() as s:
        assert (await s.get(Capsule, c["id"])).person_id is not None
        assert (await s.get(Person, uuid.UUID(person["id"]))).sender_id == sender.id


async def test_capsules_for_two_people_link_to_each(client, sign_in, freeze_now, sessionmaker):
    await sign_in()
    a = await schedule(client, freeze_now)
    b = await schedule(client, freeze_now, **capsule_body(recipient_name="Ben", recipient_email="ben@gmail.com"))
    by_email = {p["email"]: p["id"] for p in await people(client)}
    assert str((await capsule_row(sessionmaker, a["id"])).person_id) == by_email["aiko@gmail.com"]
    assert str((await capsule_row(sessionmaker, b["id"])).person_id) == by_email["ben@gmail.com"]
