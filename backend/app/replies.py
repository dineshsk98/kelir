"""Preset thank-you messages (prd.md > Thank-you reply). Stored by key and language, shown as
text. Each preset is offered in every message language (the same list as
app.delivery.email_copy.MESSAGE_LANGS; a test keeps them in step)."""

REPLY_PRESETS: dict[str, dict[str, str]] = {
    "made_my_day": {
        "en": "Thank you so much, this made my day!",
        "ko": "정말 고마워요, 덕분에 최고의 하루가 됐어요!",
        "zh": "太谢谢你了，你让我今天特别开心！",
        "ja": "本当にありがとう、最高の一日になりました！",
        "es": "¡Muchísimas gracias, me alegraste el día!",
        "ta": "மிக்க நன்றி, இன்று என் நாளையே இனிமையாக்கிவிட்டீர்கள்!",
        "hi": "बहुत-बहुत धन्यवाद, आपने मेरा दिन बना दिया!",
        "fr": "Merci beaucoup, tu as illuminé ma journée !",
        "it": "Grazie mille, mi hai fatto la giornata!",
        "de": "Vielen Dank, du hast mir den Tag versüßt!",
    },
    "happy_tears": {
        "en": "You made me cry happy tears. Thank you!",
        "ko": "기뻐서 눈물이 났어요. 고마워요!",
        "zh": "你让我感动得哭了。谢谢你！",
        "ja": "うれし泣きしちゃいました。ありがとう！",
        "es": "Me hiciste llorar de felicidad. ¡Gracias!",
        "ta": "மகிழ்ச்சியில் கண்ணீர் வந்துவிட்டது. நன்றி!",
        "hi": "आपने मुझे ख़ुशी के आँसू रुला दिए। धन्यवाद!",
        "fr": "Tu m’as fait pleurer de joie. Merci !",
        "it": "Mi hai fatto piangere di gioia. Grazie!",
        "de": "Ich habe vor Freude geweint. Danke!",
    },
    "best_surprise": {
        "en": "Best birthday surprise ever. Thank you!",
        "ko": "최고의 생일 선물이에요. 고마워요!",
        "zh": "这是我收到过最棒的生日惊喜。谢谢你！",
        "ja": "今までで最高の誕生日サプライズです。ありがとう！",
        "es": "La mejor sorpresa de cumpleaños. ¡Gracias!",
        "ta": "இதுவரை கிடைத்த சிறந்த பிறந்தநாள் ஆச்சரியம். நன்றி!",
        "hi": "अब तक का सबसे अच्छा जन्मदिन सरप्राइज़। धन्यवाद!",
        "fr": "La plus belle surprise d’anniversaire. Merci !",
        "it": "La sorpresa di compleanno più bella di sempre. Grazie!",
        "de": "Die schönste Geburtstagsüberraschung überhaupt. Danke!",
    },
    "miss_you": {
        "en": "I miss you too. Thank you for remembering!",
        "ko": "나도 보고 싶어요. 기억해 줘서 고마워요!",
        "zh": "我也想你。谢谢你记得我的生日！",
        "ja": "私も会いたいです。覚えていてくれてありがとう！",
        "es": "Yo también te extraño. ¡Gracias por acordarte!",
        "ta": "எனக்கும் உங்கள் நினைவாகவே இருக்கிறது. நினைவில் வைத்ததற்கு நன்றி!",
        "hi": "मुझे भी आपकी याद आती है। याद रखने के लिए धन्यवाद!",
        "fr": "Tu me manques aussi. Merci d’avoir pensé à moi !",
        "it": "Anche tu mi manchi. Grazie per aver pensato a me!",
        "de": "Ich vermisse dich auch. Danke, dass du an mich gedacht hast!",
    },
}

REPLY_MAX_LENGTH = 500


def reply_text(preset_key: str | None, text: str | None, lang: str = "en") -> str:
    if not preset_key:
        return text or ""
    texts = REPLY_PRESETS.get(preset_key, {})
    return texts.get(lang) or texts.get("en", "")
