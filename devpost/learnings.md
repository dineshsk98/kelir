# Build Learnings

Bugs and surprises hit while building, why they happened, and how they were fixed.
Newest first. Each entry: **Symptom** (what we saw) → **Cause** (the real reason) →
**Fix** (what changed, with files) → **Lesson** (what to do next time).

---

## 2026-10-02 · "Blow for real" missing on the phone
- **Symptom:** Dinesh, on his phone on `/dev/reveal`: only "Blow out the candles" showed; on the laptop both buttons did.
- **Cause:** browsers only offer the microphone (`navigator.mediaDevices`) on secure pages. `localhost` counts as secure, but the dev server opened from the phone over Wi-Fi is plain `http://<laptop-ip>`, so the page correctly hid the button. Not a bug, but surprising.
- **Fix:** none needed in code; noted in `devpost/checklist.md`. It will appear on phones once the app is hosted on https (a local https dev server was tried and dropped as not worth it before hosting).
- **Lesson:** camera and microphone features can only be checked on a phone over https, so say so when handing over a phone check.

## 2026-10-02 · On phones, the title sat on top of the photocard
- **Symptom:** after making the contents note compact (it had been covering the scene), the browser pane showed "Happy birthday, Aiko / from Sam" printed across the photocard.
- **Cause:** in portrait the title sits at the top, and that's exactly where the photocard rises to. The big note used to hide the overlap.
- **Fix:** in portrait, the title fades out once the box is open, since the photocard already says the same thing (`frontend/src/reveal3d/Reveal3D.css`).
- **Lesson:** shrinking one element can reveal overlaps it was hiding, so re-check the whole screen, not just the element changed.

## 2026-10-02 · The full-screen viewer was trapped inside the frosted note
- **Symptom:** in the browser pane, opening a thumbnail drew the "full-screen" viewer only inside the small note card.
- **Cause:** the note uses `backdrop-filter` for its frosted glass. Like `transform` and `filter`, that makes an element the containing block for its `position: fixed` descendants, so "fixed, inset 0" meant "fill the note".
- **Fix:** the viewers render through a React portal into the opening's root element (`createPortal` in `frontend/src/reveal3d/CapsuleContents.tsx`).
- **Lesson:** overlays belong in a portal, never inside a component with `transform`, `filter` or `backdrop-filter`.

## 2026-10-02 · A landscape rule that never applied
- **Symptom:** in landscape, the contents note stayed centred instead of moving to the left column; its computed `left` was the portrait value.
- **Cause:** the landscape override sat in a media query *above* the note's base rule in `Reveal3D.css`. Same specificity, so the later base rule won.
- **Fix:** a separate landscape media query placed after the base rules (`frontend/src/reveal3d/Reveal3D.css`).
- **Lesson:** a media query doesn't add specificity. Overrides must come after what they override, or check computed styles early.

## 2026-10-02 · Two files whose names differ only by case
- **Symptom:** `npm run build` failed: "Already included file name … CakePhoto.ts differs from file name … cakePhoto.ts only in casing", and the dev server kept a broken hot-reload state.
- **Cause:** a helper `cakePhoto.ts` and a component `CakePhoto.tsx` in the same folder. On Windows (case-insensitive) TypeScript treats `./CakePhoto` and `./cakePhoto` as one file.
- **Fix:** the helper was renamed to `frontend/src/reveal3d/cakeFlames.ts`, and the dev server restarted.
- **Lesson:** never give two files in a folder names that differ only by case. It breaks on Windows and macOS, and in git across machines.

## 2026-10-02 · A photo's flames can only be painted out on a plain background
- **Symptom:** of the two CC0 cake photos, the dark one came out clean after painting out its flames, but the roses-on-cream one got flat or blocky patches, first with an oval fill, then with a region that flooded into the bright frosting.
- **Cause:** filling a hole from its surroundings only works when the surroundings are plain; a flame over textured, equally bright frosting has no clean edge to grow or fill from.
- **Fix:** kept the dark-background photo (`frontend/public/reveal/cake-candles.jpg`) and dropped the other; the method lives in `frontend/src/reveal3d/cakeFlames.ts`.
- **Lesson:** decide whether an image will be edited before choosing it. For "blow out the candles", choose photos where the flames sit against dark, plain space.

