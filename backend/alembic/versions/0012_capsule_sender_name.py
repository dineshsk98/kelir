"""capsules.sender_name: the sender's name is frozen on the capsule when it is saved

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("capsules", sa.Column("sender_name", sa.String(255), nullable=True))
    # Every existing capsule keeps the name its sender has now
    op.execute(
        """
        UPDATE capsules SET sender_name = senders.name
        FROM senders
        WHERE senders.id = capsules.sender_id
        """
    )
    op.alter_column("capsules", "sender_name", nullable=False)


def downgrade() -> None:
    op.drop_column("capsules", "sender_name")
