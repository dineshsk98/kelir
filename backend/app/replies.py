"""Preset thank-you messages (prd.md > Thank-you reply). Stored by key, shown as text."""

REPLY_PRESETS: dict[str, str] = {
    "made_my_day": "Thank you so much, this made my day!",
    "happy_tears": "You made me cry happy tears. Thank you!",
    "best_surprise": "Best birthday surprise ever. Thank you!",
    "miss_you": "I miss you too. Thank you for remembering!",
}

REPLY_MAX_LENGTH = 500


def reply_text(preset_key: str | None, text: str | None) -> str:
    return REPLY_PRESETS.get(preset_key or "", "") if preset_key else (text or "")
