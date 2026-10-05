---
doc: spec
status: approved
---

# Birthday Capsule (working title) — Technical Spec

## How This Works, In Plain Language
The whole app runs on one laptop, at $0.

- **The web app** (React) is what people see: the welcome page, the sender's history and capsule editor, and the recipient's capsule page.
- **The API** (FastAPI, Python) is the always-on program behind it. It checks who's signed in, saves capsules, stores uploaded or recorded media in a local `uploads/` folder, and serves the web app's files.
- **The database** (PostgreSQL, already installed) is the permanent record: senders, capsules, statuses and thank-you replies.
- **The delivery loop** is a small timer inside the API. Every 30 seconds it asks the database, "which capsules have reached their recipient's midnight?"
  - For each one, it marks the capsule Delivered and sends the birthday email through a free Gmail account made for the app.
  - The "exactly once" promise comes from the database itself: a capsule can only move from Scheduled to Delivered once.
- **The midnight math** lives in one small, plain Python module with no web code in it, so it can be tested on its own. It turns "14 March, Tokyo" into the exact instant to send, handling daylight saving and Feb 29.
- **The private link** in the email carries a long random secret. We store only a scrambled (hashed) copy, so a guessed link or a leaked database gives nobody a working link.

Why this shape: it keeps the pieces you already chose, but swaps every paid or hosted service for its free local equivalent. Nothing changes in the product.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.

1. **Welcome and sign-in.**
   - The sender opens `http://localhost:8000` and clicks "Sign in with Google".
   - Google's sign-in button returns a signed ID token.
   - The API checks it with Google's public keys, creates or finds the sender row, and sets a signed session cookie that ends when the browser closes, and in any case 12 hours after sign-in.
2. **History.** The web app calls `GET /v1/capsules` and lists the sender's capsules.
3. **Make a capsule.** The editor walks through the steps: Who → Message → Gift → When → Preview.
   - The city picker reads a bundled `cities.json` to get each city's time zone.
   - Recording uses the browser's microphone and camera; uploads come from a file.
   - Any media is uploaded first with `POST /v1/uploads`, which returns an `upload_id`.
   - Save then calls `POST /v1/capsules` with the details and that `upload_id`, so a capsule never exists without its media.
4. **The API schedules it.**
   - It calls `engine.next_delivery(...)` to compute `deliver_at` (a UTC instant) and stores the capsule as `scheduled`.
   - "Send now", or a birthday that has already started, gives `deliver_at = now`.
5. **Delivery.**
   - The loop claims due capsules (`deliver_at <= now`, status `scheduled`) and creates each one's link secret.
   - It saves the hash, marks the capsule `delivered`, and emails "<Sender> has sent you a surprise for your special day."
   - The email comes from "<Sender> via <Name>", with replies going to the sender.
6. **Opening.**
   - The recipient taps `…/c/<secret>`. The web app loads `GET /v1/c/<secret>` and plays the staged opening.
   - Reaching the open box (or skipping to it) calls `POST /v1/c/<secret>/opened`, which marks the capsule `opened`. From then on the link shows only the open box and its contents.
7. **Thank-you.** `POST /v1/c/<secret>/reply` stores the reply, and the sender sees it in their history.

## Stack
| Part | Choice | Why |
|---|---|---|
| Web app | React 18 + Vite + TypeScript, React Router | Dinesh's choice (right tool; the API owns request-time concerns). TypeScript is a derived detail: it catches mistakes early. |
| API | Python 3.11, FastAPI, Uvicorn; all async | Dinesh's choice (API-only; one consistent async style). |
| Database access | SQLAlchemy 2.0 (async) + asyncpg; Alembic migrations | Dinesh's choice. |
| Database | PostgreSQL 18 (already installed locally) | Dinesh's choice; $0. |
| Midnight math | Python `zoneinfo` + `tzdata` (Windows needs the `tzdata` package) | The IANA time-zone database; no fixed offsets. |
| Sign-in | Google Identity Services button + `google-auth` for ID-token verification | Only basic email/profile access, so no Google review. $0. |
| Email | `aiosmtplib` → Gmail SMTP (`smtp.gmail.com:587`, STARTTLS) with an app password | $0. Real inboxes, and genuine Gmail sending keeps spam filters friendly. |
| Opening animation | CSS transforms + a canvas for confetti, driven by `requestAnimationFrame` and refs | No heavy dependencies. Per-frame values stay out of React state. |
| Sound effects | Synthesized in the browser with the Web Audio API | Original sounds, so no licensing risk. |
| Tests | pytest + pytest-asyncio on a real Postgres test database; httpx for API tests | Dinesh's choice (tests run on real Postgres). |

