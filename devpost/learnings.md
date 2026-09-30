# Build Learnings

Bugs and surprises hit while building, why they happened, and how they were fixed.
Newest first. Each entry: **Symptom** (what we saw) → **Cause** (the real reason) →
**Fix** (what changed, with files) → **Lesson** (what to do next time).

---

## 2026-09-30 · A failed birthday email can't be resent with the same link
- **Symptom:** designing email retries, the obvious plan ("resend the same email") was impossible.
- **Cause:** by design only the SHA-256 hash of each link's secret is stored, so after the first attempt nobody (including the server) knows the secret any more. Also, email must go out *after* the delivery transaction commits, so a crash between the two could leave a delivered capsule that never got emailed.
- **Fix:** delivery (scheduled → delivered) stays exactly-once; email is a separate at-least-once queue. Each attempt issues a fresh secret and takes a 2-minute lease; success sets `emailed_at`, failure records `send_error` and backs off 1/2/4/8 min, up to 5 attempts; an expired lease is retried after a crash (`backend/app/delivery/scheduler.py`, migration `0003`). The sender sees "Delivery trouble" meanwhile.
- **Lesson:** "exactly once" and "send an email" can't share one transaction. Separate the state change (exactly once, in the database) from the side effect (at least once, with a lease), and design retries around what you chose *not* to store.

## 2026-09-30 · Test fetched the web page instead of the API
- **Symptom:** a delivery test failed with `JSONDecodeError`; the response was `index.html`.
- **Cause:** the test followed the email's link (`/c/<secret>`, the web page) and expected JSON. The page loads the capsule from `/v1/c/<secret>`.
- **Fix:** the test calls `/v1` + the link path, with a comment explaining the two URLs (`backend/tests/test_delivery.py`).
- **Lesson:** a user-facing link and the API call behind it are different URLs; name which one a test means.

## 2026-09-30 · City picker chose the wrong city when the list opened under the mouse
- **Symptom:** typing "tokyo" and pressing Enter selected "Ōta, Tokyo" (3rd in the list) instead of Tokyo (1st, highlighted a moment earlier).
- **Cause:** each row used `onMouseEnter` to take the highlight. When the list appeared under a mouse pointer that wasn't moving, the browser still fired `mouseenter` on the row beneath it, silently moving the highlight; Enter then picked that row.
- **Fix:** rows use `onMouseMove` instead, so only real mouse movement changes the highlight (`frontend/src/components/CityPicker.tsx`). Reproduced before and after by parking the pointer over the 3rd row and typing.
- **Lesson:** in keyboard-driven dropdowns, hover should follow *movement*, not position. Test keyboard selection with the pointer resting over where the list will appear.

## 2026-09-30 · A DNS lookup alone lets typo'd emails through
- **Symptom:** while adding the "can this domain receive mail?" check, `aiko@gmial.com` passed.
- **Cause:** `gmial.com` is a real, registered typo domain with mail servers, so its MX lookup succeeds. A capsule sent there would reach a stranger.
- **Fix:** two layers: the server's MX lookup rejects domains that can't receive mail (`backend/app/email_check.py`), and the browser shows a "Did you mean aiko@gmail.com?" hint for near-misses of common domains and endings like `.con` (`frontend/src/email.ts`).
- **Lesson:** "deliverable" is not "intended". Typo detection has to come from comparing against what people usually mean, not from DNS.

## 2026-09-30 · `example.com` can't receive mail, and tests shouldn't touch DNS
- **Symptom:** adding the MX check would have failed every existing capsule test.
- **Cause:** the tests used `@example.com`, which publishes a "null MX" record (RFC 7505) meaning "accepts no mail". The lookup correctly said no. The tests also would have depended on the network.
- **Fix:** an autouse `fake_dns` fixture answers lookups in tests (every domain accepts mail unless a test says otherwise); the real lookup logic is tested separately against faked DNS answers (`backend/tests/conftest.py`, `test_email_check.py`).
- **Lesson:** keep tests off the network by faking at the boundary (`_lookup`), and test that boundary's logic on its own.

## 2026-09-30 · Google sign-in returned 401 on a laptop whose clock was behind
- **Symptom:** "Sign in with Google" worked one day and failed the next with `401 INVALID_GOOGLE_CREDENTIAL`. No code had changed.
- **Cause:** Windows had never synced the clock (`w32tm`: source "Local CMOS Clock"); it was ~2 s behind Google. Google stamps each ID token with its issue time, and `google-auth`'s `verify_oauth2_token` allows **zero** clock skew by default, so a token looked "used too early". Drift grows daily, which is why it worked before.
- **Fix:** `clock_skew_in_seconds=10` when verifying (`backend/app/auth.py`); the rejection reason is now logged server-side (`backend/app/routes/auth.py`); a test asserts the leeway is passed. Turned on automatic time sync in Windows.
- **Lesson:** anything that checks signed, time-stamped tokens must tolerate a few seconds of skew. When auth "randomly" breaks, compare the local clock with a server's `Date` header before debugging code. Log *why* a token was rejected.

