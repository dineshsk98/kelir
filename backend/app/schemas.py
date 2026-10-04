"""Request and response bodies."""

import uuid
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Literal
from urllib.parse import urlsplit
from zoneinfo import available_timezones

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

from app.email_check import is_valid_format
from app.engine.schedule import validate_birthday
from app.replies import REPLY_MAX_LENGTH, REPLY_PRESETS, reply_text


class GoogleSignIn(BaseModel):
    credential: str


class Me(BaseModel):
    id: uuid.UUID
    email: str
    name: str


class PublicConfig(BaseModel):
    """Everything here is visible to any browser: never add secrets."""

    google_client_id: str
    demo_mode: bool


# --- Capsules -----------------------------------------------------------------


@lru_cache
def _known_zones() -> frozenset[str]:
    return frozenset(available_timezones())


def _email(v: str) -> str:
    if not is_valid_format(v):
        raise ValueError("not a valid email address")
    return v.lower()


def _zone(v: str) -> str:
    if v not in _known_zones():
        raise ValueError("unknown time zone")
    return v


def _blank_to_none(v: str | None) -> str | None:
    return v or None


Text = Annotated[str, StringConstraints(strip_whitespace=True)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Email = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=320), AfterValidator(_email)
]
Zone = Annotated[str, AfterValidator(_zone)]
Feb29Pref = Literal["FEB_28", "MAR_1"]
SendMode = Literal["birthday", "now"]
GiftKind = Literal["link", "code"]
# The same list as app.delivery.email_copy.MESSAGE_LANGS (a test keeps them in step)
MessageLang = Literal["en", "ko", "zh", "ja", "es", "ta", "hi", "fr", "it", "de"]


class Birthday(BaseModel):
    birth_month: int = Field(ge=1, le=12)
    birth_day: int = Field(ge=1, le=31)
    feb29_pref: Feb29Pref | None = None

    @model_validator(mode="after")
    def _real_date(self):
        validate_birthday(self.birth_month, self.birth_day, self.feb29_pref)
        if (self.birth_month, self.birth_day) != (2, 29):
            self.feb29_pref = None
        return self


class EmailCheckIn(BaseModel):
    email: Annotated[str, StringConstraints(strip_whitespace=True, max_length=320)]


class EmailCheckOut(BaseModel):
    valid_format: bool
    # True: the domain accepts mail; False: it can't; None: couldn't check right now
    accepts_mail: bool | None


class DeliveryPreviewIn(Birthday):
    tz: Zone
    send_mode: SendMode = "birthday"


class DeliveryPreviewOut(BaseModel):
    deliver_at: datetime


class CapsuleCreate(Birthday):
    model_config = ConfigDict(extra="forbid")

    recipient_name: Name
    recipient_email: Email
    city_label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    tz: Zone

    message_text: Annotated[Text | None, Field(max_length=5000), AfterValidator(_blank_to_none)] = None
    message_lang: MessageLang = "en"

    gift_kind: GiftKind | None = None
    gift_value: Annotated[Text | None, Field(max_length=2000), AfterValidator(_blank_to_none)] = None
    gift_note: Annotated[Text | None, Field(max_length=300), AfterValidator(_blank_to_none)] = None

    send_mode: SendMode = "birthday"

    # Uploaded photos/audio/video, in the order they appear in the capsule
    upload_ids: Annotated[list[uuid.UUID], Field(max_length=6)] = []

    @model_validator(mode="after")
    def _message_and_gift(self):
        if self.message_text is None and not self.upload_ids:
            raise ValueError("write a message or add a photo, audio or video")
        if len(set(self.upload_ids)) != len(self.upload_ids):
            raise ValueError("the same file was added twice")
        if self.gift_kind is None:
            self.gift_value = self.gift_note = None
        elif self.gift_value is None:
            raise ValueError("a gift needs a link or a code")
        elif self.gift_kind == "link":
            # Only real web links: never javascript:, data: or other schemes on the recipient page
            parts = urlsplit(self.gift_value)
            if parts.scheme not in ("http", "https") or not parts.netloc:
                raise ValueError("a gift link must start with http:// or https://")
        elif len(self.gift_value) > 200:
            raise ValueError("a gift code can be at most 200 characters")
        return self


class ReplyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preset_key: str | None = None
    text: Annotated[Text | None, AfterValidator(_blank_to_none)] = None
    lang: MessageLang = "en"

    @model_validator(mode="after")
    def _one_of(self):
        if (self.preset_key is None) == (self.text is None):
            raise ValueError("choose a thank-you or write your own")
        if self.preset_key is not None and self.preset_key not in REPLY_PRESETS:
            raise ValueError("unknown thank-you")
        if self.text is not None and len(self.text) > REPLY_MAX_LENGTH:
            raise ValueError(f"a thank-you can be at most {REPLY_MAX_LENGTH} characters")
        return self


class ReplyOut(BaseModel):
    text: str
    lang: MessageLang
    created_at: datetime

    @classmethod
    def from_model(cls, reply) -> "ReplyOut | None":
        if reply is None:
            return None
        return cls(
            text=reply_text(reply.preset_key, reply.text, reply.lang),
            lang=reply.lang,
            created_at=reply.created_at,
        )


class ReplyPreset(BaseModel):
    key: str
    texts: dict[MessageLang, str]  # the same thank-you in every message language


def _reply(value):
    """Accept a Reply row (from the ORM) or an already-built ReplyOut/dict."""
    if value is None or isinstance(value, (ReplyOut, dict)):
        return value
    return ReplyOut.from_model(value)


MediaKind = Literal["image", "audio", "video"]


class MediaOut(BaseModel):
    """One media item. The URL depends on who's asking (sender preview or recipient link)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    kind: MediaKind
    mime: str
    size_bytes: int


class CapsuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    recipient_name: str
    recipient_email: str
    birth_month: int
    birth_day: int
    feb29_pref: Feb29Pref | None
    city_label: str
    tz: str
    message_text: str | None
    message_lang: MessageLang
    media: list[MediaOut]
    gift_kind: GiftKind | None
    gift_value: str | None
    gift_note: str | None
    send_mode: SendMode
    deliver_at: datetime
    status: Literal["scheduled", "delivered", "opened", "cancelled"]
    delivery_trouble: bool
    opened_at: datetime | None
    reply: Annotated[ReplyOut | None, BeforeValidator(_reply)] = None
    created_at: datetime


class RecipientCapsuleOut(BaseModel):
    """What the private link shows: only what the recipient needs, nothing about delivery."""

    model_config = ConfigDict(from_attributes=True)

    sender_name: str
    recipient_name: str
    message_text: str | None
    message_lang: MessageLang
    media: list[MediaOut]
    gift_kind: GiftKind | None
    gift_value: str | None
    gift_note: str | None
    reply: ReplyOut | None
    reply_presets: list[ReplyPreset]
