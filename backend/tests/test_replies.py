"""Thank-you replies (prd.md > Thank-you reply)."""

import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select, update

from app.models import Capsule, Reply
from app.replies import REPLY_PRESETS
from tests.test_recipient import delivered_link

REPLIED_AT = datetime(2027, 3, 13, 23, 5, tzinfo=timezone.utc)


@pytest.fixture
async def link(client, sign_in, freeze_now, sessionmaker, mailer, settings):
    path, capsule = await delivered_link(client, sign_in, freeze_now, sessionmaker, mailer, settings)
    freeze_now(REPLIED_AT)
    return path, capsule


async def test_presets_come_with_the_capsule(client, link):
    body = (await client.get(link[0])).json()
    assert body["reply"] is None
    assert {p["key"]: p["texts"] for p in body["reply_presets"]} == REPLY_PRESETS


def test_no_preset_is_empty_in_any_language():
    # (that each covers every language is checked in test_message_lang.py)
    for texts in REPLY_PRESETS.values():
        assert all(t.strip() for t in texts.values())


async def test_reply_with_a_preset(client, link):
    key, texts = next(iter(REPLY_PRESETS.items()))
    text = texts["en"]  # English unless the recipient picks another language
    r = await client.post(f"{link[0]}/reply", json={"preset_key": key})
    assert r.status_code == 201
    assert r.json()["text"] == text and r.json()["lang"] == "en"
    assert r.headers["cache-control"] == "no-store"
    # Replay shows it was sent
    assert (await client.get(link[0])).json()["reply"]["text"] == text


async def test_reply_with_own_words_is_trimmed(client, link):
    r = await client.post(f"{link[0]}/reply", json={"text": "  Thank you, I love it!  "})
    assert r.status_code == 201 and r.json()["text"] == "Thank you, I love it!"


async def test_preset_in_another_language(client, link):
    key, texts = next(iter(REPLY_PRESETS.items()))
    r = await client.post(f"{link[0]}/reply", json={"preset_key": key, "lang": "ta"})
    assert r.status_code == 201 and r.json() | {"created_at": None} == {
        "text": texts["ta"],
        "lang": "ta",
        "created_at": None,
    }
    assert (await client.get(link[0])).json()["reply"]["text"] == texts["ta"]


async def test_own_words_keep_their_language(client, link):
    r = await client.post(f"{link[0]}/reply", json={"text": "정말 고마워!", "lang": "ko"})
    assert r.status_code == 201
    reply = (await client.get(link[0])).json()["reply"]
    assert (reply["text"], reply["lang"]) == ("정말 고마워!", "ko")


async def test_sender_sees_the_reply_in_history(client, link, act_as, sessionmaker):
    path, capsule = link
    await client.post(f"{path}/reply", json={"text": "Thank you!"})

    async with sessionmaker() as s:
        act_as((await s.get(Capsule, capsule["id"])).sender_id)  # back to the sender
    (row,) = (await client.get("/v1/capsules")).json()
    assert row["reply"]["text"] == "Thank you!"
    assert row["status"] == "opened"
    detail = (await client.get(f"/v1/capsules/{capsule['id']}")).json()
    assert detail["reply"]["text"] == "Thank you!" and detail["reply"]["lang"] == "en"


async def test_only_one_reply_per_capsule(client, link, sessionmaker):
    assert (await client.post(f"{link[0]}/reply", json={"text": "First"})).status_code == 201
    second = await client.post(f"{link[0]}/reply", json={"text": "Second"})
    assert second.status_code == 409 and second.json()["detail"]["code"] == "REPLY_EXISTS"
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Reply)) == 1


async def test_double_tap_still_makes_one_reply(client, link, sessionmaker):
    results = await asyncio.gather(
        *(client.post(f"{link[0]}/reply", json={"text": f"Tap {i}"}) for i in range(3))
    )
    assert sorted(r.status_code for r in results) == [201, 409, 409]
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Reply)) == 1


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"text": "   "},
        {"preset_key": "made_my_day", "text": "both"},
        {"preset_key": "not_a_preset"},
        {"text": "x" * 501},
        {"text": "hi", "extra": 1},
        {"text": "hi", "lang": "xx"},
    ],
)
async def test_invalid_replies_are_rejected(client, link, body):
    r = await client.post(f"{link[0]}/reply", json=body)
    assert r.status_code == 422, body


async def test_reply_opens_a_capsule_that_was_never_loaded(client, link, sessionmaker):
    # e.g. the API is called directly: replying still counts as opening, exactly once
    await client.post(f"{link[0]}/reply", json={"text": "Thanks"})
    async with sessionmaker() as s:
        row = await s.get(Capsule, link[1]["id"])
    assert row.status == "opened" and row.opened_at == REPLIED_AT


async def test_no_reply_to_unknown_or_cancelled_links(client, link, sessionmaker):
    assert (await client.post("/v1/c/" + "a" * 43 + "/reply", json={"text": "hi"})).status_code == 404
    async with sessionmaker() as s, s.begin():
        await s.execute(update(Capsule).where(Capsule.id == link[1]["id"]).values(status="cancelled"))
    assert (await client.post(f"{link[0]}/reply", json={"text": "hi"})).status_code == 410