Docs:
- [FastAPI](https://fastapi.tiangolo.com/) · [SQLAlchemy async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html) · [Alembic](https://alembic.sqlalchemy.org/)
- [zoneinfo](https://docs.python.org/3/library/zoneinfo.html) · [Vite](https://vite.dev/) · [React Router](https://reactrouter.com/)
- [Google Identity Services](https://developers.google.com/identity/gsi/web/guides/overview) · [verify ID tokens](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Gmail app passwords](https://support.google.com/accounts/answer/185833) · [aiosmtplib](https://aiosmtplib.readthedocs.io/)
- [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) · [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

Unverified, to check early in the build:
- Gmail's SMTP daily limit (about 500 a day for a personal account).
- Whether an app password still requires 2-Step Verification on that account (it did).

## Where It Runs and How Someone Tries It
**Runtime:** local only, $0. Hosting is optional and can be revisited in `6-ship` (a free-tier plan is possible without a domain).

**Requires:**
- Node 22, Python 3.11 and PostgreSQL 18 (all present).
- A `.env` created from `.env.example`. Dinesh fills in the secrets himself:
  - `GOOGLE_CLIENT_ID`: a free OAuth client from Google Cloud Console, with `http://localhost:8000` and `http://localhost:5173` as authorized origins
  - `SESSION_SECRET`
  - `DATABASE_URL`
  - `SMTP_USER` and `SMTP_APP_PASSWORD`: the app's own Gmail account
  - `APP_BASE_URL`: the address the email links use
  - `DEMO_MODE=true`
  - `MAILER=smtp|console`: console only prints emails, for development and tests

**Develop:**
- `backend`: `uvicorn app.main:app --reload`
- `frontend`: `npm run dev`
- Vite serves `:5173` and proxies `/v1` to `:8000`.

**Demo / recording:**
- `frontend`: `npm run build`, then `backend`: `uvicorn app.main:app --host 0.0.0.0`.
- Open `http://localhost:8000`. The API serves the built app, with an `index.html` fallback for client-side routes.
- To open the email on a phone, set `APP_BASE_URL=http://<laptop-LAN-IP>:8000` so the link works on the same Wi-Fi. The recipient page needs no camera or microphone, so plain http on the LAN is fine.

**What to show:**
1. Sign in.
2. Make a capsule for someone in Tokyo.
3. History shows "Delivers 00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)".
4. Press "Simulate their midnight".
5. The real email arrives on the phone.
6. Tap it, and the staged opening plays.
7. Send a thank-you, and it appears in the sender's history.

## Look and Feel
Carries forward `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`:
- Warm, personal and celebratory; never corporate or "automated greeting".
- The opening is paced like a game reward opening, with original art and synthesized sound only.

**Build approach (direction still open):**
1. The first front-end step builds the opening stages against CSS design tokens (`styles/tokens.css`: colors, type, radius, shadow, glow).
2. It then offers **two quick token sets** for Dinesh to pick from on screen.
3. Every other screen uses the chosen tokens.

Typography: one rounded, friendly sans for the UI and one handwritten-style display face for the card message, both free Google Fonts (e.g. Nunito + Caveat), bundled locally so the app works offline. Copy is short, warm and second-person.

## Components

### Midnight engine (`backend/app/engine/`)
Pure sync functions, no framework imports. They implement `prd.md > Delivery at the recipient's midnight`.
- `celebration_date(year, month, day, feb29_pref)`: a Feb 29 birthday uses Feb 28 or Mar 1 in non-leap years.
- `start_of_local_day(date, tz)`: the first instant whose local date is `date`. Normally 00:00; if daylight saving skips midnight, the first valid moment after the gap. Returned as UTC.
- `next_delivery(month, day, feb29_pref, tz, now)`:
  - today's local date is the celebration date → `now` (the birthday has started: send immediately)
  - otherwise → `start_of_local_day` of the next celebration date
- `due_now(send_mode, …, now)` wraps this for "Send now".

### Sign-in and sessions (`backend/app/auth.py`, `routes/auth.py`)
Implements `prd.md > Sign-in and history`.
- An account (`senders`) is one verified email. Google sign-in and an emailed one-time code both sign into it, and either can send capsules and open the ones sent to it (changed 2026-10-05; it was Google only).
- `POST /v1/auth/google {credential}`: verifies the Google ID token (audience = our client ID). It finds the account by Google `sub`; failing that by the (Google-verified) email, which links an account made with a code to Google; failing that it makes one. If the Google address changes it follows, unless another account has that email. Sets a signed, httpOnly, SameSite=Lax session cookie.
- `POST /v1/auth/email/code {email, lang}`: emails a 6-digit sign-in code (from the app, no link in it, in `lang`, which a capsule link sets to the capsule's language). The same answer whether or not the email has an account. Refuses a domain that can't receive mail (422). At most one a minute (429 `CODE_TOO_SOON` with `retry_after`) and five an hour (429 `CODE_LIMIT`) per email; a code that couldn't be emailed is removed and doesn't count (503 `CODE_NOT_SENT`).
- `POST /v1/auth/email/verify {email, code}`: checks the newest code for that email only (a new code replaces the last): 10 minutes, 5 tries (400 `CODE_WRONG` with `tries_left`, then `CODE_EXPIRED`), used once. The right code signs in, making the account the first time with a starting name from the address ("aiko.tanaka@…" → "Aiko Tanaka").
- `email_codes` stores an HMAC of each code (keyed with the session secret), so a copied database can't simply be checked against the million possible codes.
- `POST /v1/auth/logout`, `GET /v1/me`, and `PATCH /v1/me {name}` (the name recipients see; Google sign-in sets it from the Google profile).
- `current_sender` (401 if not signed in) for sender pages; `MaybeSignedIn` for capsule links, which anyone may reach.

### Capsules API (`routes/capsules.py`)
Implements `prd.md > Creating a capsule` and `prd.md > Editing and cancelling (until opened)`.

| Endpoint | What it does |
|---|---|
| `GET /v1/capsules` | The sender's list, newest first, each with its reply if any. |
| `POST /v1/capsules` | Validates the fields, computes `deliver_at`, and creates the capsule with status `scheduled`. |
| `GET /v1/capsules/{id}` | Detail and preview data (owner only). |
| `PATCH /v1/capsules/{id}` | Only while `scheduled` or `delivered`: recomputes `deliver_at` if still `scheduled`; returns `409 CAPSULE_FINAL` once opened. |
| `POST /v1/uploads` | Multipart upload of one photo, audio or video file. Checks the real file type (not just the name) and size, saves to `uploads/<sender_id>/<upload_id>` and returns `{upload_id, kind, mime}`. Create and PATCH take an ordered list of `upload_ids` (up to 6) to attach; a file never attached is removed on the next start. |
| `GET /v1/uploads/{upload_id}` | Streams one of the sender's own uploads (for Preview), with range requests for seeking. |
| `POST /v1/capsules/{id}/cancel` | Status → `cancelled`; not allowed once opened. |

### Delivery loop and mailer (`backend/app/delivery/`)
Implements `prd.md > Delivery at the recipient's midnight` and `prd.md > The birthday email`.
- **The loop** (`scheduler.py`) starts in FastAPI's lifespan and ticks every 30 s. Each tick:
  1. Claim due rows with `SELECT … FOR UPDATE SKIP LOCKED`.
  2. Generate the link secret (`secrets.token_urlsafe(32)`) and store its SHA-256 hash.
  3. Set `status = delivered` and `delivered_at` in the same transaction.
  4. After commit, send the email.
- **If sending fails,** the capsule stays delivered but records `send_error` and retries with backoff (at most 5 attempts). The sender sees "Delivery trouble" in their history.
- `mailer.py` defines one interface with two versions: `SmtpMailer` (real Gmail) and `ConsoleMailer` (prints, for development and tests).
- `email_templates.py` builds the email as HTML plus plain text:
  - From: `"<Sender name> via <Name>" <app gmail>`; Reply-To: the sender's email; the subject from the PRD
  - one "Open your capsule" button
  - no URL shorteners, no tracking pixels, no attachments

### Recipient API (`routes/recipient.py`)
Implements `prd.md > The opening moment`, `prd.md > Proving it's them` and `prd.md > Thank-you reply`.
- The secret finds the capsule (by hash): unknown → 404, cancelled → 410. Everything that shows or changes what's inside (the capsule, its media, opened, reply) also needs the viewer to be signed in as the recipient's email (Google or an emailed code, see Sign-in and sessions): not signed in → 401 `RECIPIENT_NOT_VERIFIED`, another account → 403 `WRONG_ACCOUNT`. Nothing inside is in those responses.
- `GET /v1/c/{secret}/access`: what the locked link may say: the sender's first name, the recipient's email masked (`a•••@gmail.com`), the capsule's language, whether the viewer may open it, and who they're signed in as.
- What this protects: a forwarded, shared or leaked link. A sign-in code goes to the same inbox as the link, so it doesn't protect against someone who controls that inbox.
- `GET /v1/c/{secret}`: the capsule (sender name, recipient name, message, media kind, gift, reply, `opened_at`), for the recipient only.
  - Loading changes nothing, so an interrupted first visit still gets the whole opening next time.
- `POST /v1/c/{secret}/opened`: sent when she reaches the open box or skips to it. It sets `opened_at` and status `opened` once (a conditional update on `status = 'delivered'`), and repeating it returns the first time. Unknown → 404, cancelled → 410. A reply also marks the capsule opened.
- The link page (`RecipientCapsule`) asks `/access` first. If the viewer isn't the recipient, the cake still plays (titled "A gift for you", from the sender's first name), Skip is hidden, and at the candles `Reveal3D`'s `lockedPanel` shows "Make a wish first: confirm it's you" with `SignInChoice` in the capsule's language (and "You're signed in as …, but this capsule is for a•••@…" for another account). After sign-in the contents load into the same opening, which carries on from the candles; a capsule already opened elsewhere jumps to the open box.
- Opening once (`prd.md > The opening moment`): when `opened_at` is set, `Reveal3D` starts at the open box (`alreadyOpened`), with the photocard, the contents note and the thank-you, and no cake, ribbon or Skip. The lock is per capsule, so every device shows the contents once it has been opened anywhere.
- `GET /v1/c/{secret}/media/{item_id}`: streams one of that capsule's media items and supports seeking (range requests). `no-store`, so it isn't left in the browser's cache for the next person on the device.
- `POST /v1/c/{secret}/reply {preset|text}`: one reply per capsule; text up to 500 characters.
- The page sends `noindex`, and API responses aren't cached.

### Received API (`routes/received.py`)
Implements `prd.md > Received`.
- `GET /v1/received`: capsules whose `recipient_email` is the signed-in account's (verified) email, status `delivered` or `opened`, newest delivery first: id, sender's name, `delivered_at`, `opened_at`, language, `replied`. Nothing from inside them.
- `GET /v1/received/{id}`, `POST …/opened`, `GET …/media/{media_id}`, `POST …/reply`: the link's own handlers (`capsule_out`, `opened`, `media_response`, `reply` in `routes/recipient.py`), found by id and the email instead of the secret, so opening or replying in either place counts in both.
- `GET /v1/received/unread`: `{unread}`, the delivered capsules sent to you not yet opened (declared before `/{id}`, so "unread" isn't read as an id).
- Anything else (another person's capsule, the sender's own, scheduled, cancelled, unknown) answers 404, so nothing can be probed. Signed out → 401.

### People API (`routes/people.py`)
Implements `prd.md > Regular recipients (People)`.
- Creating a capsule upserts the person by `(sender_id, email)` (one `INSERT … ON CONFLICT`, so two saves at once can't make two people) and links `capsules.person_id`. Emails are always stored lowercased (the API lowercases them; a check constraint holds the table to it), so this is case-insensitive.
- Editing a *scheduled* capsule upserts again, so the person follows the new details (a new email is a new person; the old one stays). Edits to a delivered capsule don't, since who and when are locked then and re-saving would undo changes made on the People page.
- `GET /v1/people`: the sender's people with `next_delivery` from the midnight engine (`now` if their birthday has already begun where they live), soonest first; ties by name.
- `PATCH /v1/people/{id}` (name, birthday, city; the email is who they are, so it isn't editable) and `DELETE /v1/people/{id}` (past capsules keep their own copies of the details; `person_id` becomes null). Another sender's person answers 404 `PERSON_NOT_FOUND`.
- Migration `0008` fills `people` from existing capsules (each recipient's latest capsule) and links them.
- People page (`/people`, linked from History): name and countdown ("in 12 days", counted in their time zone), when a capsule would arrive in their city and the sender's time, birthday and email; Make a capsule, Edit inline (sharing `BirthdayFields` with the editor's Who step) and Remove with a confirmation.
- Who step, new capsules only: "Someone you've sent to before" (shown when there are people) fills in name, email, birthday and city; "Someone new" clears them. It shows a person as picked only while the email is theirs. `/capsules/new?person=<id>` (from Make a capsule) fills the same way and stays on Who so the details can be checked. Editing a capsule has no picker.

### Message languages and fonts (`frontend/src/languages.ts`, `backend/app/delivery/email_copy.py`)
Implements `prd.md > Message languages`.
- `capsules.message_lang`: one of `en ko zh ja es ta hi fr it de` (default `en`).
- The backend's one list is `MESSAGE_LANGS` in `backend/app/languages.py`: the API's `MessageLang`, the database checks (`lang_check`) and each language's `<html lang>` (`html_lang`, `zh-Hans` for Chinese) come from it, and a test checks that every translated table (birthday email, code email, reply presets) covers exactly those languages. Both emails share one page shell (`_html_page` in `email_templates.py`).
- Handwritten fonts, all SIL Open Font License via Fontsource, bundled and credited in `ATTRIBUTION.md`: Caveat (en, es, fr, it, de), Nanum Pen Script (ko), Ma Shan Zheng (zh), Yomogi (ja), Kavivanar (ta), Kalam (hi). Fontsource splits large fonts by Unicode range, so browsers download only the characters used.
- The message element gets `lang` (correct line breaking, screen-reader pronunciation; `zh-Hans` for Chinese) and the font for that language, in the editor, Preview, the capsule's detail page and both openings. `useMessageLang` loads the font's CSS on first use (a separate chunk per script: the Korean, Chinese and Japanese ones are 60 to 150 KB of CSS each), and `[data-msg-lang]` redefines `--font-hand` on the element. Latin languages keep Caveat.
- The Message step has a "Written in" picker; the message box's placeholder and Preview's email line follow it.
- The whole birthday email (subject, greeting, button, closing, `<html lang>`) uses fixed translated copy for the capsule's language (`email_copy.py`; the editor's Preview repeats the subjects in `languages.ts`); the names stay as written. Translations use the informal "you" where the language has one.
- The recipient's opening (`frontend/src/recipientCopy.ts`): every word around the sender's own (titles, buttons, contents note, viewer labels, players' labels, gift, photocard, thank-you panel) has fixed copy per language. `Reveal3D` provides the capsule's language through a React context (`useRecipientCopy`; English outside it, so the v1 `<Reveal>` stays English) and sets `lang` and `data-msg-lang` on its root, so the titles and record label use the script's handwriting too. The photocard is drawn on a canvas, so `loadHandFont` loads the script's font for its exact words before drawing.
- Thank-you replies: `replies.lang` (migration `0007`, default `en`, same allowed list). Each preset has a text per language (`backend/app/replies.py`); the API returns them all (`reply_presets[].texts`), and a reply's text is resolved in its own language. The reply panel's "Written in" picker starts at the capsule's language; the textarea, the sent quote and the sender's detail page use the reply's handwriting.

### Demo controls (`routes/demo.py`)
Implements `prd.md > Delivery at the recipient's midnight` (demo).
- Only when `DEMO_MODE=true`.
- `POST /v1/demo/capsules/{id}/simulate-midnight`: owner only. Sets `deliver_at = now` and runs one tick immediately.
- The UI labels it "Demo".

### Web app: sender screens (`frontend/src/pages/`)
Implements `prd.md > Screens and Layout` (sender side).
- `Welcome`: the pitch, then `SignInChoice` (Google, or "Continue with email": email → 6-digit code, which signs in by itself once six digits are typed or pasted; a new email account is then asked "What should we call you?", `PATCH /v1/me`). A line for recipients: "Got a capsule? Sign in with the email it was sent to."
- `SignInChoice` (`components/SignIn.tsx`) and its words in 10 languages (`signInCopy.ts`): the welcome page uses English; a capsule link uses the capsule's language, including Google's own button (`locale`, though Google may still choose its own language for its button).
- `History`:
  - empty state: "Make your first capsule"
  - each row: recipient name and city, delivery in their time and the sender's (via `Intl`), status badge, and reply
- `CapsuleEditor`:
  - Steps: Who (with `CityPicker` and the Feb 29 choice) → Message (text plus `Recorder` or upload) → Gift (link or code plus note) → When → Preview.
  - It also handles editing.
- `CapsuleDetail`: the preview, status and reply, plus Edit, Cancel and the Demo button.
- `AppHeader`: Sent (`History`), Received and People as tabs, with who's signed in. The Received tab shows the unread count (a badge, and "(n) Birthday Capsule" as the window title), fetched with every page and on `ACCOUNT_CONFIRMED`.
- `Received` (`/received`) lists the capsules sent to you; `/received/:id` opens one with the same opening as the link (`CapsuleOpening` in `RecipientCapsule.tsx`, given a `CapsuleTarget` of `{link}` or `{received}`), with a "← Received" link over it.
- Account switches (`account.ts`): sign-in belongs to the browser (one cookie for every tab), so when a tab comes back into view it asks `/v1/me`. Another account → reload into it; nobody → the welcome page; the same → `ACCOUNT_CONFIRMED`, the only event on which pages refresh their lists.
- The email sign-in checks the format and offers "Did you mean …?" for likely typos (`email.ts`, as the editor), in the page's language; native browser validation is off so the translated message shows.

### Web app: `Recorder` and `CityPicker` (`frontend/src/components/`)
- `Recorder`:
  - records audio or video with `MediaRecorder` (webm on Chrome, mp4 on Safari)
  - caps length (video 60 s, audio 120 s, stopping automatically) and offers play-back and redo
  - records without a timeslice (Chrome then writes the WebM length itself) and runs `fix-webm-duration` as a fallback
  - turns the camera and microphone off as soon as a take ends, on Cancel/Discard, and when the sender leaves the step
  - if the camera or microphone is blocked, shows a note and offers upload
  - needs a secure page (https or localhost); on plain http from another device it says so and offers upload
- Photos: upload only (`<input type="file" accept="image/*" multiple>`, which offers the camera on phones). A capsule holds up to 6 media items in any mix; the opening shows them after the message (photos as a swipeable gallery, audio and video as players).
- `CityPicker`: type-ahead over bundled `cities.json` ({name, country, tz}); it shows "Tokyo, Japan · Asia/Tokyo".

### Web app: the 3D opening (`frontend/src/reveal3d/`), on the recipient page since 2026-10-02
Implements `prd.md > The opening moment`.
- React Three Fiber v8 + three.js, in a lazily loaded `GiftScene` chunk (about 960 KB, 257 KB gzipped) that the recipient page starts downloading while the capsule loads. The cake's entrance waits until the 3D view is up (`onCreated`) and the cake photo is prepared, so a slow phone or a background tab doesn't miss it.
- Stages: `cake_arrive → blow → cake_aside → arrive → pull → untie → charge → burst → rise → explore`; `blow` and `pull` wait for her. About 7.3 s of motion.
- Cake: a CC0 photo (`public/reveal/cake-candles.jpg`, credited) shown with CSS at the centre (with the title and candle buttons centred) until the candles are out, then gliding to the bottom left (transitions on `left`, `bottom`, `width` and the separate `translate` property). `cakeFlames.ts` finds its flames (bright, warm pixel blobs) and paints them out on a canvas once at load (grow from each core while clearly brighter than the surroundings, then fill from the edge colour); blowing cross-fades to that copy with CSS smoke from each wick. Real flames keep a CSS flicker glow until then. A photo whose flames sit on bright frosting can't be painted out cleanly this way, so only dark-background photos qualify.
- Sound (`sfx3d.ts`, all synthesized, no audio files): applause when the candles go out (about 90 short filtered-noise claps over 2.6 s), then "Happy Birthday" (public domain) on a synthesized piano (three harmonics, quick strike, long decay, a simple left hand), looping for as long as the capsule is open (one round, about 14 s, is scheduled ahead at a time; a late timer in a background tab restarts cleanly instead of bunching notes). It plays on its own gain bus: mute fades it (`setMuted`), and every other sound ducks it to 20% (fast) and lets it swell back (slow), including her voice notes and videos while they play (`holdDuck`). Skipping still starts the song.
- Candle: tap to blow; "Blow for real" asks for the microphone only when tapped, listens for a puff in the low frequencies, and stops the microphone when the candle is out or she moves on (including when permission arrives late).
- Burst: soft glow and lid lift, a gentle confetti shower (70 pieces), no camera shake.
- Reduced motion: `sceneStage()` maps only the moving stages (untie → rise) to the open box; cake, candle and the closed box stay as they are. No confetti.
- After opening, `CapsuleContents` shows the sender's note with thumbnails (letter excerpt, photo, video first frame, voice-note and gift icons) and a separate "Say thank you" button. Each opens in a viewer (portal into the opening's root, because the note's `backdrop-filter` would otherwise trap a `position: fixed` overlay); the thank-you viewer stays mounted while hidden so it remembers a sent reply. WebGL failure jumps straight to this note.
- Voice notes and videos open in the viewer's "room" form: no box, the scene dimmed behind, Previous/Next in the bottom corners.
- `MediaPlayers.tsx`: voice notes open in `RecordPlayer` (an SVG turntable tilted with `rotateX`; play swings the tonearm onto the outer groove and starts the sound when it lands, the arm's angle follows progress to the label edge, pause lifts it to its rest; tapping the arm or the record toggles). Videos open in `ProjectorPlayer` (the video as the projected picture with a control bar along its bottom and a full-screen button, a cylinder projector at the bottom, and a clip-path beam of conic-gradient rays whose width is measured from the video). One hook, `useMediaClock`, follows the media element's events, drives the CSS animations (running only while playing; none under `.reduced`) and reports play/stop for the tune's ducking. Controls: play/pause, a position slider (arrow keys seek; the viewer ignores arrows inside inputs) and the time. A recording without a known length disables seeking and shows only the elapsed time.
- `/dev/reveal` has a "Voice note + video + photo" sample whose voice note (a WAV chime) and video (a canvas recording) are made in the browser (`pages/devSamples.ts`).
- `/dev/reveal` keeps both openings and the backdrop switch for design work.

### Web app: the first opening (`frontend/src/reveal/`), now on `/dev/reveal` only
The 2D opening that slices 6–9 used on the recipient page:
- A stage machine: `arrive → ready → charge → burst → reveal → message → gift`, kept separate from the renderer that draws it.
- Stage timings:
  - drop: about 0.7 s
  - charge: about 2.4 s (screen dims, energy rings, swelling rattle, accelerating heartbeat)
  - burst: about 0.4 s
  - card spin-in: about 1.1 s
- Controls: Skip (jumps to reveal), mute (remembered in `localStorage`) and synthesized sound effects (`sfx.ts`).
- `prefers-reduced-motion` gives a 400 ms fade with no shake, flash or confetti.
- The gift code stays hidden until tapped, with a copy button. The thank-you panel comes last, in its own card separate from the capsule.
- (The first opening replayed on every visit; the 3D opening now plays once, see the Recipient API.)

### City data (`scripts/build_cities.py` → `frontend/public/cities.json`)
- Built once from GeoNames `cities15000`, filtered to larger cities (about 1–2k entries), keeping name, country and IANA zone.
- The source is under CC BY 4.0, so the README credits GeoNames.
- Downloading it needs Dinesh's OK at build time. The fallback is a smaller hand-made list.

## Build Tracks (parallel)
Dinesh's call: the opening animation is UI/UX work that can be separated from the core idea, so it's built **in parallel** as its own track (a separate session). Target: **3–7 days** for everything.

### Track A: Core
- Midnight engine and tests
- Database and migrations
- Capsules API and recipient API
- Delivery loop and mailer
- Google sign-in
- Sender screens
- Recorder and city picker
- Demo controls

Implements every `prd.md > Features and Behavior` heading except the visuals of `The opening moment`. Until Track B lands, `RecipientCapsule` shows a plain placeholder reveal (a card with the message, media, gift and thank-you).

### Track B: Opening animation
- Everything under `frontend/src/reveal/` plus `styles/tokens.css`.
- Built and tuned on a dev-only route, `/dev/reveal`, with **labeled sample data**. It needs no API, database or sign-in.
- This track also produces the two look-and-feel options for Dinesh to pick.

### The contract between the tracks
The only shared surface is one component:

```ts
<Reveal
  capsule={{ senderName, recipientName, messageText?, media?: { key, kind: 'image'|'audio'|'video', url }[], gift?: { kind: 'link'|'code', value, note? } }}
  replyPanel={ReactNode}   // Track A supplies the thank-you form
  onFirstReveal={() => void}
/>
```

- Mute state, sound effects, skip, reduced motion and replay live inside `Reveal`.
- Merge: `RecipientCapsule` swaps its placeholder for `<Reveal …/>`.
- Both tracks share only `package.json`, so a new front-end dependency must be named in the track's notes to avoid clashes.

## Data Model
PostgreSQL, created by Alembic migrations.

**`senders`**
- `id` (uuid, primary key)
- `google_sub` (unique; null until the account uses Google), `email` (unique, lowercased), `name`, `created_at`
- An account, whether it sends or receives. Created on first sign-in (Google or code); they persist.

**`capsules`**
- `id` (uuid, primary key), `sender_id` (foreign key → senders)
- Recipient:
  - `recipient_name`, `recipient_email`
  - `birth_month`, `birth_day`, `feb29_pref` (`FEB_28`|`MAR_1`, null unless Feb 29)
  - `city_label` (e.g. "Tokyo, Japan"), `tz` (IANA)
- Message and gift:
  - `message_text` (nullable)
  - `gift_kind` (`link`|`code`|null), `gift_value`, `gift_note`
  - media: see `capsule_media`
- Delivery:
  - `send_mode` (`birthday`|`now`), `deliver_at` (UTC)
  - `status` (`scheduled`|`delivered`|`opened`|`cancelled`)
  - `delivered_at`, `opened_at`
  - `link_token_hash` (unique, null until delivered)
  - `send_attempts`, `send_error`
  - `created_at`, `updated_at`
- Index on `(status, deliver_at)` for the loop.
- Rule: at least one of text or media, checked by the API when a capsule is created or edited (media lives in its own table, so a single-row check constraint can't see it).

**`capsule_media`** (one row per uploaded file; replaces the earlier single `media_*` columns)
- `id` (uuid: the `upload_id`), `sender_id` (owner), `capsule_id` (null until attached; cascade delete), `position` (0–5, order in the capsule)
- `kind` (`image`|`audio`|`video`), `mime`, `size_bytes`, `path`, `created_at`
- Unique `(capsule_id, position)`; at most 6 per capsule; 150 MB total per capsule.
- Limits: photos (JPEG, PNG, WebP, GIF; HEIC refused because only Safari can display it) ≤15 MB; audio (webm, ogg, mp3, m4a, wav) and video (webm, mp4, mov) ≤50 MB.

**`people`** (a sender's regular recipients)
- `id`, `sender_id`, `name`, `email` (unique per sender, case-insensitive), `birth_month`, `birth_day`, `feb29_pref`, `city_label`, `tz`, `created_at`, `updated_at`
- `capsules.person_id` (nullable, set null if the person is removed); `capsules.message_lang`

**`email_codes`** (one-time sign-in codes)
- `id`, `email`, `code_hash` (HMAC-SHA256), `attempts`, `expires_at`, `used_at`, `created_at`; indexed by `(email, created_at)`. The newest row for an email is the only valid code.

**`replies`**
- `id`, `capsule_id` (unique, so one reply per capsule), `preset_key` (nullable), `text` (nullable), `lang` (default `en`), `created_at`

**Where things live:**
- Media files go in `uploads/` on disk; the database holds only their paths.
- The session is a signed cookie. Sound mute is in `localStorage`.
- Leaving and coming back: everything is in the database, so signing back in shows the same history, and the recipient's link keeps working (after proving it's them again once the session ends).

## File Structure
```
capsule-hackathon/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan starts the delivery loop, serves frontend/dist
│   │   ├── config.py            # settings from .env (pydantic-settings)
│   │   ├── db.py                # async engine + session
│   │   ├── models.py            # senders, capsules, replies
│   │   ├── schemas.py           # request/response models
│   │   ├── auth.py              # Google ID-token check, session cookie, current_sender dependency
│   │   ├── media.py             # upload validation + streaming
│   │   ├── engine/
│   │   │   └── schedule.py      # pure midnight math (no framework imports)
│   │   ├── delivery/
│   │   │   ├── scheduler.py     # 30 s loop: claim due → deliver → email
│   │   │   ├── mailer.py        # SmtpMailer / ConsoleMailer
│   │   │   └── email_templates.py
│   │   └── routes/
│   │       ├── auth.py  capsules.py  recipient.py  demo.py
│   ├── alembic/                 # migrations
│   ├── tests/
│   │   ├── test_engine.py       # time-zone matrix (pure, fast)
│   │   ├── test_capsules_api.py # edit/cancel/final-once-opened
│   │   ├── test_delivery.py     # exactly once, concurrent ticks, retries
│   │   └── test_recipient.py    # link lookup, open, reply, cancelled/unknown
│   └── requirements.txt
├── frontend/
│   ├── index.html
│   ├── vite.config.ts           # /v1 proxy → :8000
│   ├── public/cities.json       # generated city → time zone list
│   └── src/
│       ├── main.tsx  App.tsx    # routes
│       ├── api.ts               # fetch wrapper + types
│       ├── pages/               # Welcome, History, CapsuleEditor, CapsuleDetail, RecipientCapsule, NotFound, DevReveal (Track B, dev-only)
│       ├── components/          # Recorder, CityPicker, StatusBadge, StepNav, GoogleButton
│       ├── reveal/              # stages.ts, Reveal.tsx, confetti.ts, sfx.ts
│       └── styles/              # tokens.css, global.css
├── scripts/build_cities.py
├── uploads/                     # media (gitignored)
├── devpost/                     # Devpost learning workspace
├── .env.example
├── README.md
└── LICENSE                      # OSI license: Dinesh's pick, before publishing
```

## External Services and Dependencies
All $0.

**Google Identity Services** ([overview](https://developers.google.com/identity/gsi/web/guides/overview))
- The front end loads `https://accounts.google.com/gsi/client` and renders the button with `client_id`. On success it gets a `credential` (a JWT ID token) and posts it to `/v1/auth/google`.
- The back end calls `google.oauth2.id_token.verify_oauth2_token(credential, Request(), GOOGLE_CLIENT_ID)`, which returns `sub`, `email`, `name` and `email_verified` (required to be true).
- Scopes: basic profile/email only, so no verification review is needed. The consent screen stays in "Testing" or is published as basic scopes only.
- Key: the client ID, which isn't secret. No rate limits of concern.

**Gmail SMTP** ([app passwords](https://support.google.com/accounts/answer/185833))
- `smtp.gmail.com:587`, STARTTLS, logging in with the app's Gmail address and an app password (this needs 2-Step Verification on that account).
- Limit: roughly 500 recipients a day for a personal account (to verify). Plenty for a demo.
- The From address must be the app's Gmail address. The sender's name is in the display name, and Reply-To is the sender.

**GeoNames** ([cities15000](https://download.geonames.org/export/dump/))
- A one-time download at build time, CC BY 4.0.

**fix-webm-duration** ([npm](https://www.npmjs.com/package/fix-webm-duration)), MIT, no dependencies
- Writes the measured length into a recorded WebM when the browser left it out; does nothing when the length is already there.

## Important Failure Modes
- **The email doesn't send** (wrong app password, network) → the capsule shows "Delivery trouble" in history with a retry. The ConsoleMailer lets the demo keep going.
- **Camera or microphone blocked, or an unsupported format** → a clear note and a switch to upload or text. The server rejects files that are too big or of the wrong type, with a readable message.
- **The link is unknown, cancelled or mistyped** → a friendly "We couldn't find this capsule" or "This capsule is no longer available" page.
- **The laptop is asleep at a recipient's midnight** → the next tick after waking sends it. It's late but still once. This is acceptable for a local proof of concept; hosting fixes it later.

## What Was Simplified and Why
- **Local laptop instead of a hosted server:** $0 budget, and the rules only require a video and a repo. A hosted version would add a free host, a hosted database, a wake-up pinger and object storage.
- **The delivery loop inside the API instead of a separate scheduler process:** there's one process locally. The database-level "exactly once" transition still makes two loops safe.
- **Gmail SMTP from an app-owned Gmail account instead of our own domain:** $0 and good deliverability. A custom domain (with DKIM etc.) would add a yearly cost and needs the name first.
- **Local `uploads/` folder instead of cloud storage:** $0. Cloud storage returns with hosting.
- **One thank-you reply per capsule, text only:** agreed in the PRD. Audio and video replies are deferred.
- **Handwritten TypeScript types instead of generated OpenAPI types:** fewer moving parts for a proof of concept.

## Decisions and Open Issues
**Decisions (Dinesh's):**
- Budget $0. The hackathon runs locally, with no hosting and no domain.
- The $0 local plan: a delivery loop inside the API, a local uploads folder, and real email through an app-owned Gmail account ("<Sender> via <Name>", replies to the sender).
- The stack: React + Vite, FastAPI all-async, SQLAlchemy async + Alembic, PostgreSQL.

**Derived implementation details (agent):**
- TypeScript
- the Google Identity Services button plus ID-token verification
- the 30 s tick with `SKIP LOCKED`
- hashed link secrets
- media limits: video 60 s, audio 120 s, 50 MB
- synthesized sound effects
- GeoNames city data

**The learner's own open question: how is the link secured, and how does it stay out of spam?**
- Clarified: the link carries a 256-bit random secret, stored only as a hash. It isn't guessable, and a database leak doesn't expose working links. The recipient page is `noindex`.
- Spam: sending through Gmail's own servers, a plain HTML-plus-text email with one link, no shorteners, no tracking and no attachments, and a sender name the recipient recognizes.
- To check during the build: send test emails to a Gmail and an Outlook inbox and confirm both land in the inbox.

**Open:**
- **Product name:** needed before the public video.
- **Look and feel:** two token sets proposed in the first UI step; Dinesh picks.
- **OSI license:** Dinesh's call before publishing.
- **The app's Gmail account and the Google OAuth client:** Dinesh creates both and puts the values in `.env`.
- **GeoNames download:** needs his OK at build time.
