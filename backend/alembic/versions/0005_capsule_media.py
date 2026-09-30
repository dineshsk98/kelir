"""capsule media: several photos, audio and video files per capsule

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "capsule_media",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("senders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("capsule_id", sa.Uuid(), sa.ForeignKey("capsules.id", ondelete="CASCADE")),
        sa.Column("position", sa.SmallInteger()),
        sa.Column("kind", sa.String(5), nullable=False),
        sa.Column("mime", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("kind IN ('image', 'audio', 'video')", name="media_kind_valid"),
        sa.CheckConstraint("position BETWEEN 0 AND 5", name="media_position_range"),
        sa.CheckConstraint(
            "(capsule_id IS NULL) = (position IS NULL)", name="media_attached_has_position"
        ),
        sa.UniqueConstraint("capsule_id", "position", name="uq_capsule_media_position"),
    )
    op.create_index("ix_capsule_media_capsule_id", "capsule_media", ["capsule_id"])
    op.create_index(
        "ix_capsule_media_unattached",
        "capsule_media",
        ["created_at"],
        postgresql_where=sa.text("capsule_id IS NULL"),
    )

    # The single-media columns were never used (media arrives with this migration)
    op.drop_constraint("message_present", "capsules", type_="check")
    op.drop_constraint("media_kind_valid", "capsules", type_="check")
    op.drop_column("capsules", "media_kind")
    op.drop_column("capsules", "media_path")
    op.drop_column("capsules", "media_mime")


def downgrade() -> None:
    op.add_column("capsules", sa.Column("media_mime", sa.String(100)))
    op.add_column("capsules", sa.Column("media_path", sa.String(500)))
    op.add_column("capsules", sa.Column("media_kind", sa.String(5)))
    op.create_check_constraint("media_kind_valid", "capsules", "media_kind IN ('audio', 'video')")
    op.create_check_constraint(
        "message_present", "capsules", "message_text IS NOT NULL OR media_kind IS NOT NULL"
    )
    op.drop_index("ix_capsule_media_unattached", table_name="capsule_media")
    op.drop_index("ix_capsule_media_capsule_id", table_name="capsule_media")
    op.drop_table("capsule_media")
