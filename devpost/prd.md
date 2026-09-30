---
doc: prd
status: approved
---

# Birthday Capsule (working title) — Product Requirements

A personal birthday capsule (message, media and an optional gift) that a signed-in sender makes for someone they love. It reaches the recipient by email at 00:00 in the recipient's own time zone and opens like a gift.

Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`, `scope.md > The POC Boundary`.

## The Core Journey
1. **Welcome.** A visitor lands on the welcome page. It explains what the product does and why it connects with everyone: the effort of remembering someone, and being the first to wish them at their midnight.
2. **Sign in.** The visitor signs in with Google. Returning senders sign in again and find their history.
3. **Start a capsule.** From their history, the sender starts a new capsule.
4. **Who.** The sender enters the recipient's name, email, birthday (month and day) and city. The city sets the recipient's time zone.
5. **Message.** Text, plus one photo, audio or video. Audio and video can be recorded live in the browser or uploaded from a file; a photo is uploaded or taken with the phone's camera.
6. **Gift (optional).** An online gift: a link (for example an Amazon link) or a code (for example a Steam code), with an optional note.
7. **When.** "On their birthday" (at the recipient's next local 00:00 on that date) or "Send now".
8. **Preview and confirm.** The sender sees exactly what the recipient will see, then confirms. The capsule appears in their history as **Scheduled** (or **Delivered**, if sent now).
9. **Delivery.** At the recipient's local 00:00 on their birthday, an email arrives: "<Sender> has sent you a surprise for your special day." It contains a private link.
10. **The opening.** The recipient taps the link and the capsule opens in stages: arrival, tap to open, build-up, burst, reveal. Then the message plays and the gift is revealed.
11. **Thank you.** The recipient sends a thank-you, either a preset message or their own text.
12. **Back to the sender.** The capsule shows **Opened** in the sender's history, with the recipient's thank-you. Success: the recipient felt seen, and the sender saw that they did.

## Screens and Layout
Sender side (signed in with Google):
- **Welcome page.** What it does and why it matters, plus a "Sign in with Google" button.
- **History (home after sign-in).** A list of the sender's capsules and a "New capsule" button.
- **New / edit capsule.** Short steps: Who → Message → Gift → When → Preview.
- **Capsule detail.** The preview, status, the recipient's local delivery time and any thank-you. Edit and Cancel appear here while the capsule is unopened.

Recipient side (no account, private link only):
- **Birthday email.** Subject line, the sender's name and a button to open the capsule.
- **Capsule page.** The staged opening, then the message, the gift and the thank-you reply. The page can be replayed later from the same link.

## Look and Feel
Not decided yet (open question, doesn't block the spec). Established so far, from `scope.md > Inspiration & Identity`:
- Warm, personal and celebratory; never corporate or "automated greeting".
- The opening is paced like a game reward opening (build-up, burst, reveal), using only original art and sound.
- The direction will be picked during the build from a quick coded prototype.

## Features and Behavior

### Sign-in and history
- As a sender, I sign in with Google so that my capsules are tied to a real, verified identity and are waiting for me when I come back.
  - [ ] "Sign in with Google" on the welcome page leads to the history page.
  - [ ] After signing out and back in, the same capsules are listed.
  - [ ] Each row shows:
    - the recipient's name and city
    - the delivery time in the recipient's local time, plus the sender's own local equivalent
    - the status: Scheduled, Delivered, Opened or Cancelled
  - [ ] A thank-you reply appears on its capsule's row and in the capsule detail.

### Creating a capsule
- As a sender, I make a capsule with my own words, voice or face, and optionally a gift.
  - [ ] **Who:** name, email, birthday (month/day) and city are all required.
    - Choosing a city shows its time zone (e.g. "Tokyo · Asia/Tokyo").
    - A Feb 29 birthday asks which date to use in non-leap years: Feb 28 or Mar 1.
  - [ ] **Message:** at least one of text, a photo, audio or video.
    - Audio and video can be recorded in the browser or uploaded.
    - A photo is uploaded (on a phone, the picker can also open the camera).
    - A recording can be played back and redone before saving.
  - [ ] **Gift (optional):** a link or a code, plus an optional note.
  - [ ] **When:** "On their birthday" shows the exact local delivery moment, e.g. "Delivers 00:00, 14 Mar in Tokyo (20:30, 13 Mar your time)". "Send now" delivers immediately.
  - [ ] **Preview** shows the recipient's experience before confirming.

### Editing and cancelling (until opened)
- The sender can edit or cancel a capsule until the recipient opens it. Once it's opened, it's final: "just like how you cannot take back anything you say or do."
  - [ ] Edit and Cancel are available while the status is Scheduled or Delivered.
  - [ ] Edit and Cancel are gone once the status is Opened.
  - [ ] An edit to a delivered but unopened capsule is what the recipient sees when they open it.
  - [ ] A cancelled capsule's link shows a gentle "This capsule is no longer available."

### Delivery at the recipient's midnight
- The capsule arrives at 00:00 in the recipient's time zone on their birthday, not at the sender's midnight or at a fixed offset.
  - [ ] Delivery is correct for:
    - half-hour and 45-minute zones (e.g. India +5:30, Nepal +5:45)
    - both sides of daylight saving
    - days when daylight saving skips midnight (then it arrives at the first moment of that day)
  - [ ] **Feb 29** in a non-leap year uses the sender's Feb 28 or Mar 1 choice. In a leap year it's always Feb 29.
  - [ ] **The birthday is today:** if their local midnight has already passed, the capsule goes out immediately. It is still their day.
  - [ ] **The birthday already passed:** "Send now" works any day, since the heart of the idea is the giving, not the when. "On their birthday" means the next occurrence.
  - [ ] Each capsule is delivered exactly once, even if delivery is retried.
  - [ ] **Demo:** a "Simulate their midnight" control on a scheduled capsule delivers it right away. It is clearly marked as a demo control.

### The birthday email
- [ ] The subject line reads "<Sender> has sent you a surprise for your special day."
- [ ] The body names the sender and has one clear "Open your capsule" button.
- [ ] The email lands in the inbox rather than spam. How: `spec.md > Decisions and Open Issues`.

### The opening moment
- The recipient taps the link and the capsule opens in stages, built to make them feel seen and happy.
  - [ ] **Stages:**
    1. The capsule arrives on screen.
    2. "Tap to open".
    3. Build-up.
    4. Burst with confetti.
    5. The card is revealed with the sender's name.
    6. The message plays (text shown, the photo shown, or audio/video plays).
    7. The gift is revealed: the link as a button; the code hidden until tapped, with a copy button.
  - [ ] Sound effects are on by default, with a visible mute.
  - [ ] A "Skip" control jumps straight to the reveal.
  - [ ] If the device asks for reduced motion, the opening becomes a short fade with no shake, flash or confetti.
  - [ ] **Replay:** opening the link again shows the opening again. The capsule stays viewable.
  - [ ] The first open changes the sender's status to Opened. Later opens don't change anything.

### Thank-you reply
- As a recipient, I can say thank you without making an account.
  - [ ] I can choose a preset thank-you or write my own text, then send.
  - [ ] The sender sees it on that capsule in their history.
  - [ ] After sending, the capsule page shows "Your thank-you was sent."

## States and Boundaries
- **First use (sender):** the history is empty and shows an inviting "Make your first capsule" prompt.
- **Recording not allowed:** if the browser blocks the camera or microphone, the sender sees a clear note and can still upload a file or write text.
- **File can't be used:** the sender sees a clear message if a file is too large or in an unsupported format. Limits are set in the spec.
- **Invalid or unknown link:** a friendly "We couldn't find this capsule" page.
- **Cancelled capsule:** its link shows "This capsule is no longer available."
- **Before delivery:** the recipient has no link, so nothing can be opened early. Only the sender can preview.
- **Privacy boundary:** only the signed-in sender sees their history. Anyone holding the private link can open that one capsule, so the link must be hard to guess (see `spec.md > Decisions and Open Issues`).
- **What persists:** senders, capsules, media, statuses and thank-you replies.

## Product Decisions
- **Recipients never need an account.** "A person who doesn't know such a thing exists cannot receive anything." They get a private link.
- **Sign in with Google only.** Senders are authenticated by a reliable entity, which makes the sender's identity trustworthy to the recipient.
- **City picker, not a time-zone list.** It's friendlier for the sender.
- **Final once opened, not once sent.** The sender can edit or cancel until the recipient opens it.
- **Birthday already started:** deliver immediately; it's still their day.
- **Belated wishes are fine** via "Send now". The heart is the giving, not the when.
- **Thank-you now:** preset or custom text, shown to the sender, "making it easy". Audio and video replies come later.
- **Record or upload** for audio and video; upload for a photo; text works too. (Photo added back on 2026-09-30 after the slice 6 check.)
- **The gift is a link or a code.** Nothing is bought through the product.
- **Subject line:** "<Sender> has sent you a surprise for your special day."
- **Feb 29:** the sender picks Feb 28 or Mar 1 for non-leap years.
- *Assumption:* the new-capsule flow is a short series of steps rather than one long page.
- *Assumption:* the sender can preview a capsule at any time.

## What We're Building
- Welcome page and Google sign-in.
- History with statuses and thank-you replies.
- The new/edit capsule flow: Who (with city picker and Feb 29 choice), Message (text, plus a photo or recorded/uploaded audio or video), Gift (link or code), When (birthday or now), Preview.
- Edit and cancel until opened.
- Time-zone-correct delivery by email at the recipient's 00:00, exactly once.
- The private-link capsule page: staged opening, skip, mute, reduced motion, replay.
- Thank-you reply: preset or custom text.
- The "Simulate their midnight" demo control.

## Deferred From the POC
- **Audio and video thank-you replies:** a second recorder on the recipient's side; text proves the loop.
- **Other sign-in providers:** Google alone proves trusted identity.
- **Multiple recipients per capsule, or reusing a capsule:** one person at a time proves the kernel.

## Non-Goals
- **Recipient accounts:** against the core principle.
- **Buying gifts or taking payments:** no time in a hackathon build, and risky to handle.

## Open Questions
- **Product name:** before the public video.
- **Look and feel:** picked from two coded options during the build.

Settled in `spec.md`:
- **How the email identifies the sender:** sent from the app's Gmail as "<Sender> via <Name>", with replies going to the sender.
- **Link security and staying out of spam:** a long random link secret stored only as a hash; a plain HTML-plus-text email with one link. See `spec.md > Decisions and Open Issues`.
- **Media limits:** video up to 60 s, audio up to 120 s, files up to 50 MB.
