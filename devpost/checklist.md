---
doc: checklist
status: approved
---

# Build Checklist

Build mode: learn
Commits: Dinesh makes every commit himself (per his global rules). The agent never commits, stages, amends or pushes, and adds no AI co-author trailer. After verifying a slice, the agent stops with the changed files, the reasons and how to test; the box is ticked once Dinesh confirms he has committed.

## Slices

- [x] **1. The midnight math is proven: any birthday + city gives the exact send instant**
  Becomes usable: A backend project with the midnight engine you can call from the command line (`python -m app.engine.schedule Asia/Tokyo 3 14`) and a passing time-zone test matrix.
  Why now: The engine is the kernel's riskiest, most exact part (half-hour zones, DST gaps, Feb 29, "birthday already started"). It's pure code, so it proves itself with no UI, DB or sign-in. This is the one allowed layer-only slice: it retires a critical risk and leaves runnable evidence. Backend bootstrapping lives here.
  PRD ref: `prd.md > Delivery at the recipient's midnight`
  Spec ref: `spec.md > Components > Midnight engine`, `spec.md > Stack`, `spec.md > File Structure`
  Build: Scaffold `backend/` (venv, `requirements.txt`, `app/` package, pytest config), `.env.example`, and root `.gitignore` additions (`uploads/`, `node_modules/`, `dist/`, venv). Implement `app/engine/schedule.py` (`celebration_date`, `start_of_local_day`, `next_delivery`, `due_now`) with `zoneinfo` + `tzdata`, plus a small `__main__` CLI. Write `tests/test_engine.py`: +5:30, +5:45, both sides of DST (US and EU), a zone where DST skips midnight, Feb 29 leap/non-leap with both prefs, birthday-today-after-midnight → now, birthday-passed → next year.
  Verify (mechanical): `pytest tests/test_engine.py` passes; the CLI prints the correct UTC and local instants for Tokyo, Kathmandu and a DST-gap case.
  Learner check: Run the CLI for someone you know (their city and birthday) and confirm the local time printed is 00:00 on their day.
  Commit: `Add midnight engine with time-zone test matrix`

- [x] **2. You can sign in with Google and land on your (empty) history**
  Becomes usable: Open `http://localhost:5173`, see the welcome page, sign in with Google, and land on History showing "Make your first capsule". Signing out and back in works.
  Why now: Every sender screen sits behind sign-in, and it depends on outside setup (your OAuth client ID). Doing it now surfaces setup problems early. Frontend and database bootstrapping live here.
  PRD ref: `prd.md > The Core Journey` (steps 1–2), `prd.md > Sign-in and history`, `prd.md > States and Boundaries` (first use)
  Spec ref: `spec.md > Components > Sign-in and sessions`, `spec.md > Data Model` (`senders`), `spec.md > Where It Runs and How Someone Tries It`, `spec.md > External Services and Dependencies` (Google Identity Services), `spec.md > Look and Feel`
  Build: `config.py`, `db.py`, Alembic with the `senders` migration, `auth.py` + `routes/auth.py` (`/v1/auth/google`, `/v1/auth/logout`, `/v1/me`), `main.py` serving `frontend/dist` with an `index.html` fallback. Scaffold `frontend/` (Vite + React + TS + Router), `vite.config.ts` proxy, `api.ts`, `GoogleButton`, `Welcome` and an empty `History`, with a neutral placeholder `styles/tokens.css` plus the bundled fonts. You create the OAuth client and fill `.env`.
  Verify (mechanical): `alembic upgrade head` succeeds on the dev DB; with `GOOGLE_CLIENT_ID` unset, `/v1/me` returns 401 and `/v1/auth/google` rejects a bogus token; `npm run build` passes type-checking; the API serves the built app at `/` and at a deep link.
  Learner check: Sign in with your Google account, see your name and the empty history, sign out, sign back in.
  Commit: `Add Google sign-in, welcome page and empty history`

