"""Many capsules due at the same midnight: four people each send one to the other three, all
for tomorrow, all due at the same instant. One delivery moment (several loops racing) must
deliver and email all twelve, and each person must then receive their three together."""

import asyncio
from collections import Counter
from datetime import timedelta

from sqlalchemy import select

from app.delivery.scheduler import run_tick
from app.models import Capsule
from tests.test_delivery import DUE, NOW, capsule_body

PEOPLE = {f"test{i}@gmail.com": f"Test {i}" for i in range(1, 5)}


async def test_four_people_send_to_each_other_at_the_same_midnight(
    client, sign_in, act_as, freeze_now, sessionmaker, mailer, settings
):
    ids = {email: (await sign_in(email, name)).id for email, name in PEOPLE.items()}
    freeze_now(NOW)  # 13 March; the birthdays are tomorrow, 14 March in Tokyo

    # Each person sends one capsule to each of the other three, all with the same city
    sent = {}  # capsule id -> (sender email, recipient email)
    for sender in PEOPLE:
        act_as(ids[sender])
        for recipient, name in PEOPLE.items():
            if recipient == sender:
                continue
            r = await client.post(
                "/v1/capsules",
                json=capsule_body(
                    recipient_name=name,
                    recipient_email=recipient,
                    message_text=f"From {PEOPLE[sender]} to {name}",
                ),
            )
            assert r.status_code == 201, r.text
            assert r.json()["status"] == "scheduled" and r.json()["deliver_at"] == DUE.isoformat().replace("+00:00", "Z")
            sent[r.json()["id"]] = (sender, recipient)
    assert len(sent) == 12

    # Nothing goes out a second early
    early = await run_tick(sessionmaker, mailer, settings, DUE - timedelta(seconds=1))
    assert (early.delivered, early.emailed) == (0, 0) and mailer.sent == []

    # Midnight: three delivery loops all fire at the same instant
    ticks = await asyncio.gather(*(run_tick(sessionmaker, mailer, settings, DUE) for _ in range(3)))
    assert sum(t.delivered for t in ticks) == 12 and sum(t.emailed for t in ticks) == 12
    assert sum(t.failed for t in ticks) == 0

    async with sessionmaker() as s:
        rows = (await s.scalars(select(Capsule))).all()
    assert len(rows) == 12
    assert {(c.status, c.delivered_at, c.emailed_at, c.send_attempts) for c in rows} == {("delivered", DUE, DUE, 1)}

    # Twelve emails, one per capsule, three to each person, none to themselves, twelve distinct links
    assert len(mailer.sent) == 12 and len(set(mailer.links())) == 12
    inbox = Counter(m["To"].addresses[0].addr_spec for m in mailer.sent)
    assert inbox == {email: 3 for email in PEOPLE}
    for m in mailer.sent:
        assert m["To"].addresses[0].addr_spec != m["Reply-To"].addresses[0].addr_spec

    # Each person sees exactly their three capsules, from the other three, and can open each
    links_by_recipient = {}
    for m, link in zip(mailer.sent, mailer.links()):
        links_by_recipient.setdefault(m["To"].addresses[0].addr_spec, []).append(link)
    for email, name in PEOPLE.items():
        act_as(ids[email])
        received = (await client.get("/v1/received")).json()
        assert sorted(r["sender_name"] for r in received) == sorted(n for e, n in PEOPLE.items() if e != email)
        assert all(r["delivered_at"] and r["opened_at"] is None for r in received)
        assert (await client.get("/v1/received/unread")).json()["unread"] == 3
        for r in received:
            opened = (await client.get(f"/v1/received/{r['id']}")).json()
            assert opened["message_text"] == f"From {r['sender_name']} to {name}"
        for link in links_by_recipient[email]:
            assert (await client.get("/v1" + link.removeprefix("http://testserver"))).status_code == 200