## 2026-10-02 · The thank-you card's words vanished in the 3D lightbox
- **Symptom:** in the browser pane, the thank-you card in the new lightbox was a white card with almost invisible text.
- **Cause:** the card keeps the app's light surface, but its text colour is inherited, and inside the 3D page that's the scene's ivory, so it was ivory on white.
- **Fix:** `.r3d .reply-panel` sets the app's text colour back (`frontend/src/reveal3d/Reveal3D.css`).
- **Lesson:** when a light component moves into a dark container, check inherited colours, not just backgrounds.

## 2026-10-02 · The cake's entrance played before the 3D scene had loaded
- **Symptom:** opening a link, the cake only appeared about 5 s in (on localhost), already in place. Its 1.5 s rise had run unseen, and on a phone it would be worse.
- **Cause:** the stage timers start when the page mounts, but three.js (about 960 KB) only began downloading at that point and the scene drew later.
- **Fix:** the recipient page starts the 3D download while the capsule loads (`preloadGiftScene`), and the first stage waits for the 3D view to report it's ready (`onReady` from the canvas's `onCreated`) in `frontend/src/reveal3d/Reveal3D.tsx`, `GiftScene.tsx` and `frontend/src/pages/RecipientCapsule.tsx`. This also means a link opened in a background tab waits until it's looked at.
- **Lesson:** an animation timeline must start from "can be seen", not from "component mounted", whenever its renderer loads asynchronously.

## 2026-10-02 · Reduced motion showed the open gift before the candle was blown out
- **Symptom:** found reviewing the parallel reveal work: with reduced motion on, the cake stages drew the opened box and risen photocard behind "Blow out the candle".
- **Cause:** the scene mapped every stage except `arrive` and `pull` to the final "explore" picture, and the new cake stages weren't added to that list.
- **Fix:** one shared `sceneStage()` in `frontend/src/reveal3d/stages.ts` lists the still stages (cake, candle, closed box); only the moving ones jump to the open box. Used by the box and the particles in `GiftScene.tsx`, and the cake skips its rise.
- **Lesson:** "everything except X" lists silently swallow new states. Name the states that are allowed instead, and keep the list in one place.

## 2026-10-02 · The candle's microphone could stay on after the candle was out
- **Symptom:** found reviewing the parallel reveal work: if she tapped "Blow out the candle" or Skip while the browser was still asking for microphone permission, the microphone was switched on afterwards and never released.
- **Cause:** the effect's cleanup ran before `getUserMedia` resolved, when there was no stream to stop yet; the stream that arrived later had no owner.
- **Fix:** a `cancelled` flag: a stream that arrives after cleanup is stopped at once. The microphone is now also opt-in ("Blow for real", Dinesh's call) instead of requested automatically (`frontend/src/reveal3d/Reveal3D.tsx`).
- **Lesson:** any async resource started in an effect needs a "was I cancelled?" check when it arrives, not just a cleanup for the case where it already has.

## 2026-10-02 · Recorded WebM: whether it has a length depends on how you record
- **Symptom:** while building the recorder, a test recording in Chromium reported a proper length (1.95 s), which contradicted the 2026-09-30 entry ("recorded WebM has no length"). Recording the same clip in chunks (`recorder.start(250)`) gave `Infinity`.
- **Cause:** the earlier entry was only half right. Current Chromium writes the Duration field when the whole recording arrives at the end (`start()` with no timeslice), but not when it's delivered in chunks. Firefox and older Chrome leave it out either way.
- **Fix:** `frontend/src/components/Recorder.tsx` records without a timeslice and, for WebM, runs `fix-webm-duration` (new dependency, MIT, no dependencies of its own) with the measured length. That library only adds the field when it's missing. Checked both paths in the browser pane: a chunked recording went from `Infinity` to 2.01 s, and real takes played through the capsule link with their lengths (0:06 video, 0:08 voice).
- **Lesson:** check a "known" browser limitation again before building around it. Browsers change, and here the way the API is called made the difference. Test both the fast path and the fallback.

## 2026-10-02 · A test dropped between a decorator and its function
- **Symptom:** `pytest` stopped at collection with "duplicate parametrization of 'data'" in `backend/tests/test_media.py`.
- **Cause:** the new recordings test was inserted right after the `@pytest.mark.parametrize` of the next test, so that decorator attached to the new test too.
- **Fix:** moved the new test above the other test's decorator.
- **Lesson:** when inserting code above a function, anchor on its decorators, not on the `def` line.

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