## 2026-09-29 · Browser kept running the previous build
- **Symptom:** after a rebuild, UI fixes weren't visible; the page still loaded the old `index-<hash>.js`.
- **Cause:** the API served `index.html` with no cache headers, so the browser reused its cached copy, which pointed at the old hashed bundle.
- **Fix:** `index.html` is sent with `Cache-Control: no-cache`; hashed files under `assets/` are `immutable` for a year (`backend/app/main.py`), with a test.
- **Lesson:** with hashed asset names, the HTML entry point must always revalidate; only the hashed files may be cached forever.

## 2026-09-29 · A whole time zone had no city to pick
- **Symptom:** St. John's, Newfoundland (UTC−3:30) couldn't be found in the city picker.
- **Cause:** the city list kept only cities of 150k+ people plus capitals; St. John's (110k) fell below, leaving `America/St_Johns` unreachable.
- **Fix:** `scripts/build_cities.py` also keeps the largest city of every time zone (4,213 cities, 356 zones).
- **Lesson:** when filtering reference data, check coverage of what actually matters (here: every time zone), not just size.

## 2026-09-29 · Form fields had no accessible names
- **Symptom:** the accessibility tree showed the name and email inputs as bare "textbox".
- **Cause:** the `Field` component rendered a `<label>` that wasn't linked to its input (no `htmlFor`/`id`).
- **Fix:** `Field` generates an id with `useId` and passes it to its child; errors are linked with `aria-describedby`; the two-select birthday became a `fieldset` + `legend` (`frontend/src/pages/CapsuleEditor.tsx`, `CityPicker.tsx`).
- **Lesson:** read the accessibility tree (not just the screenshot) when checking a form.

## 2026-09-29 · `npm audit` flagged React Router 6
- **Symptom:** 2 moderate advisories (open redirect via backslash in `<Link>`/`useNavigate`; SSR hydration) covering every 6.x release.
- **Cause:** upstream vulnerabilities; the fix only exists in 7.18+.
- **Fix:** upgraded to `react-router-dom@^7.18.4` (drop-in for our usage); audit clean.
- **Lesson:** run `npm audit` and `pip-audit` before each commit review, even when the flagged code path isn't used yet.

## 2026-09-29 · Tests couldn't create their database
- **Symptom:** all DB tests errored with `permission denied to create database`.
- **Cause:** the app's Postgres login didn't have the `CREATEDB` privilege, and the test setup creates `<db>_test` automatically.
- **Fix:** created `capsule_test` in pgAdmin (granting *Create databases?* also works).
- **Lesson:** a least-privilege app login is right; either pre-create the test database or grant `CREATEDB` to a dev-only login.

## 2026-09-29 · pgAdmin: "unrecognized configuration parameter lc_collate"
- **Symptom:** creating a database on PostgreSQL 18 from pgAdmin failed.
- **Cause:** the only pgAdmin installed was the old copy left behind by PostgreSQL 14; PostgreSQL 16+ removed the `lc_collate` setting that old pgAdmin queries.
- **Fix:** installed a current pgAdmin 4.
- **Lesson:** uninstalling a Postgres version can leave its bundled pgAdmin behind; keep pgAdmin at least as new as the server.

## 2026-09-29 · Hand-made Postgres server refused connections and passwords
- **Symptom:** `createdb` got "connection refused", then "password authentication failed".
- **Cause:** three things: the port-change step was skipped, so the server ran on 5432 not 5434; pressing Ctrl+C in the terminal that ran `pg_ctl start` shut the server down (it stays attached to that console on Windows); and the password typed at `initdb -W` didn't match later attempts.
- **Fix:** dropped the hand-made server; used the PostgreSQL 18 service with a dedicated database via pgAdmin.
- **Lesson:** on Windows, prefer the installed Postgres service over a manual `pg_ctl` server; read `server.log` first, since it states the real reason.

## 2026-09-28 · `alembic.ini` could break after a PowerShell edit
- **Symptom:** risk found while editing: the file gained a UTF-8 byte-order mark.
- **Cause:** Windows PowerShell 5.1's `Set-Content -Encoding utf8` writes a BOM, which can break config parsers expecting the first line to be a section header.
- **Fix:** stripped the BOM; edit config files with an editor or tools that write plain UTF-8.
- **Lesson:** on Windows PowerShell 5.1, `utf8` means "UTF-8 with BOM".

## 2026-09-28 · Engine test failed on a DST switch day
- **Symptom:** one of 37 engine tests failed: expected 07:00Z, got 08:00Z for a Los Angeles birthday on 14 Mar 2027.
- **Cause:** the test was wrong, not the engine. 14 Mar 2027 is the US spring-forward day, but the switch happens at 02:00, so midnight is still PST (UTC−8).
- **Fix:** corrected the expected value with a comment (`backend/tests/test_engine.py`).
- **Lesson:** on DST switch days, midnight usually keeps the *old* offset. When a well-tested engine and a hand-computed expectation disagree, re-check the expectation first.

## 2026-09-28 · `pytest` from the repo root couldn't import `app`
- **Symptom:** `ModuleNotFoundError: No module named 'app'` when running tests from the repo root.
- **Cause:** pytest's settings lived in `backend/pyproject.toml`, which pytest only reads when run from `backend/`.
- **Fix:** `backend/conftest.py` puts `backend/` on the import path, and a root `pytest.ini` carries the same settings (including async test mode).
- **Lesson:** make the test command work from wherever people naturally run it; check both.
