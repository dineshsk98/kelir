"""The app's emails, the birthday email and the sign-in code: plain HTML plus text, no
tracking, no attachments (spec.md > Delivery loop and mailer). Their words follow a language
(email_copy.py); both share one page shell."""

from email.headerregistry import Address
from email.message import EmailMessage
from html import escape

from app.delivery.email_copy import CODE_COPY, EMAIL_COPY
from app.languages import html_lang


def _one_line(value: str) -> str:
    """Names come from Google profiles and the sender's form: never let them break a header."""
    return " ".join(value.split())


def _html_page(lang: str, inner: str) -> str:
    """The emails' shared page: a warm background and a centred white card holding `inner`."""
    return f"""<!doctype html>
<html lang="{html_lang(lang)}">
  <body style="margin:0;padding:24px;background:#fff7ef;font-family:Helvetica,Arial,sans-serif;color:#2b2230;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;">
          <tr><td>
{inner}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
"""


def birthday_email(
    *,
    sender_name: str,
    sender_email: str,
    recipient_name: str,
    recipient_email: str,
    link: str,
    app_name: str,
    from_address: str,
    lang: str = "en",
) -> EmailMessage:
    sender = _one_line(sender_name)
    recipient = _one_line(recipient_name)
    first_name = recipient.split(" ")[0] if recipient else "there"
    copy = EMAIL_COPY.get(lang, EMAIL_COPY["en"])
    headline = copy["subject"].format(sender=sender)
    greeting = copy["greeting"].format(name=first_name)

    msg = EmailMessage()
    msg["Subject"] = headline
    msg["From"] = Address(display_name=f"{sender} via {_one_line(app_name)}", addr_spec=from_address or "no-reply@localhost")
    msg["To"] = Address(display_name=recipient, addr_spec=recipient_email)
    msg["Reply-To"] = Address(display_name=sender, addr_spec=sender_email)

    msg.set_content(
        f"{greeting}\n\n"
        f"{headline}\n\n"
        f"{copy['button']}:\n{link}\n\n"
        f"{copy['sign_in']}\n\n"
        f"{copy['closing']}\n"
    )
    msg.add_alternative(
        _html_page(
            lang,
            f"""            <p style="margin:0 0 12px;font-size:16px;">{escape(greeting)}</p>
            <p style="margin:0 0 24px;font-size:20px;font-weight:bold;line-height:1.3;">
              {escape(headline)}
            </p>
            <p style="margin:0 0 24px;">
              <a href="{escape(link, quote=True)}"
                 style="display:inline-block;background:#e8604c;color:#ffffff;text-decoration:none;
                        font-weight:bold;padding:14px 28px;border-radius:999px;">{escape(copy['button'])}</a>
            </p>
            <p style="margin:0 0 16px;font-size:13px;color:#6f6475;">{escape(copy['sign_in'])}</p>
            <p style="margin:0;font-size:13px;color:#6f6475;">{escape(copy['closing'])}</p>""",
        ),
        subtype="html",
    )
    return msg


def code_email(*, code: str, to: str, app_name: str, from_address: str, lang: str = "en") -> EmailMessage:
    """A one-time sign-in code. From the app, with no link: the code is typed (or pasted)
    into the page that asked for it, so a forwarded email can't sign anyone in by a click."""
    copy = CODE_COPY.get(lang, CODE_COPY["en"])
    app = _one_line(app_name)
    intro = copy["intro"].format(app=app)

    msg = EmailMessage()
    msg["Subject"] = copy["subject"].format(code=code, app=app)
    msg["From"] = Address(display_name=app, addr_spec=from_address or "no-reply@localhost")
    msg["To"] = Address(addr_spec=to)
    msg.set_content(f"{intro}\n\n{code}\n\n{copy['expires']}\n{copy['ignore']}\n")
    msg.add_alternative(
        _html_page(
            lang,
            f"""            <p style="margin:0 0 16px;font-size:16px;">{escape(intro)}</p>
            <p style="margin:0 0 24px;font-size:32px;font-weight:bold;letter-spacing:0.2em;">{escape(code)}</p>
            <p style="margin:0 0 4px;font-size:14px;">{escape(copy['expires'])}</p>
            <p style="margin:0;font-size:13px;color:#6f6475;">{escape(copy['ignore'])}</p>""",
        ),
        subtype="html",
    )
    return msg
