"""add candidate profile ATS fields

Revision ID: 011_candidate_profile_fields
Revises: 010_email_logs_updated_at
Create Date: 2026-06-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_candidate_profile_fields"
down_revision: Union[str, None] = "010_email_logs_updated_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "candidates",
        sa.Column("candidate_status", sa.String(20), nullable=False, server_default="new"),
    )
    op.add_column("candidates", sa.Column("candidate_rating", sa.Integer(), nullable=True))
    op.add_column(
        "candidates",
        sa.Column("assigned_job_id", sa.Integer(), sa.ForeignKey("jobs.id"), nullable=True),
    )
    op.add_column("candidates", sa.Column("salary_min", sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("salary_max", sa.Integer(), nullable=True))
    op.add_column(
        "candidates",
        sa.Column("salary_currency", sa.String(10), nullable=True, server_default="USD"),
    )
    op.add_column("candidates", sa.Column("timezone", sa.String(100), nullable=True))
    op.create_index("ix_candidates_assigned_job_id", "candidates", ["assigned_job_id"])


def downgrade() -> None:
    op.drop_index("ix_candidates_assigned_job_id", table_name="candidates")
    op.drop_column("candidates", "timezone")
    op.drop_column("candidates", "salary_currency")
    op.drop_column("candidates", "salary_max")
    op.drop_column("candidates", "salary_min")
    op.drop_column("candidates", "assigned_job_id")
    op.drop_column("candidates", "candidate_rating")
    op.drop_column("candidates", "candidate_status")
