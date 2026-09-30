---
doc: scope
status: approved
---

# Birthday Capsule (working title)

A personal birthday message that reaches someone you love at 00:00 their time, wherever they are, and opens like a gift.

## The Unique Kernel
Sending one is a small, deliberate act of effort that makes someone feel seen. It arrives exactly at the recipient's midnight, so you're the first to wish them even from far away, and it opens as a moment rather than as one more message in an inbox.

## Who It's For
**The sender:** someone whose people are spread out. The recipient might be a partner, a nephew or niece, or a friend, in another country, another state or the same city. Grand parties are rare. Today they send a quick text at their own midnight (the wrong time for the recipient), make a call when they can, or forget.

**The recipient:** gets it at the right moment and opens it feeling "happy and blessed".

## The Core Loop
1. The sender picks someone.
2. They add that person's birthday, email and time zone.
3. They record or write a personal message and can attach a gift.
4. They schedule it, or create and send one instantly.

At the recipient's local 00:00 an email arrives. They tap it and the capsule opens: the message, the media, the gift. The sender comes back for the next person, and the next birthday.

## Inspiration & Identity
- The feel of opening a gift: anticipation, then a reveal. Warm, personal and celebratory, never corporate or "automated greeting".
- Pacing inspired by game reward openings (build-up, burst, reveal), with original art and sound only.

## Why This Matters to the Learner
"Put in some extra effort, that is what interpersonal relationships often lack." This is the heart of gift giving and of feeling seen. It echoes a line he half-remembers from *The Courage to Be Disliked*: all problems are interpersonal relationship problems. People overthink ("so many what ifs, why should I"). This helps them "break through shackles one small step at a time."

His goal: "Ship something people actually get to try, iterate, refine and create something I am happy to use and have my name stamped on it."

## What "Working" Looks Like
A sender schedules a birthday capsule for anyone, or instantly creates and sends one. The recipient receives it and opens it.

**The "oh, that's cool" beat:**
1. Schedule a capsule for someone in another country.
2. Press "simulate their midnight".
3. The email lands at their 00:00.
4. Tap it, and the capsule bursts open with the sender's voice or video and the gift.

## The POC Boundary
- **No account for the recipient, ever:** "a person who doesn't know such a thing exists cannot receive anything." They get a private link.
  - How the link is secured and how the email stays out of spam: see `spec.md > Decisions and Open Issues`.
- **The sender verifies their own email:** the capsule is tied to the sender's authenticated email, so the recipient already knows who sent it.
- **Recipient details:** the sender adds one recipient with name, email, birthday and the recipient's location, chosen with a **city picker**. The city sets their time zone; the recipient has no device in the app.
- **The message:** text, plus one photo, audio or video. Audio and video can be recorded in the browser or uploaded; a photo is uploaded (or taken with the phone's camera).
- **Optional gift:** a link (for example an Amazon link) or a code (for example a Steam code), with an optional note.
- **Delivery:** by email at the recipient's local 00:00, correct across time zones, DST (including days when midnight is skipped) and Feb 29 in non-leap years.
- **Send now:** instant create-and-send as an alternative to scheduling.
- **The opening moment:** tapping the email link opens the capsule in stages: build-up, burst, reveal, then the message and gift. It's built to make the recipient feel seen and happy.
- **Demo control:** a "simulate their midnight" button.

## Explicitly Cut
- **Real gift-card purchases and payments:** no time in a hackathon build, and payment handling is risky.
