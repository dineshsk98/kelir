"""people: the sender's regular recipients, saved by every capsule they're sent

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-04
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "people",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("sender_id", sa.Uuid(), sa.ForeignKey("senders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("birth_month", sa.SmallInteger(), nullable=False),
        sa.Column("birth_day", sa.SmallInteger(), nullable=False),
        sa.Column("feb29_pref", sa.String(6)),
        sa.Column("city_label", sa.String(200), nullable=False),
        sa.Column("tz", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("sender_id", "email", name="uq_people_sender_email"),
        sa.CheckConstraint("email = lower(email)", name="person_email_lowercase"),
        sa.CheckConstraint("birth_month BETWEEN 1 AND 12", name="person_birth_month_range"),
        sa.CheckConstraint("birth_day BETWEEN 1 AND 31", name="person_birth_day_range"),
        sa.CheckConstraint("feb29_pref IN ('FEB_28', 'MAR_1')", name="person_feb29_pref_valid"),
    )
    op.add_column(
        "capsules",
        sa.Column("person_id", sa.Uuid(), sa.ForeignKey("people.id", ondelete="SET NULL")),
    )
    op.create_index("ix_capsules_person_id", "capsules", ["person_id"])

    # Everyone already sent to becomes a person, with the details of their latest capsule
    op.execute(
        """
        INSERT INTO people (id, sender_id, name, email, birth_month, birth_day, feb29_pref,
                            city_label, tz, created_at, updated_at)
        SELECT DISTINCT ON (sender_id, lower(recipient_email))
               gen_random_uuid(), sender_id, recipient_name, lower(recipient_email), birth_month,
               birth_day, feb29_pref, city_label, tz, created_at, created_at
        FROM capsules
        ORDER BY sender_id, lower(recipient_email), created_at DESC
        """
    )
    op.execute(
        """
        UPDATE capsules SET person_id = people.id
        FROM people
        WHERE people.sender_id = capsules.sender_id AND people.email = lower(capsules.recipient_email)
        """
    )


def downgrade() -> None:
    op.drop_index("ix_capsules_person_id", "capsules")
    op.drop_column("capsules", "person_id")
    op.drop_table("people")
