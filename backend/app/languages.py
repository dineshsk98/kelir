"""The message languages (spec.md > Message languages and fonts): the one list the API, the
emails, the reply presets and the database checks are built from. The web app keeps its own
copy (frontend/src/languages.ts), since it can't import Python."""

MESSAGE_LANGS = ("en", "ko", "zh", "ja", "es", "ta", "hi", "fr", "it", "de")

# The <html lang> value, where it isn't the code itself: Chinese is written in Simplified
_HTML_LANG = {"zh": "zh-Hans"}


def html_lang(lang: str) -> str:
    return _HTML_LANG.get(lang, lang)


def lang_check(column: str) -> str:
    """A database CHECK that `column` is one of the languages."""
    return f"{column} IN ({', '.join(repr(code) for code in MESSAGE_LANGS)})"
