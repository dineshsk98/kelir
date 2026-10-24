"""The sender's name is frozen on the capsule when it is saved: renaming yourself, or editing
the capsule later, never changes the name it was made under."""

from tests.test_delivery import capsule_body, deliver, schedule


async def rename(client, name: str) -> None:
    assert (await client.patch("/v1/me", json={"name": name})).status_code == 200


async def sees_name(client, link: str, capsule_id: str, name: str) -> None:
    """The capsule page, the access step and the Received list all say `name`."""
    first = name.split(" ")[0]
    assert (await client.get(link)).json()["sender_name"] == name
    assert (await client.get(f"{link}/access")).json()["sender_first_name"] == first
    (item,) = (await client.get("/v1/received")).json()
    assert item["sender_name"] == name
    assert (await client.get(f"/v1/received/{capsule_id}")).json()["sender_name"] == name


async def test_renaming_before_delivery_keeps_the_old_name_everywhere(
    client, sign_in, as_recipient, act_as, freeze_now, sessionmaker, mailer, settings
):
    sender = await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    await rename(client, "Sammy")  # the email hasn't gone out yet
    link = await deliver(sessionmaker, mailer, settings)

    (email,) = mailer.sent
    assert email["Subject"].startswith("Sam Sender has sent you")
    assert email["From"].addresses[0].display_name == "Sam Sender via Kelir"
    await as_recipient()
    await sees_name(client, link, c["id"], "Sam Sender")
    act_as(sender.id)


async def test_renaming_after_delivery_keeps_the_old_name_everywhere(
    client, sign_in, as_recipient, act_as, freeze_now, sessionmaker, mailer, settings
):
    sender = await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    link = await deliver(sessionmaker, mailer, settings)
    await rename(client, "Sammy")

    await as_recipient()
    await sees_name(client, link, c["id"], "Sam Sender")
    act_as(sender.id)
    assert (await client.get("/v1/me")).json()["name"] == "Sammy"


async def test_a_capsule_made_after_a_rename_uses_the_new_name(
    client, sign_in, as_recipient, act_as, freeze_now, sessionmaker, mailer, settings
):
    sender = await sign_in(name="Sam Sender")
    await rename(client, "Sammy")
    c = await schedule(client, freeze_now)
    link = await deliver(sessionmaker, mailer, settings)

    (email,) = mailer.sent
    assert email["Subject"].startswith("Sammy has sent you")
    assert email["From"].addresses[0].display_name == "Sammy via Kelir"
    await as_recipient()
    await sees_name(client, link, c["id"], "Sammy")
    act_as(sender.id)


async def test_editing_after_a_rename_changes_the_content_but_not_the_name(
    client, sign_in, as_recipient, act_as, freeze_now, sessionmaker, mailer, settings
):
    sender = await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    await rename(client, "Sammy")

    edited = await client.patch(f"/v1/capsules/{c['id']}", json=capsule_body(message_text="Even better!"))
    assert edited.status_code == 200, edited.text
    assert edited.json()["sender_name"] == "Sam Sender"

    link = await deliver(sessionmaker, mailer, settings)
    # and again once it is delivered but not yet opened
    again = await client.patch(f"/v1/capsules/{c['id']}", json=capsule_body(message_text="Best yet!"))
    assert again.status_code == 200, again.text

    await as_recipient()
    assert (await client.get(link)).json()["message_text"] == "Best yet!"
    await sees_name(client, link, c["id"], "Sam Sender")
    act_as(sender.id)


async def test_the_senders_own_list_shows_the_frozen_name(client, sign_in, freeze_now):
    await sign_in(name="Sam Sender")
    c = await schedule(client, freeze_now)
    await rename(client, "Sammy")

    (listed,) = (await client.get("/v1/capsules")).json()
    assert listed["sender_name"] == "Sam Sender"
    assert (await client.get(f"/v1/capsules/{c['id']}")).json()["sender_name"] == "Sam Sender"
