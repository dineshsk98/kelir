"""Photos, audio and video: uploads, attaching to capsules, and private streaming."""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select, update

from app import media as media_module
from app.delivery.scheduler import run_tick
from app.media import MB, remove_stale_uploads, sniff
from app.models import Capsule, CapsuleMedia
from app.routes import capsules as capsules_routes
from tests.test_delivery import DUE, NOW, capsule_body

# Minimal real file headers (the server decides the type from these bytes, not the name)
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 2000
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 2000
WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 4000
MP4 = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 4000
M4A = b"\x00\x00\x00\x18ftypM4A " + b"\x00" * 4000
MP3 = b"ID3\x04" + b"\x00" * 3000


@pytest.mark.parametrize(
    ("head", "claimed", "expected"),
    [
        (JPEG, "image/jpeg", ("image", "image/jpeg")),
        (PNG, None, ("image", "image/png")),
        (b"GIF89a" + b"\0" * 10, None, ("image", "image/gif")),
        (b"RIFF\0\0\0\0WEBPVP8 ", None, ("image", "image/webp")),
        (b"\0\0\0\x18ftypheic", None, ("image", "image/heic")),
        (WEBM, "video/webm", ("video", "video/webm")),
        (WEBM, "audio/webm;codecs=opus", ("audio", "audio/webm")),  # Chrome's audio recording
        (MP4, "video/mp4", ("video", "video/mp4")),
        (MP4, "audio/mp4", ("audio", "audio/mp4")),  # Safari's audio recording
        (M4A, None, ("audio", "audio/mp4")),
        (b"\0\0\0\x14ftypqt  ", None, ("video", "video/quicktime")),
        (MP3, None, ("audio", "audio/mpeg")),
        (b"OggS\0\x02", None, ("audio", "audio/ogg")),
        (b"RIFF\0\0\0\0WAVEfmt ", None, ("audio", "audio/wav")),
    ],
)
def test_sniffs_real_file_types(head, claimed, expected):
    result = sniff(head[:64], claimed)
    assert (result.kind, result.mime) == expected


@pytest.mark.parametrize(
    "head",
    [
        b"<!doctype html><script>alert(1)</script>",
        b'<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',  # SVG can carry script
        b"%PDF-1.7",
        b"PK\x03\x04",  # zip
        b"MZ\x90\x00",  # Windows executable
        b"",
    ],
)
def test_refuses_everything_else(head):
    assert sniff(head, "image/jpeg") is None  # a lying Content-Type doesn't help


async def upload(client, data: bytes, name="file.bin", content_type="application/octet-stream"):
    return await client.post("/v1/uploads", files={"file": (name, data, content_type)})


async def test_upload_requires_sign_in(client):
    assert (await upload(client, JPEG)).status_code == 401


async def test_upload_detects_type_and_stores_privately(client, sign_in, settings):
    sender = await sign_in()
    r = await upload(client, JPEG, "cat.png", "image/png")  # wrong name and type: bytes win
    assert r.status_code == 201
    body = r.json()
    assert (body["kind"], body["mime"], body["size_bytes"]) == ("image", "image/jpeg", len(JPEG))
    stored = settings.uploads_dir / str(sender.id) / body["id"]
    assert stored.read_bytes() == JPEG


@pytest.mark.parametrize(
    ("data", "content_type"),
    [
        (b"<html><script>alert(1)</script></html>", "image/png"),
        (b"", "image/jpeg"),
        (b"\0\0\0\x18ftypheic" + b"\0" * 100, "image/heic"),  # only Safari can show HEIC
    ],
)
async def test_bad_files_are_rejected_and_not_kept(client, sign_in, settings, data, content_type):
    await sign_in()
    r = await upload(client, data, "x.png", content_type)
    assert r.status_code == 422
    assert not any(settings.uploads_dir.rglob("*") if settings.uploads_dir.exists() else [])


async def test_oversized_photo_is_rejected_mid_upload(client, sign_in, settings, sessionmaker):
    await sign_in()
    r = await upload(client, JPEG + b"\x00" * (15 * MB), "big.jpg", "image/jpeg")
    assert r.status_code == 422
    assert "too large" in r.json()["detail"][0]["msg"]
    assert not [p for p in settings.uploads_dir.rglob("*") if p.is_file()]  # partial file removed
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(CapsuleMedia)) == 0


async def test_too_many_waiting_uploads(client, sign_in, monkeypatch):
    monkeypatch.setattr("app.routes.media.MAX_UNATTACHED_PER_SENDER", 2)
    await sign_in()
    assert (await upload(client, JPEG)).status_code == 201
    assert (await upload(client, PNG)).status_code == 201
    assert (await upload(client, JPEG)).status_code == 422


async def test_capsule_keeps_media_in_order(client, sign_in, freeze_now):
    await sign_in()
    ids = [(await upload(client, data, ct)).json()["id"] for data, ct in
           ((PNG, "image/png"), (WEBM, "video/webm"), (M4A, "audio/mp4"))]
    freeze_now(NOW)
    r = await client.post("/v1/capsules", json=capsule_body(message_text=None, upload_ids=ids))
    assert r.status_code == 201, r.text  # media alone is enough: no text needed
    assert [(m["id"], m["kind"]) for m in r.json()["media"]] == list(zip(ids, ["image", "video", "audio"]))
    listed = (await client.get("/v1/capsules")).json()[0]
    assert [m["id"] for m in listed["media"]] == ids


