"""Sign-in and sessions (prd.md > Sign-in and history)."""

from google.oauth2 import id_token
from sqlalchemy import func, select

from app.auth import SESSION_COOKIE
from app.config import Settings, get_settings
from app.main import app
from app.models import Sender

CLAIMS = {
    "sub": "google-sub-123",
    "email": "sender@example.com",
    "email_verified": True,
    "name": "Sam Sender",
}


def fake_google(monkeypatch, claims=CLAIMS):
    seen = {}

    def verify(credential, request, audience, clock_skew_in_seconds=0):
        seen["audience"] = audience
        seen["clock_skew"] = clock_skew_in_seconds
        if credential != "good-token":
            raise ValueError("Wrong number of segments in token")
        return dict(claims)

    monkeypatch.setattr(id_token, "verify_oauth2_token", verify)
    return seen


async def test_me_requires_sign_in(client):
    r = await client.get("/v1/me")
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "NOT_SIGNED_IN"


async def test_tampered_cookie_is_rejected(client):
    client.cookies.set(SESSION_COOKIE, "not-a-real-signed-value")
    assert (await client.get("/v1/me")).status_code == 401


async def test_sign_in_without_client_id_is_not_configured(client):
    app.dependency_overrides[get_settings] = lambda: Settings(google_client_id="")
    r = await client.post("/v1/auth/google", json={"credential": "anything"})
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "SIGN_IN_NOT_CONFIGURED"


async def test_bogus_credential_is_rejected(client, monkeypatch):
    fake_google(monkeypatch)
    r = await client.post("/v1/auth/google", json={"credential": "bogus"})
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "INVALID_GOOGLE_CREDENTIAL"
    assert SESSION_COOKIE not in r.cookies


async def test_unverified_email_is_rejected(client, monkeypatch):
    fake_google(monkeypatch, {**CLAIMS, "email_verified": False})
    r = await client.post("/v1/auth/google", json={"credential": "good-token"})
    assert r.status_code == 401


async def test_sign_in_creates_sender_and_session(client, monkeypatch, settings):
    seen = fake_google(monkeypatch)
    r = await client.post("/v1/auth/google", json={"credential": "good-token"})
    assert r.status_code == 200
    assert r.json()["email"] == "sender@example.com"
    assert seen["audience"] == settings.google_client_id  # token must be for our app
    assert seen["clock_skew"] >= 5  # a laptop clock slightly behind Google's must not fail sign-in
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie
    assert "Max-Age" not in cookie and "expires" not in cookie.lower()  # ends when the browser closes

    me = await client.get("/v1/me")
    assert me.status_code == 200
    assert me.json()["name"] == "Sam Sender"


async def test_signing_in_again_finds_the_same_sender(client, monkeypatch, sessionmaker):
    fake_google(monkeypatch)
    first = await client.post("/v1/auth/google", json={"credential": "good-token"})
    await client.post("/v1/auth/logout")

    fake_google(monkeypatch, {**CLAIMS, "name": "Sam S."})
    second = await client.post("/v1/auth/google", json={"credential": "good-token"})
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["name"] == "Sam S."
    async with sessionmaker() as s:
        assert await s.scalar(select(func.count()).select_from(Sender)) == 1


async def test_session_expires_12_hours_after_sign_in(client, monkeypatch, settings):
    import itsdangerous.timed

    fake_google(monkeypatch)
    signed_in_at = 2_000_000_000
    monkeypatch.setattr(itsdangerous.timed.time, "time", lambda: signed_in_at)
    await client.post("/v1/auth/google", json={"credential": "good-token"})

    monkeypatch.setattr(itsdangerous.timed.time, "time", lambda: signed_in_at + 12 * 3600 - 60)
    assert (await client.get("/v1/me")).status_code == 200  # 11h59m later: still signed in
    monkeypatch.setattr(itsdangerous.timed.time, "time", lambda: signed_in_at + 12 * 3600 + 60)
    assert (await client.get("/v1/me")).status_code == 401  # 12h01m later: signed out
    assert settings.session_hours == 12


async def test_sign_out_ends_the_session(client, monkeypatch):
    fake_google(monkeypatch)
    await client.post("/v1/auth/google", json={"credential": "good-token"})
    assert (await client.get("/v1/me")).status_code == 200
    r = await client.post("/v1/auth/logout")
    assert r.status_code == 204
    assert (await client.get("/v1/me")).status_code == 401


async def test_web_app_is_served_with_cache_rules(client, settings, tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html>app")
    (dist / "assets" / "index-abc123.js").write_text("js")
    (tmp_path / "secret.txt").write_text("outside the web app")
    settings.frontend_dist = dist

    for path in ("/", "/history", "/capsules/new"):
        r = await client.get(path)
        assert r.text == "<!doctype html>app" and r.headers["cache-control"] == "no-cache"
    r = await client.get("/assets/index-abc123.js")
    assert r.headers["cache-control"] == "public, max-age=31536000, immutable"
    r = await client.get("/assets/..%2F..%2Fsecret.txt")  # resolves to tmp_path/secret.txt
    assert r.text == "<!doctype html>app"  # traversal falls back to the app, never the file


async def test_unknown_api_path_is_json_404_not_the_web_app(client):
    r = await client.get("/v1/nope")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/json")
