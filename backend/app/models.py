"""Database tables (spec.md > Data Model)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Sender(Base):
    __tablename__ = "senders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    google_sub: Mapped[str] = mapped_column(String(255), unique=True)
    email: Mapped[str] = mapped_column(String(320))
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Capsule(Base):
    __tablename__ = "capsules"
    __table_args__ = (
        CheckConstraint(
            "message_text IS NOT NULL OR media_kind IS NOT NULL", name="message_present"
        ),
        CheckConstraint("birth_month BETWEEN 1 AND 12", name="birth_month_range"),
        CheckConstraint("birth_day BETWEEN 1 AND 31", name="birth_day_range"),
        CheckConstraint("feb29_pref IN ('FEB_28', 'MAR_1')", name="feb29_pref_valid"),
        CheckConstraint("media_kind IN ('audio', 'video')", name="media_kind_valid"),
        CheckConstraint("gift_kind IN ('link', 'code')", name="gift_kind_valid"),
        CheckConstraint("send_mode IN ('birthday', 'now')", name="send_mode_valid"),
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
    media_kind: Mapped[str | None] = mapped_column(String(5))
    media_path: Mapped[str | None] = mapped_column(String(500))
    media_mime: Mapped[str | None] = mapped_column(String(100))
    gift_kind: Mapped[str | None] = mapped_column(String(4))
    gift_value: Mapped[str | None] = mapped_column(String(2000))
    gift_note: Mapped[str | None] = mapped_column(String(300))

    # Delivery
    send_mode: Mapped[str] = mapped_column(String(8))
    deliver_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(9), default="scheduled")
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    link_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    # Email sending (at least once, after the exactly-once delivery transition)
    send_attempts: Mapped[int] = mapped_column(Integer, default=0)
    send_error: Mapped[str | None] = mapped_column(Text)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Loaded together with the capsule so lists don't need a query per row
    reply: Mapped["Reply | None"] = relationship(lazy="selectin", uselist=False)

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
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    capsule_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("capsules.id", ondelete="CASCADE"), unique=True
    )
    preset_key: Mapped[str | None] = mapped_column(String(40))
    text: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
