"""Add screening_questions to jobs for matching / interview prep

Revision ID: 023_job_screening_questions
Revises: 022_job_matching_fields
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "023_job_screening_questions"
down_revision: Union[str, None] = "022_job_matching_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("screening_questions", postgresql.ARRAY(sa.String()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("jobs", "screening_questions")
