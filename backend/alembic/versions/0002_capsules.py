"""capsules

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "capsules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "sender_id",
            sa.Uuid(),
            sa.ForeignKey("senders.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recipient_name", sa.String(120), nullable=False),
        sa.Column("recipient_email", sa.String(320), nullable=False),
        sa.Column("birth_month", sa.SmallInteger(), nullable=False),
        sa.Column("birth_day", sa.SmallInteger(), nullable=False),
        sa.Column("feb29_pref", sa.String(6)),
        sa.Column("city_label", sa.String(200), nullable=False),
        sa.Column("tz", sa.String(64), nullable=False),
        sa.Column("message_text", sa.Text()),
        sa.Column("media_kind", sa.String(5)),
        sa.Column("media_path", sa.String(500)),
        sa.Column("media_mime", sa.String(100)),
        sa.Column("gift_kind", sa.String(4)),
        sa.Column("gift_value", sa.String(2000)),
        sa.Column("gift_note", sa.String(300)),
        sa.Column("send_mode", sa.String(8), nullable=False),
        sa.Column("deliver_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(9), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("opened_at", sa.DateTime(timezone=True)),
        sa.Column("link_token_hash", sa.String(64), unique=True),
        sa.Column("send_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("send_error", sa.Text()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "message_text IS NOT NULL OR media_kind IS NOT NULL", name="message_present"
        ),
        sa.CheckConstraint("birth_month BETWEEN 1 AND 12", name="birth_month_range"),
        sa.CheckConstraint("birth_day BETWEEN 1 AND 31", name="birth_day_range"),
        sa.CheckConstraint("feb29_pref IN ('FEB_28', 'MAR_1')", name="feb29_pref_valid"),
        sa.CheckConstraint("media_kind IN ('audio', 'video')", name="media_kind_valid"),
        sa.CheckConstraint("gift_kind IN ('link', 'code')", name="gift_kind_valid"),
        sa.CheckConstraint("send_mode IN ('birthday', 'now')", name="send_mode_valid"),
        sa.CheckConstraint(
            "status IN ('scheduled', 'delivered', 'opened', 'cancelled')", name="status_valid"
        ),
    )
    op.create_index("ix_capsules_status_deliver_at", "capsules", ["status", "deliver_at"])
    op.create_index("ix_capsules_sender_created", "capsules", ["sender_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_capsules_sender_created", table_name="capsules")
    op.drop_index("ix_capsules_status_deliver_at", table_name="capsules")
    op.drop_table("capsules")
