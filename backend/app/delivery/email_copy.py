"""The birthday email's words in each message language (spec.md > Message languages and fonts).

The capsule's language picks the copy; the sender's and recipient's names stay as written.
Translations are informal where the language has a choice (a birthday between friends).
"""

from typing import TypedDict


class EmailCopy(TypedDict):
    subject: str  # also the email's headline; {sender} is filled in
    greeting: str  # {name} is the recipient's first name
    button: str
    sign_in: str  # opening takes signing in as this email; Received keeps it (the tab's name stays English)
    closing: str


EMAIL_COPY: dict[str, EmailCopy] = {
    "en": {
        "subject": "{sender} has sent you a surprise for your special day.",
        "greeting": "Hi {name},",
        "button": "Open your capsule",
        "sign_in": "To open it, sign in with this email address. You can always find it again under Received.",
        "closing": "Happy birthday!",
    },
    "ko": {
        "subject": "{sender}님이 특별한 날을 위한 깜짝 선물을 보냈어요.",
        "greeting": "{name}님, 안녕하세요.",
        "button": "캡슐 열기",
        "sign_in": "열려면 이 이메일 주소로 로그인하세요. 언제든 Received에서 다시 찾을 수 있어요.",
        "closing": "생일 축하해요!",
    },
    "zh": {
        "subject": "{sender} 为你的特别日子送来了一份惊喜。",
        "greeting": "{name}，你好！",
        "button": "打开你的胶囊",
        "sign_in": "打开时请用这个邮箱地址登录。之后随时可以在 Received 里再次找到它。",
        "closing": "生日快乐！",
    },
    "ja": {
        "subject": "{sender}さんから、特別な日のためのサプライズが届きました。",
        "greeting": "{name}さん、こんにちは。",
        "button": "カプセルを開ける",
        "sign_in": "開くには、このメールアドレスでログインしてください。あとからいつでも Received で見つけられます。",
        "closing": "お誕生日おめでとう！",
    },
    "es": {
        "subject": "{sender} te ha enviado una sorpresa para tu día especial.",
        "greeting": "Hola, {name}:",
        "button": "Abre tu cápsula",
        "sign_in": "Para abrirla, inicia sesión con esta dirección de correo. Siempre podrás volver a encontrarla en Received.",
        "closing": "¡Feliz cumpleaños!",
    },
    "ta": {
        "subject": "{sender} உங்கள் சிறப்பு நாளுக்காக ஒரு ஆச்சரியத்தை அனுப்பியுள்ளார்.",
        "greeting": "வணக்கம் {name},",
        "button": "உங்கள் கேப்ஸ்யூலைத் திறக்கவும்",
        "sign_in": "திறக்க, இந்த மின்னஞ்சல் முகவரியுடன் உள்நுழையவும். Received பகுதியில் எப்போது வேண்டுமானாலும் மீண்டும் காணலாம்.",
        "closing": "இனிய பிறந்தநாள் வாழ்த்துகள்!",
    },
    "hi": {
        "subject": "{sender} ने आपके ख़ास दिन के लिए एक सरप्राइज़ भेजा है।",
        "greeting": "नमस्ते {name},",
        "button": "अपना कैप्सूल खोलें",
        "sign_in": "खोलने के लिए इसी ईमेल पते से साइन इन करें। आप इसे कभी भी Received में फिर से पा सकते हैं।",
        "closing": "जन्मदिन की हार्दिक शुभकामनाएँ!",
    },
    "fr": {
        "subject": "{sender} t’a envoyé une surprise pour ton jour spécial.",
        "greeting": "Bonjour {name},",
        "button": "Ouvre ta capsule",
        "sign_in": "Pour l’ouvrir, connecte-toi avec cette adresse e-mail. Tu la retrouveras toujours dans Received.",
        "closing": "Joyeux anniversaire !",  # French puts a (non-breaking) space before "!"
    },
    "it": {
        "subject": "{sender} ti ha mandato una sorpresa per il tuo giorno speciale.",
        "greeting": "Ciao {name},",
        "button": "Apri la tua capsula",
        "sign_in": "Per aprirla, accedi con questo indirizzo email. Potrai sempre ritrovarla in Received.",
        "closing": "Buon compleanno!",
    },
    "de": {
        "subject": "{sender} hat dir eine Überraschung für deinen besonderen Tag geschickt.",
        "greeting": "Hallo {name},",
        "button": "Öffne deine Kapsel",
        "sign_in": "Melde dich zum Öffnen mit dieser E-Mail-Adresse an. Unter Received findest du sie jederzeit wieder.",
        "closing": "Alles Gute zum Geburtstag!",
    },
}


