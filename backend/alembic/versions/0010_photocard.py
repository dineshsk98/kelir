"""photocard: which uploaded photo (if any) is shown on the recipient's photocard

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing capsules keep the default photocard
    op.add_column(
        "capsule_media",
        sa.Column("photocard", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_check_constraint("photocard_is_image", "capsule_media", "NOT photocard OR kind = 'image'")
    op.create_index(
        "uq_capsule_media_photocard",
        "capsule_media",
        ["capsule_id"],
        unique=True,
        postgresql_where=sa.text("photocard"),
    )


def downgrade() -> None:
    op.drop_index("uq_capsule_media_photocard", table_name="capsule_media")
    op.drop_constraint("photocard_is_image", "capsule_media", type_="check")
    op.drop_column("capsule_media", "photocard")
