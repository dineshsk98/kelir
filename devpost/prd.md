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
5. **Message.** Text, plus up to 6 photos, audio or video clips in any mix. Audio and video can be recorded live in the browser or uploaded from a file; a photo is uploaded or taken with the phone's camera.
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
- **Capsule page.** The staged opening, then the message, the gift and the thank-you reply. The opening plays once; after that, the same link shows what was inside.

## Look and Feel
Not decided yet (open question, doesn't block the spec). Established so far, from `scope.md > Inspiration & Identity`:
- Warm, personal and celebratory; never corporate or "automated greeting".
- The opening is paced like a game reward opening (build-up, burst, reveal), using only original art and sound.
- The direction will be picked during the build from a quick coded prototype.

## Features and Behavior

### Sign-in and history
- As a sender or a recipient, I sign in with Google, or with a code emailed to me (like Claude's email sign-in), so that my capsules are tied to a verified email and are waiting for me when I come back. (Email codes added 2026-10-05.)
  - [ ] The welcome page offers "Continue with Google" and "Continue with email". With email, I type my address, get a 6-digit code, and type it in. The code works for 10 minutes and allows 5 tries; a new one can be sent after a minute, at most 5 an hour.
  - [ ] Either way it's the same account for the same email; the first sign-in creates it.
  - [ ] I can change my name, since recipients see it.
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
  - [ ] **Message:** text and/or up to 6 media items (photos, audio, video) in any mix, shown in the order added; at least one of text or media.
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
  - [ ] **Stages** (a 3D scene, updated 2026-10-02):
    1. A real photo of a birthday cake with lit candles fades in at the centre, under "A gift for <name>"; the flames flicker.
    2. They blow the candles out: by tapping, or (only if they choose "Blow for real") by blowing at the microphone. The flames go out, smoke rises from the wicks, a small crowd claps, and "Happy Birthday" starts softly on the piano, playing on a loop for as long as the capsule is open (following the mute button). Whenever another sound plays, including their voice note or video, the song drops low and then swells back.
    3. After a moment, the cake glides slowly to the bottom left and a tied gift box arrives.
    4. They pull the ribbon (drag in any direction, or tap "Pull the ribbon").
    5. The ribbon unties, a soft build-up glows under the lid, and the lid lifts with a gentle confetti shower (no shake).
    6. A photocard rises with their name and the sender's.
    7. A note appears: "A capsule from <sender>", "<Sender> wrapped up four little surprises for you", with a thumbnail for each thing inside (the letter, photos, videos, voice notes, the gift) and a "Say thank you" button. Nothing opens by itself: each thumbnail opens in a viewer they can close (×, Esc or a tap outside), with Previous/Next. Voice notes and videos play in the scene itself, with the lights dimmed, not in a box. A voice note plays on a record player seen from above at an angle: moving the needle onto the record plays it (the needle creeps inward as it plays), lifting it pauses. A video is projected onto the wall by a small projector at the bottom, its light fanning up to the picture. Nothing spins or flickers under reduced motion.
  - [ ] Sound effects are on by default, with a visible mute.
  - [ ] A "Skip" control jumps straight to the reveal.
  - [ ] The microphone is never requested unless they tap "Blow for real", and it's released as soon as the candle is out.
  - [ ] If the device asks for reduced motion, there's no movement, flash or confetti, and nothing is revealed before they blow out the candle and pull the ribbon.
  - [ ] **Opens once** (changed 2026-10-05; it used to replay): a gift can't be unwrapped twice. Once they reach the open box (or skip to it), the link always opens straight to it: the photocard, the contents note and the thank-you, with no cake or ribbon. This applies on every device.
  - [ ] Reaching the open box changes the sender's status to Opened (so do sending a thank-you). Only loading the page doesn't count, so an interrupted first visit still gets the whole opening. Later visits don't change anything.

### Proving it's them (added 2026-10-05)
- As a recipient, only I can open what was sent to me, even if the link is forwarded or seen by someone else, because a gift code inside could be stolen. Dinesh, 2026-10-05: "when gifts like codes are sent, any unauthorized access to the link will lead to the code getting stolen."
  - [ ] The link alone shows nothing inside: no message, media or gift. Before I prove it's me, it says only who sent it and which email opens it, masked (a•••@gmail.com).
  - [ ] I prove it by signing in as that email: with Google, or with a code emailed to it (see Sign-in and history).
  - [ ] It happens at the cake, before the candles are blown, without leaving the opening: the scene and the music carry on while I confirm.
  - [ ] Signed in as another account, I'm told the capsule is for a different email.
  - [ ] Once proved on this browser, the opening is exactly as before.

### Thank-you reply
- As a recipient, I can say thank you once I've proved it's me.
  - [ ] I can choose a preset thank-you or write my own text, then send.
  - [ ] The sender sees it on that capsule in their history.
  - [ ] After sending, the capsule page shows "Your thank-you was sent."

### Received (added 2026-10-05)
- As a recipient, I can find my capsules again in the app, because links can be lost or destroyed (Dinesh, 2026-10-05).
  - [ ] Signed in, a Received tab lists the capsules sent to my email, newest first: who it's from, when it arrived, and New or Opened (and whether I said thank you). Nothing from inside them is in the list.
  - [ ] Capsules not yet delivered don't appear (they're still a surprise), nor do cancelled ones.
  - [ ] Opening one plays the opening once, like the link; opening it in either place opens it in both. The thank-you works the same way.
  - [ ] The birthday email says: to open it, sign in with this email address; you can always find it again under Received.
  - [ ] Sent, Received and People are tabs in one header.
  - [ ] Like unread mail, the Received tab shows how many capsules are waiting to be opened, and so does the browser tab's title ("(2) Birthday Capsule"). Opening one takes it off the count. (Added 2026-10-05.)

### Regular recipients (People)
- As a sender, the people I send to are remembered so the next birthday is quick. (Added 2026-10-02.)
  - [ ] Each capsule I send saves or updates that person (name, email, birthday, city), matched by email.
  - [ ] A People page lists them by next birthday with a countdown in their time zone, e.g. "Aiko · in 12 days · 00:00 in Tokyo".
  - [ ] From a person I can make a new capsule with their details filled in, edit them, or remove them (their past capsules stay).
  - [ ] The Who step offers "Someone you've sent to before".

### Message languages
- As a sender, I write in my own language and it looks handwritten in a font made for that script. (Added 2026-10-02.)
  - [ ] Languages: English, Korean, Chinese, Japanese, Spanish, Tamil, Hindi, French, Italian, German.
  - [ ] The chosen language sets the message font in the editor, the preview and the opening.
  - [ ] The email's subject line and "Open your capsule" button are in the capsule's language (as are its greeting and closing, so the email doesn't mix two languages).
  - [ ] Typing uses the device's own keyboard (the language is picked from a list; detecting it from the text or keyboard is for later).
- As a recipient, the whole opening is in the language the capsule was written in: its titles, buttons, photocard, viewers, players, gift and thank-you panel. An English capsule stays English. (Added 2026-10-04.)
  - [ ] My thank-you starts in that language too; I can pick another one from the same list, and the presets follow my pick.
  - [ ] The sender sees my thank-you in the handwriting of the language I chose.
  - [ ] The sender's own pages stay in English for now.

## States and Boundaries
- **First use (sender):** the history is empty and shows an inviting "Make your first capsule" prompt.
- **Recording not allowed:** if the browser blocks the camera or microphone, the sender sees a clear note and can still upload a file or write text.
- **File can't be used:** the sender sees a clear message if a file is too large or in an unsupported format. Limits are set in the spec.
- **Invalid or unknown link:** a friendly "We couldn't find this capsule" page.
- **Cancelled capsule:** its link shows "This capsule is no longer available."
- **Before delivery:** the recipient has no link, so nothing can be opened early. Only the sender can preview.
- **Privacy boundary:** only the signed-in sender sees their history. A capsule opens only for its recipient: the private link finds it, and the recipient's proved email (Google or an emailed code) opens it, so a leaked link shows nothing inside.
- **What persists:** senders, capsules, media, statuses and thank-you replies.

## Product Decisions
- **Recipients prove it's them, but don't need to sign up.** (Changed 2026-10-05; it used to be link-only.) "A person who doesn't know such a thing exists cannot receive anything", so a recipient with any email can open their capsule: with Google if they have it, otherwise with a code emailed to them. The app now has two roles, sender and recipient.
- **Sign in with Google or an emailed code.** (Changed 2026-10-05; it was Google only.) Either proves the email, so a sender's identity is a verified email, and recipients without Google can still get in.
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
- **Multiple recipients per capsule, or reusing a capsule:** one person at a time proves the kernel. (Reusing a *person* is now in scope, see People.)
- **Translating the sender's pages:** the email and the recipient's whole opening follow the capsule's language; the sender's own buttons and labels stay English for now.

## Non-Goals
- **Making recipients sign up:** proving the email (Google or a code) is enough; there's no separate account or password.
- **Buying gifts or taking payments:** no time in a hackathon build, and risky to handle.

## Open Questions
- **Product name:** before the public video.
- **Look and feel:** picked from two coded options during the build.

Settled in `spec.md`:
- **How the email identifies the sender:** sent from the app's Gmail as "<Sender> via <Name>", with replies going to the sender.
- **Link security and staying out of spam:** a long random link secret stored only as a hash; a plain HTML-plus-text email with one link. See `spec.md > Decisions and Open Issues`.
- **Media limits:** video up to 60 s, audio up to 120 s, files up to 50 MB.
