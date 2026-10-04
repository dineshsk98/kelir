"""The birthday email's words in each message language (spec.md > Message languages and fonts).

The capsule's language picks the copy; the sender's and recipient's names stay as written.
Translations are informal where the language has a choice (a birthday between friends).
"""

from typing import TypedDict


class EmailCopy(TypedDict):
    html_lang: str  # the <html lang> value (Chinese is written in Simplified characters)
    subject: str  # also the email's headline; {sender} is filled in
    greeting: str  # {name} is the recipient's first name
    button: str
    closing: str


EMAIL_COPY: dict[str, EmailCopy] = {
    "en": {
        "html_lang": "en",
        "subject": "{sender} has sent you a surprise for your special day.",
        "greeting": "Hi {name},",
        "button": "Open your capsule",
        "closing": "Happy birthday!",
    },
    "ko": {
        "html_lang": "ko",
        "subject": "{sender}님이 특별한 날을 위한 깜짝 선물을 보냈어요.",
        "greeting": "{name}님, 안녕하세요.",
        "button": "캡슐 열기",
        "closing": "생일 축하해요!",
    },
    "zh": {
        "html_lang": "zh-Hans",
        "subject": "{sender} 为你的特别日子送来了一份惊喜。",
        "greeting": "{name}，你好！",
        "button": "打开你的胶囊",
        "closing": "生日快乐！",
    },
    "ja": {
        "html_lang": "ja",
        "subject": "{sender}さんから、特別な日のためのサプライズが届きました。",
        "greeting": "{name}さん、こんにちは。",
        "button": "カプセルを開ける",
        "closing": "お誕生日おめでとう！",
    },
    "es": {
        "html_lang": "es",
        "subject": "{sender} te ha enviado una sorpresa para tu día especial.",
        "greeting": "Hola, {name}:",
        "button": "Abre tu cápsula",
        "closing": "¡Feliz cumpleaños!",
    },
    "ta": {
        "html_lang": "ta",
        "subject": "{sender} உங்கள் சிறப்பு நாளுக்காக ஒரு ஆச்சரியத்தை அனுப்பியுள்ளார்.",
        "greeting": "வணக்கம் {name},",
        "button": "உங்கள் கேப்ஸ்யூலைத் திறக்கவும்",
        "closing": "இனிய பிறந்தநாள் வாழ்த்துகள்!",
    },
    "hi": {
        "html_lang": "hi",
        "subject": "{sender} ने आपके ख़ास दिन के लिए एक सरप्राइज़ भेजा है।",
        "greeting": "नमस्ते {name},",
        "button": "अपना कैप्सूल खोलें",
        "closing": "जन्मदिन की हार्दिक शुभकामनाएँ!",
    },
    "fr": {
        "html_lang": "fr",
        "subject": "{sender} t’a envoyé une surprise pour ton jour spécial.",
        "greeting": "Bonjour {name},",
        "button": "Ouvre ta capsule",
        "closing": "Joyeux anniversaire !",  # French puts a (non-breaking) space before "!"
    },
    "it": {
        "html_lang": "it",
        "subject": "{sender} ti ha mandato una sorpresa per il tuo giorno speciale.",
        "greeting": "Ciao {name},",
        "button": "Apri la tua capsula",
        "closing": "Buon compleanno!",
    },
    "de": {
        "html_lang": "de",
        "subject": "{sender} hat dir eine Überraschung für deinen besonderen Tag geschickt.",
        "greeting": "Hallo {name},",
        "button": "Öffne deine Kapsel",
        "closing": "Alles Gute zum Geburtstag!",
    },
}

MESSAGE_LANGS = tuple(EMAIL_COPY)