- [ ] **3. You can make a text capsule for someone in another city and see it scheduled**
  Becomes usable: From History, New capsule → Who (city picker, Feb 29 choice) → Message (text) → Gift (link or code) → When (birthday or now) → Preview → confirm. History shows the row: "Delivers 00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)", status Scheduled.
  Why now: This joins the engine to a real saved capsule and shows the kernel's promise (their midnight, your time) on screen. Text only, so recording doesn't hold back the delivery slice.
  PRD ref: `prd.md > Creating a capsule`, `prd.md > The Core Journey` (steps 3–8)
  Spec ref: `spec.md > Components > Capsules API`, `spec.md > Components > Web app: sender screens`, `spec.md > Components > Web app: Recorder and CityPicker` (CityPicker), `spec.md > Components > City data`, `spec.md > Data Model` (`capsules`)
  Build: `capsules` migration (with the text-or-media check constraint and `(status, deliver_at)` index), `models.py`, `schemas.py`, `GET/POST /v1/capsules`, `GET /v1/capsules/{id}`. `scripts/build_cities.py` → `frontend/public/cities.json` (GeoNames download only with your OK; hand-made fallback list otherwise). `CityPicker`, `StepNav`, `CapsuleEditor` (text message only for now), History rows with both local times and `StatusBadge`. Start `tests/test_capsules_api.py`.
  Verify (mechanical): `pytest` passes, including create → `deliver_at` equals the engine's answer, required-field validation, and owner-only access. `npm run build` passes.
  Learner check: Make a capsule for someone in Tokyo (or wherever your people are) and check that the history row's two times match what you'd expect.
  Commit: `Add capsule creation flow with city picker and scheduled history`

- [ ] **4. Their midnight arrives: a real email lands and the private link opens the capsule**
  Becomes usable: On a scheduled capsule, press "Simulate their midnight" (Demo). A real email "<Sender> has sent you a surprise for your special day" from "<Sender> via <Name>" lands in the inbox; tapping "Open your capsule" opens a plain placeholder capsule page (message, gift). The sender's status goes Delivered → Opened on first open. Unknown links show "We couldn't find this capsule".
  Why now: This completes the kernel end to end, at the demo's "oh, that's cool" beat. Email deliverability and exactly-once delivery are the remaining big risks.
  PRD ref: `prd.md > Delivery at the recipient's midnight`, `prd.md > The birthday email`, `prd.md > The Core Journey` (steps 9–10, 12)
  Spec ref: `spec.md > Components > Delivery loop and mailer`, `spec.md > Components > Recipient API`, `spec.md > Components > Demo controls`, `spec.md > External Services and Dependencies` (Gmail SMTP), `spec.md > Important Failure Modes`
  Build: `delivery/scheduler.py` (30 s lifespan loop, `FOR UPDATE SKIP LOCKED`, hashed `token_urlsafe(32)` secret, send after commit, backoff retries up to 5, `send_error`), `mailer.py` (`SmtpMailer`, `ConsoleMailer`), `email_templates.py`, `routes/recipient.py` (`GET /v1/c/{secret}` with first-open marking, `noindex`, no-cache), `routes/demo.py`. Frontend: Demo button on the capsule, `RecipientCapsule` placeholder reveal, `NotFound`. `tests/test_delivery.py` (exactly once, two concurrent ticks, retry) and `tests/test_recipient.py` (unknown 404, open marks opened once). SMTP isn't set up yet (as of 2026-09-30): build and verify with `MAILER=console` first; the real-inbox check waits until Dinesh has the app's Gmail account and app password.
  Verify (mechanical): `pytest` passes; with `MAILER=console`, simulate-midnight prints one email whose link returns the capsule and flips status to opened only once. With `MAILER=smtp`, send one real test email each to a Gmail and an Outlook inbox and confirm (with you) they land in the inbox.
  Learner check: Schedule a capsule to an inbox you can open on your phone, press "Simulate their midnight", open the email and tap the link. Then check the sender's history says Opened.
  Commit: `Deliver capsules by email at the recipient's midnight via private link`

