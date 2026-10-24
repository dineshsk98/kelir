"""Choosing which uploaded photo goes on the photocard (none = the default picture)."""

from tests.test_delivery import NOW, capsule_body, deliver, schedule
from tests.test_media import JPEG, M4A, PNG, upload


async def two_photos_and_a_note(client):
    photo_a = (await upload(client, JPEG, "a.jpg", "image/jpeg")).json()["id"]
    photo_b = (await upload(client, PNG, "b.png", "image/png")).json()["id"]
    note = (await upload(client, M4A, "n.m4a", "audio/mp4")).json()["id"]
    return photo_a, photo_b, note


def flags(capsule: dict) -> list[bool]:
    return [m["photocard"] for m in capsule["media"]]


async def test_no_choice_means_the_default_photocard(client, sign_in, freeze_now):
    await sign_in()
    a, b, _ = await two_photos_and_a_note(client)
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule_body(upload_ids=[a, b]))
    assert r.status_code == 201, r.text
    assert flags(r.json()) == [False, False]


async def test_the_chosen_photo_is_marked_and_no_other(client, sign_in, freeze_now):
    await sign_in()
    a, b, note = await two_photos_and_a_note(client)
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule_body(upload_ids=[a, note, b], photocard_id=b))
    assert r.status_code == 201, r.text
    assert flags(r.json()) == [False, False, True]
    assert flags((await client.get("/v1/capsules")).json()[0]) == [False, False, True]


async def test_the_choice_must_be_one_of_the_files_and_a_photo(client, sign_in, freeze_now):
    await sign_in()
    a, b, note = await two_photos_and_a_note(client)
    freeze_now(NOW)
    # a photo that is not in this capsule
    outside = await client.post("/v1/capsules", json=capsule_body(upload_ids=[a], photocard_id=b))
    assert outside.status_code == 422
    # audio cannot be a photocard picture
    audio = await client.post("/v1/capsules", json=capsule_body(upload_ids=[a, note], photocard_id=note))
    assert audio.status_code == 422
    assert "photo" in audio.json()["detail"][0]["msg"]
    # nothing was saved, and the uploads are still free to use
    assert (await client.get("/v1/capsules")).json() == []
    ok = await client.post("/v1/capsules", json=capsule_body(upload_ids=[a, note], photocard_id=a))
    assert ok.status_code == 201, ok.text


async def test_editing_can_change_or_clear_the_choice(client, sign_in, freeze_now):
    await sign_in()
    a, b, _ = await two_photos_and_a_note(client)
    freeze_now(NOW)
    made = (await client.post("/v1/capsules", json=capsule_body(upload_ids=[a, b], photocard_id=a))).json()
    assert flags(made) == [True, False]

    async def edit(**changes):
        r = await client.patch(f"/v1/capsules/{made['id']}", json=capsule_body(**changes))
        assert r.status_code == 200, r.text
        return r.json()

    assert flags(await edit(upload_ids=[a, b], photocard_id=b)) == [False, True]  # switched
    assert flags(await edit(upload_ids=[b, a], photocard_id=b)) == [True, False]  # reordered, still b
    assert flags(await edit(upload_ids=[a, b])) == [False, False]  # back to the default
    assert flags(await edit(upload_ids=[a], photocard_id=a)) == [True]  # b removed


async def test_the_recipient_is_told_which_photo(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    await sign_in(name="Sam Sender")
    a, b, _ = await two_photos_and_a_note(client)
    await schedule(client, freeze_now, upload_ids=[a, b], photocard_id=b)
    path = await deliver(sessionmaker, mailer, settings)
    await sign_in("aiko@gmail.com", "Aiko Tanaka")
    body = (await client.get(path)).json()
    assert [(m["id"], m["photocard"]) for m in body["media"]] == [(a, False), (b, True)]
