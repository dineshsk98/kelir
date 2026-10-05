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

- [x] **3. You can make a text capsule for someone in another city and see it scheduled**
  Becomes usable: From History, New capsule → Who (city picker, Feb 29 choice) → Message (text) → Gift (link or code) → When (birthday or now) → Preview → confirm. History shows the row: "Delivers 00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)", status Scheduled.
  Why now: This joins the engine to a real saved capsule and shows the kernel's promise (their midnight, your time) on screen. Text only, so recording doesn't hold back the delivery slice.
  PRD ref: `prd.md > Creating a capsule`, `prd.md > The Core Journey` (steps 3–8)
  Spec ref: `spec.md > Components > Capsules API`, `spec.md > Components > Web app: sender screens`, `spec.md > Components > Web app: Recorder and CityPicker` (CityPicker), `spec.md > Components > City data`, `spec.md > Data Model` (`capsules`)
  Build: `capsules` migration (with the text-or-media check constraint and `(status, deliver_at)` index), `models.py`, `schemas.py`, `GET/POST /v1/capsules`, `GET /v1/capsules/{id}`. `scripts/build_cities.py` → `frontend/public/cities.json` (GeoNames download only with your OK; hand-made fallback list otherwise). `CityPicker`, `StepNav`, `CapsuleEditor` (text message only for now), History rows with both local times and `StatusBadge`. Start `tests/test_capsules_api.py`.
  Verify (mechanical): `pytest` passes, including create → `deliver_at` equals the engine's answer, required-field validation, and owner-only access. `npm run build` passes.
  Learner check: Make a capsule for someone in Tokyo (or wherever your people are) and check that the history row's two times match what you'd expect.
  Commit: `Add capsule creation flow with city picker and scheduled history`

- [x] **4. Their midnight arrives: a real email lands and the private link opens the capsule**
  Becomes usable: On a scheduled capsule, press "Simulate their midnight" (Demo). A real email "<Sender> has sent you a surprise for your special day" from "<Sender> via <Name>" lands in the inbox; tapping "Open your capsule" opens a plain placeholder capsule page (message, gift). The sender's status goes Delivered → Opened on first open. Unknown links show "We couldn't find this capsule".
  Why now: This completes the kernel end to end, at the demo's "oh, that's cool" beat. Email deliverability and exactly-once delivery are the remaining big risks.
  PRD ref: `prd.md > Delivery at the recipient's midnight`, `prd.md > The birthday email`, `prd.md > The Core Journey` (steps 9–10, 12)
  Spec ref: `spec.md > Components > Delivery loop and mailer`, `spec.md > Components > Recipient API`, `spec.md > Components > Demo controls`, `spec.md > External Services and Dependencies` (Gmail SMTP), `spec.md > Important Failure Modes`
  Build: `delivery/scheduler.py` (30 s lifespan loop, `FOR UPDATE SKIP LOCKED`, hashed `token_urlsafe(32)` secret, send after commit, backoff retries up to 5, `send_error`), `mailer.py` (`SmtpMailer`, `ConsoleMailer`), `email_templates.py`, `routes/recipient.py` (`GET /v1/c/{secret}` with first-open marking, `noindex`, no-cache), `routes/demo.py`. Frontend: Demo button on the capsule, `RecipientCapsule` placeholder reveal, `NotFound`. `tests/test_delivery.py` (exactly once, two concurrent ticks, retry) and `tests/test_recipient.py` (unknown 404, open marks opened once). SMTP isn't set up yet (as of 2026-09-30): build and verify with `MAILER=console` first; the real-inbox check waits until Dinesh has the app's Gmail account and app password.
  Verify (mechanical): `pytest` passes; with `MAILER=console`, simulate-midnight prints one email whose link returns the capsule and flips status to opened only once. With `MAILER=smtp`, send one real test email each to a Gmail and an Outlook inbox and confirm (with you) they land in the inbox.
  Learner check: Schedule a capsule to an inbox you can open on your phone, press "Simulate their midnight", open the email and tap the link. Then check the sender's history says Opened.
  Commit: `Deliver capsules by email at the recipient's midnight via private link`

