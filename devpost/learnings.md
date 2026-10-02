# Build Learnings

Bugs and surprises hit while building, why they happened, and how they were fixed.
Newest first. Each entry: **Symptom** (what we saw) → **Cause** (the real reason) →
**Fix** (what changed, with files) → **Lesson** (what to do next time).

---

## 2026-10-02 · The gift box ran edge to edge on wide screens
- **Symptom:** Dinesh: the box filled the full height of the screen; on a laptop the risen photocard touched the top edge.
- **Cause:** the camera fit a circle around the subject to the whole screen height, ignoring that the title, the controls and the pull button also need room on top of the 3D view.
- **Fix:** the fit now uses only 62% of the height and 90% of the scene's width (`USABLE_HEIGHT`, `USABLE_WIDTH` in `frontend/src/reveal3d/GiftScene.tsx`), with tighter framing for the closed box.
- **Lesson:** when HTML sits on top of a 3D view, fit the camera to the space the HTML leaves, not to the whole canvas.

## 2026-10-02 · The 3D scene "vanished" when the browser pane was hidden
- **Symptom:** while checking the 3D opening, the gift box sometimes never appeared, though the stages still advanced and the box showed in other runs.
- **Cause:** not the code. The browser pane was hidden, and a hidden page runs no `requestAnimationFrame` callbacks (counted: 0 frames in 1.5 s). React Three Fiber draws only on animation frames, while the stage machine uses `setTimeout`, which keeps running. So the stages moved on while nothing was drawn.
- **Fix:** none needed in the app. Animation is checked only while the pane is visible; stage logic (skip, reduced motion, mute) is checked through the DOM, which doesn't need frames.
- **Lesson:** before debugging a "missing" canvas animation, count animation frames first. Zero frames means the page is hidden or throttled, not broken.

## 2026-10-02 · A stage class made the whole 3D opening 46 px wide
- **Symptom:** on `/dev/reveal` the new 3D opening collapsed into a thin strip on the left of the screen.
- **Cause:** the root's stage class was `r3d-${stage}`, so in the pull stage it became `r3d-pull`, the same name as the "Pull the ribbon" button's class. The root picked up the button's `display: inline-flex` and shrank to fit.
- **Fix:** stage classes are now `r3d-at-${stage}`, and the CSS uses those names (`frontend/src/reveal3d/Reveal3D.tsx`, `Reveal3D.css`).
- **Lesson:** never build class names from data in the same namespace as hand-written element classes. Give state classes their own prefix (`is-`, `at-`).

## 2026-10-02 · A race test that could never fail
- **Symptom:** the first version of "an edit and the delivery tick don't collide" passed every time, but its assertions (`status in (200, 409)`, `delivered or tick.delivered == 0`) accepted every possible outcome, including the broken ones.
- **Cause:** the test was written before deciding what *should* happen. An edit that only changes the message is allowed both before and after delivery, so the right answer is always the same: edit saved, delivered exactly once.
- **Fix:** the test now requires a 200, the edited text, `delivered`, and exactly one email, with a follow-up tick in case the edit held the lock first; repeated runs pass (`backend/tests/test_edit_cancel.py`).
- **Lesson:** for every concurrency test, write down the single correct end state first. An assertion that accepts any result proves nothing.

## 2026-09-30 · Pressing Enter in the city box submitted the form
- **Symptom:** on a fresh page, typing "tokyo" and pressing Enter straight away showed "Choose the city they live in" instead of picking Tokyo.
- **Cause:** the 227 KB city list was still loading, so there were no results to pick; the key handler returned early and the browser's default Enter action submitted the surrounding form.
- **Fix:** Enter in the city box never submits the form while no city is chosen (`frontend/src/components/CityPicker.tsx`); reproduced before and after on a fresh page.
- **Lesson:** inputs inside a `<form>` inherit "Enter submits". Any input with its own Enter meaning must opt out explicitly, especially while its data is still loading.

## 2026-09-30 · Browser-recorded WebM videos have no length
- **Symptom:** in the opening, a recorded WebM clip played, but its length read `Infinity`, so the player can't show a proper timeline.
- **Cause:** MediaRecorder writes WebM as a live stream and never goes back to fill in the duration in the file header.
- **Fix:** planned for slice 8 (recording): write the real duration into the recording before upload. Uploaded files from phones and cameras normally include it.
- **Lesson:** "it plays" isn't enough for media: check the metadata players rely on (duration, dimensions) with real recordings.

