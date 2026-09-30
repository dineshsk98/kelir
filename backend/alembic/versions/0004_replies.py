"""replies

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "replies",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "capsule_id",
            sa.Uuid(),
            sa.ForeignKey("capsules.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,  # one thank-you per capsule
        ),
        sa.Column("preset_key", sa.String(40)),
        sa.Column("text", sa.String(500)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("(preset_key IS NULL) <> (text IS NULL)", name="preset_or_text"),
    )


def downgrade() -> None:
    op.drop_table("replies")
