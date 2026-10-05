"""The birthday email (prd.md > The birthday email)."""

from app.delivery.email_templates import birthday_email

LINK = "https://capsule.example/c/abc123"


def make(**overrides):
    args = {
        "sender_name": "Sam Sender",
        "sender_email": "sam@gmail.com",
        "recipient_name": "Aiko Tanaka",
        "recipient_email": "aiko@gmail.com",
        "link": LINK,
        "app_name": "Kelir",
        "from_address": "capsule.app@gmail.com",
    }
    args.update(overrides)
    return birthday_email(**args)


def test_headers_name_the_sender_and_reply_to_them():
    msg = make()
    assert msg["Subject"] == "Sam Sender has sent you a surprise for your special day."
    assert msg["From"].addresses[0].display_name == "Sam Sender via Kelir"
    assert msg["From"].addresses[0].addr_spec == "capsule.app@gmail.com"  # Gmail requires its own address
    assert msg["Reply-To"].addresses[0].addr_spec == "sam@gmail.com"
    assert msg["To"].addresses[0].addr_spec == "aiko@gmail.com"


def test_plain_and_html_bodies_with_one_link_and_nothing_else():
    msg = make()
    text = msg.get_body(("plain",)).get_content()
    html = msg.get_body(("html",)).get_content()
    assert "Hi Aiko," in text and LINK in text
    assert html.count("href=") == 1 and LINK in html and "Open your capsule" in html
    assert "<img" not in html  # no tracking pixels
    assert not list(msg.iter_attachments())


def test_names_cannot_inject_html_or_headers():
    msg = make(sender_name="Sam\r\nBcc: attacker@example.com", recipient_name="<script>x</script>")
    assert msg["Bcc"] is None
    assert "\n" not in msg["Subject"]
    html = msg.get_body(("html",)).get_content()
    assert "<script>" not in html and "&lt;script&gt;" in html
    raw = msg.as_string()
    assert "\nBcc:" not in raw


async def test_console_mailer_survives_a_console_without_the_script(monkeypatch):
    """Windows consoles often use cp1252, which has no Korean: printing the email must not
    fail the send (it did, for a Korean sign-in code)."""
    import io
    import sys

    from app.delivery.email_templates import code_email
    from app.delivery.mailer import ConsoleMailer

    console = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
    monkeypatch.setattr(sys, "stdout", console)
    mailer = ConsoleMailer()
    message = code_email(code="123456", to="mira@gmail.com", app_name="Kelir", from_address="", lang="ko")
    await mailer.send(message)
    console.flush()
    shown = console.buffer.getvalue().decode("cp1252")
    assert mailer.sent == [message] and "123456" in shown