class CodeCopy(TypedDict):
    subject: str  # {code} and {app}; the code early, so it shows in the notification
    intro: str  # {app} is the app's name
    expires: str
    ignore: str


# The one-time sign-in code email (spec.md > Sign-in and sessions), in the language of the page
# that asked for it (a capsule link asks in the capsule's language)
CODE_COPY: dict[str, CodeCopy] = {
    "en": {
        "subject": "{code} is your {app} sign-in code",
        "intro": "Enter this code to sign in to {app}:",
        "expires": "It works for 10 minutes.",
        "ignore": "If you didn't ask for it, you can ignore this email.",
    },
    "ko": {
        "subject": "{app} 로그인 코드: {code}",
        "intro": "{app}에 로그인하려면 이 코드를 입력하세요:",
        "expires": "10분 동안 사용할 수 있어요.",
        "ignore": "요청하지 않았다면 이 메일은 무시하셔도 돼요.",
    },
    "zh": {
        "subject": "{app} 登录验证码：{code}",
        "intro": "输入此验证码登录 {app}：",
        "expires": "验证码 10 分钟内有效。",
        "ignore": "如果不是你本人请求的，请忽略这封邮件。",
    },
    "ja": {
        "subject": "{app}のログインコード：{code}",
        "intro": "{app}にログインするには、このコードを入力してください：",
        "expires": "コードの有効期限は10分です。",
        "ignore": "心当たりがない場合は、このメールを無視してください。",
    },
    "es": {
        "subject": "Tu código para entrar en {app}: {code}",
        "intro": "Escribe este código para entrar en {app}:",
        "expires": "Funciona durante 10 minutos.",
        "ignore": "Si no lo pediste, puedes ignorar este correo.",
    },
    "ta": {
        "subject": "{app} உள்நுழைவுக் குறியீடு: {code}",
        "intro": "{app}-இல் உள்நுழைய இந்தக் குறியீட்டை உள்ளிடவும்:",
        "expires": "இது 10 நிமிடங்களுக்குச் செல்லுபடியாகும்.",
        "ignore": "நீங்கள் இதைக் கோரவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.",
    },
    "hi": {
        "subject": "{app} में साइन इन करने का कोड: {code}",
        "intro": "{app} में साइन इन करने के लिए यह कोड डालें:",
        "expires": "यह 10 मिनट तक काम करेगा।",
        "ignore": "अगर आपने यह नहीं माँगा था, तो इस ईमेल को अनदेखा कर दें।",
    },
    "fr": {
        "subject": "Ton code de connexion à {app} : {code}",
        "intro": "Saisis ce code pour te connecter à {app} :",
        "expires": "Il est valable 10 minutes.",
        "ignore": "Si tu ne l’as pas demandé, tu peux ignorer cet e-mail.",
    },
    "it": {
        "subject": "Il tuo codice di accesso a {app}: {code}",
        "intro": "Inserisci questo codice per accedere a {app}:",
        "expires": "Vale per 10 minuti.",
        "ignore": "Se non l’hai chiesto tu, puoi ignorare questa email.",
    },
    "de": {
        "subject": "Dein Anmeldecode für {app}: {code}",
        "intro": "Gib diesen Code ein, um dich bei {app} anzumelden:",
        "expires": "Er gilt 10 Minuten lang.",
        "ignore": "Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.",
    },
}
