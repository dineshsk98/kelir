"""Preset thank-you messages (prd.md > Thank-you reply). Stored by key and language, shown as
text. Each preset is offered in every message language (app.languages; a test checks it)."""

REPLY_PRESETS: dict[str, dict[str, str]] = {
    "made_my_day": {
        "en": "Thank you! You made my birthday so special.",
        "ko": "고마워요! 덕분에 내 생일이 정말 특별해졌어요.",
        "zh": "谢谢你！你让我的生日变得特别美好。",
        "ja": "ありがとう！おかげで誕生日がとても特別になりました。",
        "es": "¡Gracias! Hiciste mi cumpleaños muy especial.",
        "ta": "நன்றி! உங்களால் என் பிறந்தநாள் மிகவும் சிறப்பானது.",
        "hi": "धन्यवाद! आपने मेरे जन्मदिन को बहुत ख़ास बना दिया।",
        "fr": "Merci ! Tu as rendu mon anniversaire très spécial.",
        "it": "Grazie! Hai reso il mio compleanno davvero speciale.",
        "de": "Danke! Du hast meinen Geburtstag ganz besonders gemacht.",
    },
    "first_wish": {
        "en": "You were the first to wish me a happy birthday. Thank you!",
        "ko": "가장 먼저 생일을 축하해 줘서 고마워요!",
        "zh": "你是第一个祝我生日快乐的人。谢谢你！",
        "ja": "誰よりも先にお祝いしてくれてありがとう！",
        "es": "Fuiste la primera persona en felicitarme. ¡Gracias!",
        "ta": "முதலில் பிறந்தநாள் வாழ்த்து சொன்னது நீங்கள்தான். நன்றி!",
        "hi": "सबसे पहले जन्मदिन की बधाई देने वाले आप ही थे। धन्यवाद!",
        "fr": "C’est toi qui m’as souhaité mon anniversaire en premier. Merci !",
        "it": "I tuoi auguri sono arrivati prima di tutti. Grazie!",
        "de": "Dein Glückwunsch war der allererste. Danke!",
    },
    "happy_tears": {
        "en": "You made me cry happy tears. Best birthday wish ever!",
        "ko": "기뻐서 눈물이 났어요. 최고의 생일 축하예요!",
        "zh": "你让我感动得哭了。这是最棒的生日祝福！",
        "ja": "うれし泣きしちゃいました。最高のお祝いです！",
        "es": "Me hiciste llorar de felicidad. ¡El mejor saludo de cumpleaños!",
        "ta": "மகிழ்ச்சியில் கண்ணீர் வந்துவிட்டது. இதுவரை கிடைத்த சிறந்த பிறந்தநாள் வாழ்த்து!",
        "hi": "आपने मुझे ख़ुशी के आँसू रुला दिए। अब तक की सबसे अच्छी जन्मदिन की बधाई!",
        "fr": "Tu m’as fait pleurer de joie. Le plus beau message d’anniversaire !",
        "it": "Mi hai fatto piangere di gioia. Gli auguri più belli di sempre!",
        "de": "Ich habe vor Freude geweint. Der schönste Geburtstagsgruß überhaupt!",
    },
    "best_surprise": {
        "en": "What a birthday surprise! I loved every second.",
        "ko": "정말 멋진 생일 서프라이즈예요! 처음부터 끝까지 좋았어요.",
        "zh": "多么棒的生日惊喜！我每一秒都很喜欢。",
        "ja": "なんて素敵な誕生日サプライズ！最初から最後まで大好きでした。",
        "es": "¡Qué sorpresa de cumpleaños! Me encantó cada segundo.",
        "ta": "என்ன ஒரு பிறந்தநாள் ஆச்சரியம்! ஒவ்வொரு நொடியும் எனக்குப் பிடித்தது.",
        "hi": "क्या शानदार जन्मदिन सरप्राइज़ था! मुझे हर पल पसंद आया।",
        "fr": "Quelle surprise d’anniversaire ! J’ai adoré chaque seconde.",
        "it": "Che sorpresa di compleanno! Ho adorato ogni secondo.",
        "de": "Was für eine Geburtstagsüberraschung! Ich habe jede Sekunde geliebt.",
    },
    "miss_you": {
        "en": "I miss you too. Thank you for remembering my birthday!",
        "ko": "나도 보고 싶어요. 내 생일을 기억해 줘서 고마워요!",
        "zh": "我也想你。谢谢你记得我的生日！",
        "ja": "私も会いたいです。誕生日を覚えていてくれてありがとう！",
        "es": "Yo también te extraño. ¡Gracias por acordarte de mi cumpleaños!",
        "ta": "எனக்கும் உங்கள் நினைவாகவே இருக்கிறது. என் பிறந்தநாளை நினைவில் வைத்ததற்கு நன்றி!",
        "hi": "मुझे भी आपकी याद आती है। मेरा जन्मदिन याद रखने के लिए धन्यवाद!",
        "fr": "Tu me manques aussi. Merci de ne pas avoir oublié mon anniversaire !",
        "it": "Anche tu mi manchi. Grazie per aver ricordato il mio compleanno!",
        "de": "Ich vermisse dich auch. Danke, dass du an meinen Geburtstag gedacht hast!",
    },
}

REPLY_MAX_LENGTH = 500


def reply_text(preset_key: str | None, text: str | None, lang: str = "en") -> str:
    if not preset_key:
        return text or ""
    texts = REPLY_PRESETS.get(preset_key, {})
    return texts.get(lang) or texts.get("en", "")