## 2026-09-30 · HEIC photos would break for most recipients
- **Symptom:** caught while designing photo support: iPhone photos can be HEIC.
- **Cause:** only Safari can display HEIC; a recipient opening the capsule in Chrome, Edge or Firefox would see a broken image.
- **Fix:** HEIC uploads are refused with a clear message (and how to switch the iPhone camera to "Most Compatible"); iPhones usually convert to JPEG when uploading to a website anyway (`backend/app/media.py`).
- **Lesson:** a file that works for the sender must also work wherever the *recipient* opens it. Check format support on the viewing side.

## 2026-09-30 · Moving to the next step would have cancelled uploads
- **Symptom:** caught in review before running: a large video still uploading would have been cancelled when the sender clicked Next.
- **Cause:** the media picker aborted its uploads when it unmounted, and it unmounts on every step change; the uploads belong to the editor, not to the step.
- **Fix:** in-flight uploads live outside the component and only stop when the sender removes that file; leftovers that never join a capsule are deleted after a day (`MediaPicker.tsx`, `media.py`).
- **Lesson:** tie a background task's lifetime to what owns it, not to whatever component started it.

## 2026-09-30 · Sound engine lost on React's development double-mount
- **Symptom:** caught in review before running: the opening's sound effects would have been silent in development.
- **Cause:** the `Sfx` object was created during render (`sfx.current ??= new Sfx()`) and closed in an unmount cleanup. React's StrictMode mounts, unmounts and re-mounts components in development; the cleanup set it to `null`, and since render doesn't run again, it was never recreated.
- **Fix:** create it inside the same `useEffect` that cleans it up (`frontend/src/reveal/Reveal.tsx`).
- **Lesson:** anything with a cleanup (audio contexts, timers, subscriptions) should be created in the effect that owns the cleanup, not during render.

## 2026-09-30 · Sound can't be verified by automated clicks
- **Symptom:** in automated browser checks, every stage, the timings and the confetti could be measured, but no sound played.
- **Cause:** browsers only start audio after a real user gesture; script-triggered clicks don't count, so the `AudioContext` stays suspended (by design).
- **Fix:** none needed; sound is checked by a person tapping the capsule. The code unlocks audio inside the tap handler.
- **Lesson:** some behavior can only be verified by hand. Say so explicitly instead of claiming it was tested.

## 2026-09-30 · A double-tapped thank-you crashed with a 500 instead of "already sent"
- **Symptom:** the new double-tap test (three simultaneous replies) got an unhandled `IntegrityError` (duplicate `capsule_id`) instead of one 201 and two 409s.
- **Cause:** the `try/except IntegrityError` only wrapped `commit()`, but SQLAlchemy *autoflushes* pending inserts before running the next statement. The reply's INSERT was sent while marking the capsule opened, one line before the `try`.
- **Fix:** the insert, the opened update and the commit all sit inside the `try` (`backend/app/routes/recipient.py`); the race test passes repeatedly.
- **Lesson:** with an ORM, the database error can surface at any later statement, not just at `commit()`. Guard the whole unit of work, and test races with truly concurrent requests; the unique constraint is what actually guarantees "one".

## 2026-09-30 · `MissingGreenlet` when returning a capsule after adding its reply relationship
- **Symptom:** after adding `Capsule.reply`, creating a capsule and "Simulate their midnight" failed with `MissingGreenlet: greenlet_spawn has not been called`.
- **Cause:** a freshly created (or refreshed) capsule hadn't loaded `reply`, so building the response tried a *lazy* database load from plain sync attribute access, which async SQLAlchemy can't do.
- **Fix:** a new capsule is created with `reply=None`; after the demo tick the capsule is refreshed with `["reply"]` explicitly (`routes/capsules.py`, `routes/demo.py`); lists load replies eagerly (`lazy="selectin"`).
- **Lesson:** in async SQLAlchemy, every relationship a response touches must already be loaded. Adding a relationship means checking every place its objects are returned, not only reads.

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
