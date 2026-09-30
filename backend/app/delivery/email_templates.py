"""The birthday email: plain HTML plus text, one button, no tracking, no attachments
(spec.md > Delivery loop and mailer)."""

from email.headerregistry import Address
from email.message import EmailMessage
from html import escape


def _one_line(value: str) -> str:
    """Names come from Google profiles and the sender's form: never let them break a header."""
    return " ".join(value.split())


def birthday_email(
    *,
    sender_name: str,
    sender_email: str,
    recipient_name: str,
    recipient_email: str,
    link: str,
    app_name: str,
    from_address: str,
) -> EmailMessage:
    sender = _one_line(sender_name)
    recipient = _one_line(recipient_name)
    first_name = recipient.split(" ")[0] if recipient else "there"

    msg = EmailMessage()
    msg["Subject"] = f"{sender} has sent you a surprise for your special day."
    msg["From"] = Address(display_name=f"{sender} via {_one_line(app_name)}", addr_spec=from_address or "no-reply@localhost")
    msg["To"] = Address(display_name=recipient, addr_spec=recipient_email)
    msg["Reply-To"] = Address(display_name=sender, addr_spec=sender_email)

    msg.set_content(
        f"Hi {first_name},\n\n"
        f"{sender} has sent you a surprise for your special day.\n\n"
        f"Open your capsule:\n{link}\n\n"
        f"Happy birthday!\n"
    )
    msg.add_alternative(
        f"""<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#fff7ef;font-family:Helvetica,Arial,sans-serif;color:#2b2230;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td>
            <p style="margin:0 0 12px;font-size:16px;">Hi {escape(first_name)},</p>
            <p style="margin:0 0 24px;font-size:20px;font-weight:bold;line-height:1.3;">
              {escape(sender)} has sent you a surprise for your special day.
            </p>
            <p style="margin:0 0 24px;">
              <a href="{escape(link, quote=True)}"
                 style="display:inline-block;background:#e8604c;color:#ffffff;text-decoration:none;
                        font-weight:bold;padding:14px 28px;border-radius:999px;">Open your capsule</a>
            </p>
            <p style="margin:0;font-size:13px;color:#6f6475;">Happy birthday!</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
""",
        subtype="html",
    )
    return msg
