"""Structured job requirements + candidate resume text (matching foundation)

Revision ID: 022_job_matching_fields
Revises: 021_archive_jobs_candidates
Create Date: 2026-09-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "022_job_matching_fields"
down_revision: Union[str, None] = "021_archive_jobs_candidates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("must_have_skills", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("jobs", sa.Column("nice_to_have_skills", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("jobs", sa.Column("min_experience_years", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("max_experience_years", sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("resume_text", sa.Text(), nullable=True))

    # Seed structured skills from the legacy free-text column so existing jobs
    # are not invisible to matching.
    op.execute(
        """
        UPDATE jobs
        SET must_have_skills = (
            SELECT array_agg(trimmed)
            FROM (
                SELECT btrim(part) AS trimmed
                FROM regexp_split_to_table(required_skills, '[,;|\\n]+') AS part
            ) s
            WHERE trimmed <> ''
        )
        WHERE required_skills IS NOT NULL
          AND btrim(required_skills) <> ''
          AND must_have_skills IS NULL
        """
    )


def downgrade() -> None:
    op.drop_column("candidates", "resume_text")
    op.drop_column("jobs", "max_experience_years")
    op.drop_column("jobs", "min_experience_years")
    op.drop_column("jobs", "nice_to_have_skills")
    op.drop_column("jobs", "must_have_skills")
