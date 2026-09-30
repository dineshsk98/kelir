"""email sending state

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("capsules", sa.Column("next_send_at", sa.DateTime(timezone=True)))
    op.add_column("capsules", sa.Column("emailed_at", sa.DateTime(timezone=True)))
    # The email queue: delivered capsules whose email hasn't gone out yet
    op.create_index(
        "ix_capsules_email_queue",
        "capsules",
        ["next_send_at"],
        postgresql_where=sa.text("status = 'delivered' AND emailed_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_capsules_email_queue", table_name="capsules")
    op.drop_column("capsules", "emailed_at")
    op.drop_column("capsules", "next_send_at")
