"""Add job archived status + candidate is_archived

Revision ID: 021_archive_jobs_candidates
Revises: 020_job_engagement_optional
Create Date: 2026-09-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "021_archive_jobs_candidates"
down_revision: Union[str, None] = "020_job_engagement_optional"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres enum: add archived value (run outside transaction if needed)
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'archived'")
    op.add_column(
        "candidates",
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_candidates_is_archived", "candidates", ["is_archived"])


def downgrade() -> None:
    op.drop_index("ix_candidates_is_archived", table_name="candidates")
    op.drop_column("candidates", "is_archived")
    # Cannot safely remove enum value from Postgres
