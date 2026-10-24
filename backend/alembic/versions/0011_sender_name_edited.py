"""senders.name_edited: a name the owner chose is kept when they sign in with Google

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Everyone so far has the name Google or their email gave them
    op.add_column(
        "senders",
        sa.Column("name_edited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("senders", "name_edited")
