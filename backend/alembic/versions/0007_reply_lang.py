"""reply language: the thank-you's handwriting and which translation of a preset it is

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing replies were all written (or picked) in English
    op.add_column(
        "replies",
        sa.Column("lang", sa.String(2), nullable=False, server_default="en"),
    )
    op.create_check_constraint(
        "reply_lang_valid",
        "replies",
        "lang IN ('en', 'ko', 'zh', 'ja', 'es', 'ta', 'hi', 'fr', 'it', 'de')",
    )


def downgrade() -> None:
    op.drop_constraint("reply_lang_valid", "replies", type_="check")
    op.drop_column("replies", "lang")