- [ ] **5. The recipient can say thank you, and the sender sees it**
  Becomes usable: At the bottom of the capsule page, the recipient picks a preset or writes text and sends. They see "Your thank-you was sent", and the sender's history row and detail show the reply.
  Why now: This closes the core loop ("the sender saw that they did"). It's small and depends only on slice 4.
  PRD ref: `prd.md > Thank-you reply`, `prd.md > The Core Journey` (steps 11–12)
  Spec ref: `spec.md > Components > Recipient API` (reply), `spec.md > Data Model` (`replies`)
  Build: `replies` migration, `POST /v1/c/{secret}/reply` (one per capsule, ≤500 chars), reply included in `GET /v1/capsules`, reply form as the `replyPanel` node, reply shown on History and `CapsuleDetail`.
  Verify (mechanical): `pytest` passes, including reply once, second reply rejected, over-length rejected, and the reply visible in the sender's list.
  Learner check: From the capsule you opened in slice 4, send a thank-you, then check your history shows it.
  Commit: `Add thank-you replies shown in sender history`

- [ ] **6. The capsule opens like a gift (the opening moment)**
  Becomes usable: The recipient page plays the staged opening (arrive → tap to open → build-up → burst with confetti → card with the sender's name → message → gift, with the code hidden until tapped and a copy button). It has Skip, mute (remembered) and synthesized sound, reduced motion gives a short fade, and replay works. You pick one of two look-and-feel token sets on `/dev/reveal`.
  Why now: "Opens as a moment" is part of the kernel, so it lands before the secondary features. The spec's Track B contract keeps it independent: it can also be built in a parallel session, which ticks only this slice.
  PRD ref: `prd.md > The opening moment`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Components > Web app: the opening`, `spec.md > Build Tracks (parallel)`, `spec.md > Look and Feel`
  Build: `reveal/stages.ts` (stage machine and timings), `Reveal.tsx`, `confetti.ts` (canvas + rAF + refs), `sfx.ts` (Web Audio), two `tokens.css` options, and the dev-only `DevReveal` page with labeled sample data. After you pick, apply the chosen tokens app-wide and swap `RecipientCapsule`'s placeholder for `<Reveal …/>`, calling `onFirstReveal`.
  Verify (mechanical): `npm run build` passes; in the browser pane, `/dev/reveal` walks through every stage in order, Skip jumps to the reveal, mute persists across reloads, and emulated `prefers-reduced-motion` shows the fade only; the real capsule link plays the opening.
  Learner check: Open `/dev/reveal`, try both looks and pick one, then open a real capsule link on your phone with sound on and say how the moment feels.
  Commit: `Add staged gift-opening reveal with chosen look and feel`

- [ ] **7. You can send your voice or face, recorded or uploaded**
  Becomes usable: In the Message step, record audio (≤120 s) or video (≤60 s) in the browser with play-back and redo, or upload a file (≤50 MB). Preview plays it, and the recipient's opening plays it. A blocked camera or microphone shows a note and offers upload or text; a bad file shows a readable message.
  Why now: This is a large but well-understood browser and API feature. The kernel works with text already, so this enriches it rather than gating it.
  PRD ref: `prd.md > Creating a capsule` (Message), `prd.md > States and Boundaries` (recording not allowed, file can't be used)
  Spec ref: `spec.md > Components > Capsules API` (uploads, media), `spec.md > Components > Web app: Recorder and CityPicker` (Recorder), `spec.md > Components > Recipient API` (media), `spec.md > Data Model`
  Build: `media.py` (type/size checks, range-supporting streaming), `POST /v1/uploads`, `GET /v1/capsules/{id}/media`, `GET /v1/c/{secret}/media`, orphan-upload cleanup on start, `upload_id` on create. `Recorder` component, Message-step upload, media in Preview and `Reveal`.
  Verify (mechanical): `pytest` passes, including an oversized or wrong type rejected, owner-only media, recipient media with a `Range` request returning 206, and a text-less capsule with media accepted. `npm run build` passes.
  Learner check: Record a short video message, play it back, redo it once, save, simulate midnight and watch it play inside the opening on your phone.
  Commit: `Add recorded and uploaded audio/video messages`

- [ ] **8. You can edit or cancel a capsule until it's opened**
  Becomes usable: `CapsuleDetail` shows the preview, status, local delivery time and reply, with Edit and Cancel while Scheduled or Delivered. Edits to a delivered but unopened capsule are what the recipient sees. Once Opened, both disappear and the API refuses (409). A cancelled link shows "This capsule is no longer available." A failed send shows "Delivery trouble".
  Why now: This depends on every earlier piece (media replacement, delivery, opening). It's the last behavior in the PRD.
  PRD ref: `prd.md > Editing and cancelling (until opened)`, `prd.md > States and Boundaries` (cancelled capsule)
  Spec ref: `spec.md > Components > Capsules API` (PATCH, cancel), `spec.md > Components > Recipient API` (cancelled → 410), `spec.md > Important Failure Modes`
  Build: `PATCH /v1/capsules/{id}` (recompute `deliver_at` while scheduled; media replace via `upload_id`; `409 CAPSULE_FINAL` once opened), `POST /v1/capsules/{id}/cancel`, 410 handling on the recipient page. `CapsuleDetail` page; editor reused for editing; "Delivery trouble" badge.
  Verify (mechanical): `pytest` passes, including edit while scheduled recomputes, edit after delivery changes what the link returns, edit or cancel after open gives 409, and a cancelled link gives 410. `npm run build` passes.
  Learner check: Edit the message on a delivered-but-unopened capsule and open its link to see the new text; cancel another and open its link; confirm an opened capsule has no Edit or Cancel.
  Commit: `Add edit and cancel until opened`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 4 (the full kernel: schedule → simulate midnight → real email → opens)
- [ ] Look-and-feel pick — during slice 6, on `/dev/reveal`
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

Refinements Dinesh asked for during slice 3's learner check (2026-09-30), to do in the revision round:

- [ ] Birthday day/month picker: refine the UI/UX (currently two plain dropdowns).
- [ ] Message: accept the placeholder text with Tab (like inline text prediction). Keep the handwritten font and the placeholder wording.
- [ ] Recipient email: tighten validation; showing the error when Next is pressed stays as is. Built early, in slice 3: stricter format (browser and API), "Did you mean …?" typo hint, and a server-side MX lookup on Next and on save. Awaiting Dinesh's retry.
- [ ] City search shortcuts: common aliases such as "nyc" → New York City, "la" → Los Angeles.

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

- Added `GET /v1/config` (returns the non-secret Google client ID) — the web app needs the client ID to render the Google button, and serving it from the API keeps `.env` the single place it's set instead of duplicating it as a Vite variable.
- Added `POST /v1/delivery-preview` — the When step must show the exact delivery moment before saving, and only the server's midnight engine can compute it correctly (DST gaps, Feb 29); duplicating that in the browser would risk the two disagreeing.
- City list is ~4,200 cities (not 1–2k) — pop. ≥150k plus capitals left gaps: whole time zones such as America/St_Johns (UTC−3:30) had no city. It now also keeps the largest city of every zone; 227 KB (≈70 KB gzipped). Zones with no town of 15k+ people (e.g. Australia/Eucla) remain absent; the picker suggests choosing a nearby city in the same zone. GeoNames credit is in `ATTRIBUTION.md` until the README exists.
- Added `POST /v1/email-check` and an MX lookup on capsule create (`dnspython`) — Dinesh asked for real "can this domain receive mail" validation, not just format. It doesn't block when DNS can't be reached (offline demo), only when a domain definitely can't receive mail.
- `index.html` served with `Cache-Control: no-cache`, hashed `assets/` as immutable — during slice 3 checks the browser kept a cached `index.html` pointing at the previous build.
- React Router 6 → 7 (`react-router-dom@^7.18.4`) — `npm audit` flagged two moderate advisories affecting every 6.x release (open redirect via backslash in `<Link>`/`useNavigate`; SSR hydration). Neither was reachable in this app, but v7 is a drop-in for our usage and clears the audit.
- PostgreSQL 14 → 18 in `spec.md` — both were installed; Dinesh chose to keep 18 and remove 14. Nothing in the app depends on the version.
- Added a root `pytest.ini` — pytest run from the repo root didn't see `backend/pyproject.toml`, so imports and async test settings were missing there.