async def test_capsule_needs_text_or_media(client, sign_in):
    await sign_in()
    r = await client.post("/v1/capsules", json=capsule_body(message_text=None))
    assert r.status_code == 422


async def test_media_rules_on_create(client, sign_in, monkeypatch):
    sam = await sign_in("sam@example.com")
    ids = [(await upload(client, JPEG)).json()["id"] for _ in range(7)]
    too_many = await client.post("/v1/capsules", json=capsule_body(upload_ids=ids))
    assert too_many.status_code == 422
    duplicate = await client.post("/v1/capsules", json=capsule_body(upload_ids=[ids[0], ids[0]]))
    assert duplicate.status_code == 422

    used = await client.post("/v1/capsules", json=capsule_body(upload_ids=[ids[0]]))
    assert used.status_code == 201
    again = await client.post("/v1/capsules", json=capsule_body(upload_ids=[ids[0]]))
    assert again.status_code == 422  # already in another capsule

    monkeypatch.setattr(capsules_routes, "MAX_CAPSULE_BYTES", len(JPEG) * 2)
    over = await client.post("/v1/capsules", json=capsule_body(upload_ids=ids[1:4]))
    assert over.status_code == 422

    await sign_in("other@example.com")
    theirs = await client.post("/v1/capsules", json=capsule_body(upload_ids=[ids[5]]))
    assert theirs.status_code == 422  # can't use someone else's upload
    assert sam


async def test_sender_streams_own_upload_with_ranges(client, sign_in):
    await sign_in("sam@example.com")
    media_id = (await upload(client, MP4, "clip.mp4", "video/mp4")).json()["id"]

    full = await client.get(f"/v1/uploads/{media_id}")
    assert full.status_code == 200 and full.content == MP4
    assert full.headers["content-type"] == "video/mp4"
    assert full.headers["x-content-type-options"] == "nosniff"
    assert "sandbox" in full.headers["content-security-policy"]

    part = await client.get(f"/v1/uploads/{media_id}", headers={"Range": "bytes=0-99"})
    assert part.status_code == 206 and part.content == MP4[:100]
    assert part.headers["content-range"].startswith("bytes 0-99/")

    await sign_in("other@example.com")
    assert (await client.get(f"/v1/uploads/{media_id}")).status_code == 404


async def test_discard_before_saving_only(client, sign_in, settings):
    sender = await sign_in()
    keep, drop = [(await upload(client, JPEG)).json()["id"] for _ in range(2)]
    assert (await client.delete(f"/v1/uploads/{drop}")).status_code == 204
    assert not (settings.uploads_dir / str(sender.id) / drop).exists()
    await client.post("/v1/capsules", json=capsule_body(upload_ids=[keep]))
    assert (await client.delete(f"/v1/uploads/{keep}")).status_code == 409


async def test_recipient_streams_the_capsule_media(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in()
    photo = (await upload(client, JPEG, "p.jpg", "image/jpeg")).json()["id"]
    clip = (await upload(client, MP4, "c.mp4", "video/mp4")).json()["id"]
    unrelated = (await upload(client, PNG)).json()["id"]
    freeze_now(NOW)
    c = (await client.post("/v1/capsules", json=capsule_body(upload_ids=[photo, clip]))).json()
    await run_tick(sessionmaker, mailer, settings, DUE)
    (link,) = mailer.links()
    base = "/v1" + link.removeprefix("http://testserver")
    client.cookies.clear()  # the recipient has no account

    opened = (await client.get(base)).json()
    assert [(m["id"], m["kind"]) for m in opened["media"]] == [(photo, "image"), (clip, "video")]

    r = await client.get(f"{base}/media/{clip}", headers={"Range": "bytes=10-19"})
    assert r.status_code == 206 and r.content == MP4[10:20]
    assert r.headers["referrer-policy"] == "no-referrer"
    assert r.headers["x-content-type-options"] == "nosniff"
    # a file that isn't in this capsule can't be fetched through its link
    assert (await client.get(f"{base}/media/{unrelated}")).status_code == 404

    async with sessionmaker() as s, s.begin():
        await s.execute(update(Capsule).where(Capsule.id == c["id"]).values(status="cancelled"))
    assert (await client.get(f"{base}/media/{photo}")).status_code == 410


async def test_stale_uploads_are_cleaned_up(client, sign_in, sessionmaker, settings, freeze_now):
    sender = await sign_in()
    old_time = datetime(2027, 1, 1, tzinfo=timezone.utc)
    freeze_now(old_time)
    stale = (await upload(client, JPEG)).json()["id"]
    kept = (await upload(client, PNG)).json()["id"]
    await client.post("/v1/capsules", json=capsule_body(upload_ids=[kept]))
    freeze_now(old_time + timedelta(hours=23))
    recent = (await upload(client, JPEG)).json()["id"]

    async with sessionmaker() as s:
        removed = await remove_stale_uploads(s, old_time + timedelta(hours=25), settings.uploads_dir)
    assert removed == 1
    folder = settings.uploads_dir / str(sender.id)
    assert not (folder / stale).exists()
    assert (folder / kept).exists() and (folder / recent).exists()


def test_media_limits_are_what_the_spec_says():
    assert media_module.MAX_BYTES == {"image": 15 * MB, "audio": 50 * MB, "video": 50 * MB}
    assert media_module.MAX_ITEMS_PER_CAPSULE == 6
    assert media_module.MAX_CAPSULE_BYTES == 150 * MB