- [x] **5. The recipient can say thank you, and the sender sees it**
  Becomes usable: At the bottom of the capsule page, the recipient picks a preset or writes text and sends. They see "Your thank-you was sent", and the sender's history row and detail show the reply.
  Why now: This closes the core loop ("the sender saw that they did"). It's small and depends only on slice 4.
  PRD ref: `prd.md > Thank-you reply`, `prd.md > The Core Journey` (steps 11–12)
  Spec ref: `spec.md > Components > Recipient API` (reply), `spec.md > Data Model` (`replies`)
  Build: `replies` migration, `POST /v1/c/{secret}/reply` (one per capsule, ≤500 chars), reply included in `GET /v1/capsules`, reply form as the `replyPanel` node, reply shown on History and `CapsuleDetail`.
  Verify (mechanical): `pytest` passes, including reply once, second reply rejected, over-length rejected, and the reply visible in the sender's list.
  Learner check: From the capsule you opened in slice 4, send a thank-you, then check your history shows it.
  Commit: `Add thank-you replies shown in sender history`

- [x] **6. The capsule opens like a gift (the opening moment)**
  Becomes usable: The recipient page plays the staged opening (arrive → tap to open → build-up → burst with confetti → card with the sender's name → message → gift, with the code hidden until tapped and a copy button). It has Skip, mute (remembered) and synthesized sound, reduced motion gives a short fade, and replay works. You pick one of two look-and-feel token sets on `/dev/reveal`.
  Why now: "Opens as a moment" is part of the kernel, so it lands before the secondary features. The spec's Track B contract keeps it independent: it can also be built in a parallel session, which ticks only this slice.
  PRD ref: `prd.md > The opening moment`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Components > Web app: the opening`, `spec.md > Build Tracks (parallel)`, `spec.md > Look and Feel`
  Build: `reveal/stages.ts` (stage machine and timings), `Reveal.tsx`, `confetti.ts` (canvas + rAF + refs), `sfx.ts` (Web Audio), two `tokens.css` options, and the dev-only `DevReveal` page with labeled sample data. After you pick, apply the chosen tokens app-wide and swap `RecipientCapsule`'s placeholder for `<Reveal …/>`, calling `onFirstReveal`.
  Verify (mechanical): `npm run build` passes; in the browser pane, `/dev/reveal` walks through every stage in order, Skip jumps to the reveal, mute persists across reloads, and emulated `prefers-reduced-motion` shows the fade only; the real capsule link plays the opening.
  Learner check: Open `/dev/reveal`, try both looks and pick one, then open a real capsule link on your phone with sound on and say how the moment feels.
  Commit: `Add staged gift-opening reveal`

- [x] **7. You can add several photos, audio and video files to a capsule**
  Becomes usable: In the Message step, add up to 6 items in any mix: photos (≤15 MB each; on a phone the picker also offers the camera), audio (≤50 MB) and video (≤50 MB) files; remove any before saving. Preview shows them, and the recipient's opening shows them after the message: photos as a swipeable gallery, audio and video as players. A wrong type or oversized file shows a readable message.
  Why now: Multiple media changes the data model (a `capsule_media` table replaces the single media columns), so it lands before recording and editing build on it. Upload first: it proves storage, streaming and display without the browser-recording risk.
  PRD ref: `prd.md > Creating a capsule` (Message), `prd.md > The opening moment` (stage 6), `prd.md > States and Boundaries` (file can't be used)
  Spec ref: `spec.md > Components > Capsules API` (uploads, media), `spec.md > Components > Recipient API` (media), `spec.md > Data Model` (`capsule_media`), `spec.md > Components > Web app: the opening`
  Build: `capsule_media` migration (and the single-media columns dropped), `media.py` (type sniffing, size limits, range-supporting streaming), `POST /v1/uploads`, `upload_ids` on create, owner and recipient media streaming by item id, orphan-upload cleanup on start. Message-step media picker, Preview, and a media section in `Reveal`.
  Verify (mechanical): `pytest` passes, including several items accepted in order, a text-less capsule with media accepted, a 7th item, oversized or wrong-type file rejected, another sender's upload refused, owner-only preview media, recipient media with a `Range` request returning 206, and cancelled/unknown links refused. `npm run build` passes; in the browser pane, a capsule with two photos, an audio file and a video plays through the opening.
  Learner check: Make a capsule with two photos and a short video, preview it, simulate midnight and watch the opening on your phone.
  Commit: `Add multiple photos, audio and video to a capsule`

- [x] **8. You can edit or cancel a capsule until it's opened**
  Becomes usable: `CapsuleDetail` shows the preview, status, local delivery time and reply, with Edit and Cancel while Scheduled or Delivered. Edits to a delivered but unopened capsule are what the recipient sees. Once Opened, both disappear and the API refuses (409). A cancelled link shows "This capsule is no longer available." A failed send shows "Delivery trouble".
  Why now: This depends on every earlier piece (media, delivery, opening).
  PRD ref: `prd.md > Editing and cancelling (until opened)`, `prd.md > States and Boundaries` (cancelled capsule)
  Spec ref: `spec.md > Components > Capsules API` (PATCH, cancel), `spec.md > Components > Recipient API` (cancelled → 410), `spec.md > Important Failure Modes`
  Build: `PATCH /v1/capsules/{id}` (recompute `deliver_at` while scheduled; add/remove media items; `409 CAPSULE_FINAL` once opened), `POST /v1/capsules/{id}/cancel`, 410 handling on the recipient page. `CapsuleDetail` page; editor reused for editing; "Delivery trouble" badge.
  Verify (mechanical): `pytest` passes, including edit while scheduled recomputes, edit after delivery changes what the link returns, edit or cancel after open gives 409, and a cancelled link gives 410. `npm run build` passes.
  Learner check: Edit the message on a delivered-but-unopened capsule and open its link to see the new text; cancel another and open its link; confirm an opened capsule has no Edit or Cancel.
  Commit: `Add edit and cancel until opened`

- [x] **9. You can record your voice or face in the browser**
  Becomes usable: In the Message step, record audio (≤120 s) or video (≤60 s) with play-back and redo; the recording joins the capsule's media like an upload. A blocked camera or microphone shows a clear note and offers upload or text.
  Why now: A personal recording is the heart of the capsule and of the demo; the hackathon submission is the single-sender product, so this comes before anything else. It reuses slice 7's upload and display path, so it's isolated browser work (MediaRecorder formats differ between Chrome and Safari).
  PRD ref: `prd.md > Creating a capsule` (Message: recorded, played back, redone), `prd.md > States and Boundaries` (recording not allowed)
  Spec ref: `spec.md > Components > Web app: Recorder and CityPicker` (Recorder)
  Build: `Recorder` component (MediaRecorder, webm on Chrome / mp4 on Safari, length caps, play-back, redo, permission-denied state); write the real duration into recorded WebM before upload (browsers leave it out, so players show an unknown length); recordings uploaded through `POST /v1/uploads`.
  Verify (mechanical): `npm run build` passes; `pytest` passes, including a webm and an mp4 recording accepted by upload type checks; in the browser pane, a fake-device recording is captured, played back, redone, attached, and plays in the opening; a denied permission shows the note.
  Learner check: On your laptop (localhost, so the browser allows the camera), record a short video and a voice note, play them back, redo one, save, simulate midnight and watch them inside the opening. Recording from the phone needs https, which comes with hosting.
  Commit: `Add in-browser audio and video recording`

- [x] **10. The recipient's link opens the 3D gift**
  Becomes usable: Opening a capsule link plays the 3D opening from the parallel design work: a real cake photo at the centre whose candles she blows out (tap, or "Blow for real" with the microphone only if she chooses it; flames go out, smoke rises), then the cake glides to the bottom left as the gift box arrives; she unties the box, a soft burst with gentle confetti, the photocard, and a note "<Sender> wrapped up four little surprises for you" with thumbnails that each open in a closable viewer, plus its own "Say thank you".
  Why now: Dinesh asked to integrate the reveal work (built in parallel with another tool) before the remaining slices, so languages build on the opening the recipient actually sees.
  PRD ref: `prd.md > The opening moment`
  Spec ref: `spec.md > Components > Web app: the 3D opening`
  Build: `RecipientCapsule` renders `Reveal3D` and preloads its 3D chunk; review fixes in `reveal3d/`: opt-in microphone with a release that survives a late permission answer, reduced motion that doesn't reveal early (`sceneStage`), gentle confetti back at the burst, the cake waiting for the 3D view. Dinesh's revision (2026-10-02): the 3D cake replaced by a CC0 photo (`CakePhoto`, `cakeFlames.ts`), placed bottom left under the words; the auto-opening lightbox replaced by `CapsuleContents` (note, thumbnails, closable viewer, separate thank-you).
  Verify (mechanical): `npm run build` passes; in the browser pane, the real link walks cake → blow (tap) → pull → explore; the blown-out photo has no flames; the note lists every item with thumbnails (letter, video frame, voice note, gift); a viewer opens and closes by ×, Esc and a tap outside, arrows step through, focus returns to the thumbnail; "Blow for real" asks for the microphone only on tap; a thank-you sent, closed and reopened still shows as sent and appears in the sender's list.
  Learner check: Open a capsule link on your phone and laptop: blow out the candles (try "Blow for real" once), pull the ribbon, open each thumbnail, send a thank-you, and say how it feels and how it looks.
  Commit: `Open capsule links with the 3D gift`

- [x] **11. Voice notes play on a record player, videos on a projector**
  Becomes usable: Voice notes and videos open in the scene itself (lights dimmed, no box). A voice note plays on a record player seen from above at an angle: the needle moving onto the record plays it, lifting it pauses. A video is projected onto the wall by a small projector, its light fanning up to the picture, with controls along the picture's bottom. Photos and the letter keep the plain viewer.
  Why now: Dinesh asked for it alongside the slice 10 revision ("audio to be played with the recorder, video with the projector animation"); it builds on the viewer from slice 10.
  PRD ref: `prd.md > The opening moment` (stage 7)
  Spec ref: `spec.md > Components > Web app: the 3D opening`
  Build: `RecordPlayer` and `ProjectorPlayer` components, shown in a boxless "room" viewer (CSS/SVG animation driven by the media element's play/pause/timeupdate events; reduced motion keeps them still), used by the viewer for audio and video. `/dev/reveal` gains a "Voice note + video + photo" sample made in the browser, so the players can be tried without the API.
  Verify (mechanical): `npm run build` passes; in the browser pane, a recorded voice note and video play inside their players, the animation runs only while playing and stops on pause/end, the controls work by keyboard, and reduced motion shows no movement.
  Learner check: Open a capsule with a voice note and a video on your phone and say whether the record player and projector feel right.
  Commit: `Play voice notes on a record player and videos on a projector`

- [x] **12. You can write in your language, in a handwritten font that fits it**
  Becomes usable: The Message step has a language picker (English, Korean, Chinese, Japanese, Spanish, Tamil, Hindi, French, Italian, German). It sets a stylized handwritten font for that script and the `lang` attribute, in the editor, the preview and the opening. The email's subject line and "Open your capsule" button are in the capsule's language.
  Why now: It shapes what the recipient reads and hears in the opening, so it's part of the single-sender core. Fonts and copy are contained changes.
  PRD ref: `prd.md > Message languages`
  Spec ref: `spec.md > Components > Message languages and fonts`
  Build: `message_lang` on capsules (migration), allowed list in the API; fonts via Fontsource (Caveat; Nanum Pen Script; Ma Shan Zheng; Yomogi; Kavivanar; Kalam), all SIL OFL, credited in `ATTRIBUTION.md`; translated email (subject, greeting, button, closing) for the 10 languages. Each script's font CSS loads only when a message in it is shown. `/dev/reveal` gains Korean and Tamil letter samples.
  Verify (mechanical): `pytest` passes, including each language's email subject and button, unknown language rejected, and non-Latin text stored and returned unchanged. `npm run build` passes; in the browser pane, a Korean and a Tamil capsule render in their fonts (font files actually loaded) in Preview and the opening.
  Learner check: Write a short message in two languages you can read, check the fonts in Preview and in the opening, and read the email's subject in the console output.
  Commit: `Add message languages with script-specific handwritten fonts`

- [x] **13. Your regular people are saved and easy to reuse**
  Becomes usable: Every capsule you send saves (or updates) that person: name, email, birthday and city. A People page lists them by next birthday ("Aiko · in 12 days · 00:00 in Tokyo") with Make a capsule, Edit and Remove; the Who step offers "Someone you've sent to before" to fill everything in one tap.
  Why now: A convenience for one sender (not multi-user), so it comes after the capsule's content is complete. It needs capsules and the city/time-zone data from earlier slices.
  PRD ref: `prd.md > Regular recipients`
  Spec ref: `spec.md > Data Model` (`people`), `spec.md > Components > People API`
  Build: `people` migration (per sender, unique email), upsert on capsule create, `capsules.person_id`, `GET/PATCH/DELETE /v1/people` with next-birthday computed by the midnight engine; People page; Who-step picker.
  Built in two parts: **13a** (done, 2026-10-04) the table and backfill, upsert on create and on scheduled edits, the People API, and the People page with Edit and Remove; **13b** (done, 2026-10-04) Make a capsule from a person (`/capsules/new?person=`) and the Who-step picker.
  Verify (mechanical): `pytest` passes, including upsert by email (case-insensitive), next-birthday order across time zones and Feb 29, owner-only access, and removing a person keeps their capsules. `npm run build` passes; in the browser pane, a second capsule for the same person is made from the People page with the form prefilled.
  Learner check: Send to two people, open People, check the order and countdowns, then make a new capsule for one of them from there.
  Commit: `Add saved people with next-birthday list`

- [x] **14. The gift opens once**
  Becomes usable: The opening plays once. When they reach the open box (or skip to it), the capsule is marked Opened; from then on the link opens straight to the box, photocard and contents, on any device. Loading the page alone no longer counts as opening.
  Why now: Dinesh, 2026-10-05: an opened gift can't be reopened, and opening should happen once; it's core. It comes before the Received tab, which shows the same opened view.
  PRD ref: `prd.md > The opening moment`
  Spec ref: `spec.md > Components > Recipient API`
  Build: `GET /v1/c/{secret}` stops marking opened and returns `opened_at`; `POST /v1/c/{secret}/opened` marks it once; `Reveal3D` gains `alreadyOpened` (starts at the open box); the recipient page reports the first reveal.
  Verify (mechanical): `pytest` passes, including loading doesn't open, the opened call marks it once and is safe to repeat, and cancelled/unknown links are refused. `npm run build` passes; in the browser pane, a capsule opened once reloads straight to its contents.
  Learner check: Open a capsule, reload the link, and open it on a second device.
  Commit: `Open the gift once, then show its contents`

- [x] **15. Recipients can find their capsules again (Received)**
  Becomes usable: A recipient signs in with Google and sees every capsule sent to that email, opening each the same way (once, then its contents). Links can be lost; the account is the lasting place.
  Why now: Dinesh, 2026-10-05: "The receiver tab becomes necessary with this slice. A receiver should be able to view their capsules later. Links can be lost or destroyed." This reverses the 2026-10-02 deferral of received capsules.
  PRD ref: `prd.md > Proving it's them` (and the Received tab, to be written in 15c)
  Spec ref: `spec.md > Components > Recipient API`, `Received API`
  Dinesh, 2026-10-05: the link must also be authorized by email (a stolen link would give away a gift code); Google for Google accounts, otherwise a one-time code emailed to them, done seamlessly before the candles are blown. The app becomes two roles, sender and recipient. Exact email match. The locked page shows the sender's first name and the masked email. Only Google sign-ins can send.
  Built in three parts:
  - **15a** (done, 2026-10-05) the backend. Every link endpoint that shows or changes what's inside requires being signed in as the recipient's email, and `GET …/access` serves the locked page. Email sign-in like Claude's (Dinesh, 2026-10-05: "log in with email that gets the one time code … moves the one time code from opening the capsule to logging in"): `POST /v1/auth/email/code` and `/verify`, one account per email shared with Google, and email accounts can send too (his call). Migration 0009: emails unique and lowercased, `google_sub` optional, `email_codes`. The code email is in 10 languages, and there's `PATCH /v1/me` for the name. Until 15b, the link page can't open capsules (its API now answers 401) and the welcome page has no email sign-in yet.
  - **15b** (done, 2026-10-05) sign-in screens: "Continue with email" (code) on the welcome page with a name step for new accounts, and the same sign-in at the cake on the link page in the capsule's language, after which the opening carries on from the candles.
  - **15c** (done, 2026-10-05) Received (list, open by id with the shared once-only opening, reply and media); Sent, Received and People as tabs; the birthday email's sign-in line in 10 languages; the Who-step hint; the typo check on email sign-in; and the account-switch fix: tabs follow a sign-in or sign-out made elsewhere (Dinesh saw the second account's email over the first account's capsules). Then, at his request, an unread counter on the Received tab and in the window title.

## Hands-on Checkpoints

- [x] Early usable behavior explored — after slice 4 (the full kernel: schedule → simulate midnight → real email → opens). Dinesh tried it on 2026-09-30: opening the capsule and seeing the message "gave me a rush"; no changes requested. The real-inbox email check still waits on SMTP setup.
- [x] Slice 6 opening tried — 2026-09-30, Dinesh: "decent v1"; build-up not enough (lengthened and intensified); the separate thank-you card is important. The look-and-feel pick (Sunrise vs Midnight, photocard style) moved to the separate design session; Sunrise stays the default until then.
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

Scope changes Dinesh raised after slice 5 were agreed on 2026-10-02 and are now slices 12–13 (message languages, saved people). Received capsules (multi-user) and UI translation of the app's own text are deferred past the hackathon.

Folded into slice 6 (receiver side): less text on screen, a designed recipient experience, the thank-you as its own container.

Refinements Dinesh asked for during slice 3's learner check (2026-09-30), to do in the revision round:

- [x] Birthday day/month picker: refine the UI/UX (currently two plain dropdowns). Done 2026-10-05: month and day as tap grids (`BirthdayFields.tsx`); awaiting Dinesh's look.
- [x] Message: accept the placeholder text with Tab (like inline text prediction). Keep the handwritten font and the placeholder wording.
- [ ] Recipient email: tighten validation; showing the error when Next is pressed stays as is. Built early, in slice 3: stricter format (browser and API), "Did you mean …?" typo hint, and a server-side MX lookup on Next and on save. Awaiting Dinesh's retry.
- [x] City search shortcuts and aliases: abbreviations such as "nyc" → New York City and "la" → Los Angeles, and alternate/former names such as "bangalore" ↔ Bengaluru (GeoNames has alternate names that can feed this).
- [x] Better thank-you preset wording (still birthday-focused). Done 2026-10-05: all four reworded to mention the birthday and a fifth added ("first to wish me"), in 10 languages (`backend/app/replies.py`); awaiting Dinesh's read of the wording.
- [ ] UI/UX polish across every screen with the look chosen in slice 6; less text on screen. Less text done 2026-10-05 (subtitles and hints trimmed); the look (Sunrise vs Midnight) is still Dinesh's pick.
- [x] Mobile/portrait layout across every screen (done 2026-10-05 for the sender screens: header, step bar, People; welcome and editor checked at 375px; the 3D opening has its own portrait rules and was not re-audited). The welcome page is now a desktop split (sign-in left, about right, built 2026-10-05) and is not yet designed for portrait; its stacked fallback below 800px is only a stopgap. Address together with the polish pass.
- [x] People as trading cards, not a plain list (done 2026-10-05), after the TCG reference Dinesh picked: ornate foil frame, a gem for days-to-go, an arched picture window holding an initials placeholder, a name ribbon, a parchment panel, birthday and collector-number orbs, a holo sheen on the next birthday; Edit and Remove under the card (`People.tsx`, `People.css`, `Avatar.tsx`). Light and Midnight; two across on phones.
- [x] Illustrated gift unwrap: explored 2026-10-05 (reference: Dribbble "Unwrapping the present"; drawn from scratch) and dropped. Dinesh decided to keep the existing 3D gift box and its opening animation as they are. The exploration (`reveal/UnwrapArt.tsx`, its preview at `/dev/reveal`) is not used by the app.
- [ ] Real photos for people (upload, crop, show on the cards and in the capsule editor): needs a photo field on a person, storage and tests. The placeholder avatar is built to be replaced.
- [x] History list redesign: scrollable container and filters (e.g. by status). Done 2026-10-05 (`History.tsx`, `History.css`): status chips with counts, empty ones hidden, the list scrolls inside its own box.
- [x] City picker inline completion: as each character is typed, the top prefix match fills in ahead of the cursor as ghost text with a short animation (trie-style prefix search), accepted with Tab.

- [ ] Hosting on a server. Prepared 2026-10-05, host-agnostic: `Dockerfile`, `docker-compose.yml` (Postgres, the app, Caddy for HTTPS), `Caddyfile`, `deploy.env.example`, `DEPLOY.md`. Not yet done: choosing a host, creating the machine and domain, a Gmail app password, the first `docker compose up` (the image has never been built: Docker isn't installed on this laptop), and the checks in `DEPLOY.md`.

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

- Slice 12 follow-up (2026-10-04), at Dinesh's request: the recipient's whole opening (titles, buttons, photocard, viewers, players, gift, thank-you panel) follows the capsule's language, and the thank-you has its own language picker (`replies.lang`, migration 0007). Automatic language/keyboard detection was wanted but left for later: the dropdown is fine for the demo.
- Slice 13 split into 13a and 13b (2026-10-04). Dinesh's calls: fill People from existing capsules; keep a person updated when a scheduled capsule is edited; don't remember a per-person language; soonest birthday first by their midnight, ties by name.

- Slice 11 redone (2026-10-02): the first build (a cassette deck and a projector inside the viewer box) missed what Dinesh meant. From his two reference images: play them in the scene itself, a turntable seen from above at an angle whose needle is the play/pause, and a video projected on the wall by a small projector.
- Slice 10, third look (2026-10-02): the birthday tune loops while the capsule is open and ducks under every other sound (including her voice notes and videos), then swells back. An https dev server for phone testing was added and then taken out again at Dinesh's request ("that will be handled when link is hosted"): phone camera/microphone checks wait for the hosted https app.

- Slice 10, Dinesh's second look (2026-10-02): smoother blow-out (flames fade and smoke rises in place for 1 s, then a slow 1.6 s glide; `cake_aside` 1 s → 2.6 s); applause when the candles go out and a synthesized "Happy Birthday" piano tune; a compact contents note on phones (a quarter of the screen instead of over 40%, one swipeable row of thumbnails, and the title hidden once open because it sat on the photocard). "Blow for real" was missing on his phone because phones only allow the microphone on https (the dev page over Wi-Fi is http); it appears on localhost and will on the hosted https app.

- Slice 10 revised after Dinesh's look (2026-10-02): a realistic cake photo instead of the 3D cake ("use a good image from the internet"), placed bottom left under the words; the lightbox that opened by itself and couldn't be closed replaced by a "<Sender> wrapped up … for you" note with thumbnails and a closable viewer. He asked for two photos in a dropdown; only the CC0 dark-background one (Annie Spratt) could have its flames painted out cleanly, so the second (roses on cream frosting) was dropped. The tape-recorder and projector players became slice 11; languages 12, people 13.

- Inserted slice 10 (the 3D opening on the recipient page); languages became 11 and people 12 — Dinesh: "do the reveal changes now". His calls on the parallel design work: the candle's microphone is opt-in ("Blow for real") rather than asked for automatically; keep the softer burst (no shake) and add the confetti back. He notes the 3D look is still far from what he has in mind and is for the design session; this slice only makes it the real opening and fixes what review found.

- Recorder: added the `fix-webm-duration` npm package (MIT, no dependencies) instead of hand-writing a WebM header patcher, and record without a timeslice so Chrome writes the length itself. The browser pane blocks real cameras, so its recording checks used a synthetic camera and microphone (canvas + oscillator) in place of `getUserMedia`; the blocked path was checked against the pane's real refusal.

- Reprioritized for a single-sender submission: recording moved up to 9, languages 10, people 11; the received-capsules slice (Sent | Received tabs, `/v1/received`) left the POC and is deferred — Dinesh, 2026-10-02: "multi tenant is not the mvp. single user is the hackathon submission. so move the core like personal video recording up the scope order". Recipients still need no account; the private email link is the only way to open a capsule.

- Added `GET /v1/config` (returns the non-secret Google client ID) — the web app needs the client ID to render the Google button, and serving it from the API keeps `.env` the single place it's set instead of duplicating it as a Vite variable.
- Added `POST /v1/delivery-preview` — the When step must show the exact delivery moment before saving, and only the server's midnight engine can compute it correctly (DST gaps, Feb 29); duplicating that in the browser would risk the two disagreeing.
- City list is ~4,200 cities (not 1–2k) — pop. ≥150k plus capitals left gaps: whole time zones such as America/St_Johns (UTC−3:30) had no city. It now also keeps the largest city of every zone; 227 KB (≈70 KB gzipped). Zones with no town of 15k+ people (e.g. Australia/Eucla) remain absent; the picker suggests choosing a nearby city in the same zone. GeoNames credit is in `ATTRIBUTION.md` until the README exists.
- Added slices 9 (received capsules: multi-user is core), 10 (saved people) and 11 (message languages with script-specific fonts; email subject and button in the capsule's language); recording moved to 12; edit/cancel became 8 — Dinesh, 2026-10-02: "Multi user, multi capsules sent and received from different users is a core functionality. This app is not 1-1."
- Sessions: a browser-session cookie (cleared on close) plus a 12-hour limit from sign-in, instead of a 30-day cookie — Dinesh: "log out on close", then "set session cookie to 12 hours" (2026-10-02).
- Multiple media per capsule (up to 6 photos/audio/video items, ordered) with a `capsule_media` table instead of single `media_*` columns; old slice 7 split into 7 (upload + display) and 8 (browser recording); edit/cancel became slice 9 (renumbered on 2026-10-02: edit/cancel 8, recording 12) — Dinesh chose multiple pieces of media per capsule after the slice 6 check.
- Look-and-feel pick moved out of slice 6 to the separate design session (with photocard-style options) — Dinesh's call after trying the opening; both token sets stay in `tokens.css`, `APP_THEME` stays `sunrise` until then.
- Build-up lengthened from 1.4 s to 2.4 s and intensified (dimming, energy rings, swelling rattle, accelerating heartbeat sound) — Dinesh: "build up is not enough".
- Photo added back as a message media kind (slice 7, PRD, spec, scope) — Dinesh asked for image as well as audio and video after the slice 6 check; the original scope had it, the PRD had dropped it.
- Thank-you presets live on the server (`backend/app/replies.py`) and come with the capsule; a reply stores the preset's key, so the wording can change later without touching the database. Replying also counts as opening (exactly once), for the case where the reply arrives without the capsule ever being loaded.
- Email sending is a separate at-least-once queue after the exactly-once delivery transition (new `next_send_at`, `emailed_at` columns, migration `0003`) — the spec's "retry with backoff" can't resend the same link because only its hash is stored, so each attempt issues a fresh link under a short lease.
- "Send now" (and a birthday that has already begun) runs a delivery tick right after saving, instead of waiting up to 30 s for the loop — the PRD says Send now delivers immediately.
- Capsule pages (`/c/…`) also send `Referrer-Policy: no-referrer` — otherwise opening a gift link would hand the private capsule URL to the gift site in the `Referer` header.
- `PublicConfig` gained `demo_mode` (non-secret) so the history page knows whether to show the Demo button.
- Added `POST /v1/email-check` and an MX lookup on capsule create (`dnspython`) — Dinesh asked for real "can this domain receive mail" validation, not just format. It doesn't block when DNS can't be reached (offline demo), only when a domain definitely can't receive mail.
- `index.html` served with `Cache-Control: no-cache`, hashed `assets/` as immutable — during slice 3 checks the browser kept a cached `index.html` pointing at the previous build.
- React Router 6 → 7 (`react-router-dom@^7.18.4`) — `npm audit` flagged two moderate advisories affecting every 6.x release (open redirect via backslash in `<Link>`/`useNavigate`; SSR hydration). Neither was reachable in this app, but v7 is a drop-in for our usage and clears the audit.
- PostgreSQL 14 → 18 in `spec.md` — both were installed; Dinesh chose to keep 18 and remove 14. Nothing in the app depends on the version.
- Added a root `pytest.ini` — pytest run from the repo root didn't see `backend/pyproject.toml`, so imports and async test settings were missing there.

