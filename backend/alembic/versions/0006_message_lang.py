"""message language: picks the message's handwritten font and the email's words

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing capsules were all written in English
    op.add_column(
        "capsules",
        sa.Column("message_lang", sa.String(2), nullable=False, server_default="en"),
    )
    op.create_check_constraint(
        "message_lang_valid",
        "capsules",
        "message_lang IN ('en', 'ko', 'zh', 'ja', 'es', 'ta', 'hi', 'fr', 'it', 'de')",
    )


def downgrade() -> None:
    op.drop_constraint("message_lang_valid", "capsules", type_="check")
    op.drop_column("capsules", "message_lang")
