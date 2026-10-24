"""Database tables (spec.md > Data Model)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.languages import lang_check


class Base(DeclarativeBase):
    pass


class Sender(Base):
    """An account: one verified email, signed into with Google or with an emailed code. It
    sends capsules and opens the ones sent to its email."""

    __tablename__ = "senders"
    __table_args__ = (CheckConstraint("email = lower(email)", name="sender_email_lowercase"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # Set once the account has signed in with Google (accounts made by email code have none yet)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(255))
    # The owner chose this name (in the app): signing in with Google no longer replaces it
    name_edited: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Person(Base):
    """Someone a sender has sent to (prd.md > Regular recipients). Saved or updated by every
    capsule they're sent; their capsules keep their own copy of the details."""

    __tablename__ = "people"
    __table_args__ = (
        # Emails arrive lowercased from the API, so this is unique regardless of case
        UniqueConstraint("sender_id", "email", name="uq_people_sender_email"),
        CheckConstraint("email = lower(email)", name="person_email_lowercase"),
        CheckConstraint("birth_month BETWEEN 1 AND 12", name="person_birth_month_range"),
        CheckConstraint("birth_day BETWEEN 1 AND 31", name="person_birth_day_range"),
        CheckConstraint("feb29_pref IN ('FEB_28', 'MAR_1')", name="person_feb29_pref_valid"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("senders.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(320))
    birth_month: Mapped[int] = mapped_column(SmallInteger)
    birth_day: Mapped[int] = mapped_column(SmallInteger)
    feb29_pref: Mapped[str | None] = mapped_column(String(6))
    city_label: Mapped[str] = mapped_column(String(200))
    tz: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Capsule(Base):
    __tablename__ = "capsules"
    __table_args__ = (
        # "Text or media" is checked by the API: media lives in capsule_media
        CheckConstraint("birth_month BETWEEN 1 AND 12", name="birth_month_range"),
        CheckConstraint("birth_day BETWEEN 1 AND 31", name="birth_day_range"),
        CheckConstraint("feb29_pref IN ('FEB_28', 'MAR_1')", name="feb29_pref_valid"),
        CheckConstraint("gift_kind IN ('link', 'code')", name="gift_kind_valid"),
        CheckConstraint("send_mode IN ('birthday', 'now')", name="send_mode_valid"),
        CheckConstraint(
            lang_check("message_lang"),
            name="message_lang_valid",
        ),
        CheckConstraint(
            "status IN ('scheduled', 'delivered', 'opened', 'cancelled')", name="status_valid"
        ),
        Index("ix_capsules_status_deliver_at", "status", "deliver_at"),
        Index("ix_capsules_sender_created", "sender_id", "created_at"),
        Index(
            "ix_capsules_email_queue",
            "next_send_at",
            postgresql_where=text("status = 'delivered' AND emailed_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("senders.id", ondelete="CASCADE"))
    # The saved person this was sent to; removing them leaves the capsule as it is
    person_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("people.id", ondelete="SET NULL"), index=True
    )

    # Recipient
    recipient_name: Mapped[str] = mapped_column(String(120))
    recipient_email: Mapped[str] = mapped_column(String(320))
    birth_month: Mapped[int] = mapped_column(SmallInteger)
    birth_day: Mapped[int] = mapped_column(SmallInteger)
    feb29_pref: Mapped[str | None] = mapped_column(String(6))
    city_label: Mapped[str] = mapped_column(String(200))
    tz: Mapped[str] = mapped_column(String(64))

    # Message and gift
    message_text: Mapped[str | None] = mapped_column(Text)
    # Sets the message's handwritten font and the email's words
    message_lang: Mapped[str] = mapped_column(String(2), default="en", server_default="en")
    gift_kind: Mapped[str | None] = mapped_column(String(4))
    gift_value: Mapped[str | None] = mapped_column(String(2000))
    gift_note: Mapped[str | None] = mapped_column(String(300))

    # Delivery
    send_mode: Mapped[str] = mapped_column(String(8))
    deliver_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(9), default="scheduled")
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The sender's name as it was when this was saved. Editing the capsule later never changes it,
    # and renaming yourself only applies to capsules made afterwards.
    sender_name: Mapped[str] = mapped_column(String(255))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    link_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    # Email sending (at least once, after the exactly-once delivery transition)
    send_attempts: Mapped[int] = mapped_column(Integer, default=0)
    send_error: Mapped[str | None] = mapped_column(Text)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Loaded together with the capsule so lists don't need a query per row
    reply: Mapped["Reply | None"] = relationship(lazy="selectin", uselist=False)
    media: Mapped[list["CapsuleMedia"]] = relationship(
        lazy="selectin", order_by="CapsuleMedia.position", passive_deletes=True
    )

    @property
    def delivery_trouble(self) -> bool:
        """Delivered, but the email hasn't gone out and the last attempt failed."""
        return self.status == "delivered" and self.emailed_at is None and self.send_error is not None

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Reply(Base):
    """The recipient's thank-you: one per capsule, a preset or their own text."""

    __tablename__ = "replies"
    __table_args__ = (
        CheckConstraint("(preset_key IS NULL) <> (text IS NULL)", name="preset_or_text"),
        CheckConstraint(
            lang_check("lang"),
            name="reply_lang_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    capsule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("capsules.id", ondelete="CASCADE"), unique=True
    )
    preset_key: Mapped[str | None] = mapped_column(String(40))
    text: Mapped[str | None] = mapped_column(String(500))
    # The language it was written in (or a preset was picked in): sets its handwriting
    lang: Mapped[str] = mapped_column(String(2), default="en", server_default="en")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CapsuleMedia(Base):
    """One uploaded photo, audio or video file. Its id is the upload_id; it belongs to the
    sender from upload and joins a capsule (at a position) when the capsule is saved."""

    __tablename__ = "capsule_media"
    __table_args__ = (
        CheckConstraint("kind IN ('image', 'audio', 'video')", name="media_kind_valid"),
        CheckConstraint("position BETWEEN 0 AND 5", name="media_position_range"),
        CheckConstraint("(capsule_id IS NULL) = (position IS NULL)", name="media_attached_has_position"),
        UniqueConstraint("capsule_id", "position", name="uq_capsule_media_position"),
        # The photo shown on the photocard: at most one per capsule, and it must be a photo
        CheckConstraint("NOT photocard OR kind = 'image'", name="photocard_is_image"),
        Index("uq_capsule_media_photocard", "capsule_id", unique=True, postgresql_where=text("photocard")),
        Index("ix_capsule_media_unattached", "created_at", postgresql_where=text("capsule_id IS NULL")),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("senders.id", ondelete="CASCADE"))
    capsule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("capsules.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int | None] = mapped_column(SmallInteger)
    kind: Mapped[str] = mapped_column(String(5))
    mime: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    path: Mapped[str] = mapped_column(String(500))
    # Shown on the photocard instead of the default picture (at most one photo per capsule)
    photocard: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EmailCode(Base):
    """A one-time sign-in code emailed to an address (spec.md > Sign-in and sessions). Only a
    keyed hash of the code is stored; the newest code for an email replaces the ones before."""

    __tablename__ = "email_codes"
    __table_args__ = (
        Index("ix_email_codes_email_created", "email", "created_at"),
        CheckConstraint("attempts >= 0", name="email_code_attempts_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320))
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(SmallInteger, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
