"""email sign-in: accounts by verified email, signed into with Google or an emailed code

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-05
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # An account is one email: stored lowercased, and only once (Google and a code share it)
    op.execute("UPDATE senders SET email = lower(email)")
    op.create_check_constraint("sender_email_lowercase", "senders", "email = lower(email)")
    op.create_unique_constraint("senders_email_key", "senders", ["email"])
    # Accounts made with an emailed code have no Google identity until they use Google
    op.alter_column("senders", "google_sub", existing_type=sa.String(255), nullable=True)

    op.create_table(
        "email_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("attempts >= 0", name="email_code_attempts_positive"),
    )
    op.create_index("ix_email_codes_email_created", "email_codes", ["email", "created_at"])


def downgrade() -> None:
    op.drop_table("email_codes")
    # Accounts that never used Google can't exist before this revision
    op.execute("DELETE FROM senders WHERE google_sub IS NULL")
    op.alter_column("senders", "google_sub", existing_type=sa.String(255), nullable=False)
    op.drop_constraint("senders_email_key", "senders", type_="unique")
    op.drop_constraint("sender_email_lowercase", "senders", type_="check")
