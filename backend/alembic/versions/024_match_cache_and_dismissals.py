"""Add match_scores cache and match_dismissals audit table

Revision ID: 024_match_cache_and_dismissals
Revises: 023_job_screening_questions
Create Date: 2026-09-25
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "024_match_cache_and_dismissals"
down_revision: Union[str, None] = "023_job_screening_questions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    return name in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    # main.py runs Base.metadata.create_all on startup, so a dev database may
    # already have these tables; only create what is missing.
    if not _has_table("match_scores"):
        op.create_table(
            "match_scores",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "candidate_id", sa.Integer(), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("overall_score", sa.Integer(), nullable=False),
            sa.Column("verdict", sa.String(20), nullable=False),
            sa.Column("must_have_total", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("must_have_matched", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("score_version", sa.Integer(), nullable=False),
            sa.Column("first_matched_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("job_id", "candidate_id", name="uq_match_score_pair"),
        )
        op.create_index("ix_match_scores_overall_score", "match_scores", ["overall_score"])
        op.create_index("ix_match_scores_verdict", "match_scores", ["verdict"])
        op.create_index("ix_match_scores_computed_at", "match_scores", ["computed_at"])
        op.create_index("ix_match_scores_job_score", "match_scores", ["job_id", "overall_score"])
        op.create_index("ix_match_scores_candidate_score", "match_scores", ["candidate_id", "overall_score"])

    if not _has_table("match_dismissals"):
        op.create_table(
            "match_dismissals",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("job_id", sa.Integer(), sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "candidate_id", sa.Integer(), sa.ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("reason", sa.String(40), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("dismissed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("dismissed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("undone_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("undone_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_match_dismissals_job_id", "match_dismissals", ["job_id"])
        op.create_index("ix_match_dismissals_candidate_id", "match_dismissals", ["candidate_id"])
        op.create_index(
            "uq_match_dismissal_active",
            "match_dismissals",
            ["job_id", "candidate_id"],
            unique=True,
            postgresql_where=sa.text("undone_at IS NULL"),
        )


def downgrade() -> None:
    op.drop_table("match_dismissals")
    op.drop_table("match_scores")
