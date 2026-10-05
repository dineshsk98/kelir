"""Message languages: stored and returned as written, and the email in the capsule's language
(prd.md > Message languages)."""

from html import escape
from typing import get_args

import pytest

from app.delivery.email_copy import CODE_COPY, EMAIL_COPY
from app.languages import MESSAGE_LANGS, html_lang
from app.replies import REPLY_PRESETS
from app.schemas import MessageLang
from tests.test_delivery import capsule_body, deliver, schedule
from tests.test_email_template import LINK, make

# What a recipient should see in each language: (subject with "Sam Sender", button)
EXPECTED = {
    "en": ("Sam Sender has sent you a surprise for your special day.", "Open your capsule"),
    "ko": ("Sam Sender님이 특별한 날을 위한 깜짝 선물을 보냈어요.", "캡슐 열기"),
    "zh": ("Sam Sender 为你的特别日子送来了一份惊喜。", "打开你的胶囊"),
    "ja": ("Sam Senderさんから、特別な日のためのサプライズが届きました。", "カプセルを開ける"),
    "es": ("Sam Sender te ha enviado una sorpresa para tu día especial.", "Abre tu cápsula"),
    "ta": ("Sam Sender உங்கள் சிறப்பு நாளுக்காக ஒரு ஆச்சரியத்தை அனுப்பியுள்ளார்.", "உங்கள் கேப்ஸ்யூலைத் திறக்கவும்"),
    "hi": ("Sam Sender ने आपके ख़ास दिन के लिए एक सरप्राइज़ भेजा है।", "अपना कैप्सूल खोलें"),
    "fr": ("Sam Sender t’a envoyé une surprise pour ton jour spécial.", "Ouvre ta capsule"),
    "it": ("Sam Sender ti ha mandato una sorpresa per il tuo giorno speciale.", "Apri la tua capsula"),
    "de": ("Sam Sender hat dir eine Überraschung für deinen besonderen Tag geschickt.", "Öffne deine Kapsel"),
}


def test_the_api_and_the_email_know_the_same_ten_languages():
    assert len(MESSAGE_LANGS) == 10 and get_args(MessageLang) == MESSAGE_LANGS
    # Every translated table covers exactly the same languages
    for table in (EMAIL_COPY, CODE_COPY, EXPECTED, *REPLY_PRESETS.values()):
        assert set(table) == set(MESSAGE_LANGS)


@pytest.mark.parametrize("lang", sorted(EXPECTED))
def test_email_subject_and_button_in_each_language(lang):
    subject, button = EXPECTED[lang]
    msg = make(lang=lang)
    html = msg.get_body(("html",)).get_content()
    text = msg.get_body(("plain",)).get_content()
    assert msg["Subject"] == subject
    assert f">{button}</a>" in html and html.count("href=") == 1
    assert f'<html lang="{html_lang(lang)}">' in html
    assert "Aiko" in text and LINK in text and button in text
    # Opening takes signing in as this email, and Received keeps it (prd.md > Received)
    sign_in_line = EMAIL_COPY[lang]["sign_in"]
    assert sign_in_line in text and escape(sign_in_line) in html and "Received" in sign_in_line


async def test_language_and_non_latin_text_are_stored_and_returned_as_written(client, sign_in):
    await sign_in()
    words = "생일 축하해, 아이코! 🎂\n늘 고마워."
    r = await client.post("/v1/capsules", json=capsule_body(message_text=words, message_lang="ko"))
    assert r.status_code == 201, r.text
    assert (r.json()["message_text"], r.json()["message_lang"]) == (words, "ko")

    (listed,) = (await client.get("/v1/capsules")).json()
    assert (listed["message_text"], listed["message_lang"]) == (words, "ko")


async def test_language_defaults_to_english(client, sign_in):
    await sign_in()
    r = await client.post("/v1/capsules", json=capsule_body())
    assert r.status_code == 201 and r.json()["message_lang"] == "en"


@pytest.mark.parametrize("lang", ["xx", "EN", "pt", "", None])
async def test_unknown_language_is_rejected(client, sign_in, lang):
    await sign_in()
    r = await client.post("/v1/capsules", json=capsule_body(message_lang=lang))
    assert r.status_code == 422


async def test_tamil_capsule_emails_in_tamil_and_opens_with_its_language(
    client, sign_in, freeze_now, sessionmaker, mailer, settings
):
    await sign_in(name="Sam Sender")
    words = "இனிய பிறந்தநாள் வாழ்த்துகள், ஆய்கோ!"
    await schedule(client, freeze_now, message_text=words, message_lang="ta")
    link = await deliver(sessionmaker, mailer, settings)

    (email,) = mailer.sent
    assert email["Subject"] == EXPECTED["ta"][0]
    await sign_in("aiko@gmail.com", "Aiko Tanaka")  # the recipient
    opened = (await client.get(link)).json()
    assert (opened["message_text"], opened["message_lang"]) == (words, "ta")
