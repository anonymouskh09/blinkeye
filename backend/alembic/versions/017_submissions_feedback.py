"""submissions + client_feedback tables

Revision ID: 017_submissions_feedback
Revises: 016_engagements
Create Date: 2026-08-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "017_submissions_feedback"
down_revision: Union[str, None] = "016_engagements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE submission_status AS ENUM "
        "('submitted', 'client_reviewing', 'client_interested', 'rejected', "
        "'interview_requested', 'interview_scheduled', 'offer', 'placed'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE client_feedback_type AS ENUM "
        "('interested', 'rejected', 'interview_requested', "
        "'more_information_requested', 'general_feedback'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    submission_status = postgresql.ENUM(
        "submitted",
        "client_reviewing",
        "client_interested",
        "rejected",
        "interview_requested",
        "interview_scheduled",
        "offer",
        "placed",
        name="submission_status",
        create_type=False,
    )
    feedback_type = postgresql.ENUM(
        "interested",
        "rejected",
        "interview_requested",
        "more_information_requested",
        "general_feedback",
        name="client_feedback_type",
        create_type=False,
    )

    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("candidate_job_assignment_id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("submission_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("resume_file_path", sa.String(length=500), nullable=True),
        sa.Column("candidate_summary", sa.Text(), nullable=True),
        sa.Column("expected_compensation", sa.String(length=255), nullable=True),
        sa.Column("availability", sa.String(length=255), nullable=True),
        sa.Column("recruiter_notes", sa.Text(), nullable=True),
        sa.Column("status", submission_status, server_default="submitted", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_job_assignment_id"], ["candidate_job_assignments.id"]),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_submissions_candidate_job_assignment_id", "submissions", ["candidate_job_assignment_id"])
    op.create_index("ix_submissions_candidate_id", "submissions", ["candidate_id"])
    op.create_index("ix_submissions_job_id", "submissions", ["job_id"])
    op.create_index("ix_submissions_client_id", "submissions", ["client_id"])
    op.create_index("ix_submissions_engagement_id", "submissions", ["engagement_id"])
    op.create_index("ix_submissions_recruiter_id", "submissions", ["recruiter_id"])
    op.create_index("ix_submissions_status", "submissions", ["status"])

    op.create_table(
        "client_feedback",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("feedback_type", feedback_type, nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("rejection_reason", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("feedback_date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_feedback_submission_id", "client_feedback", ["submission_id"])
    op.create_index("ix_client_feedback_feedback_type", "client_feedback", ["feedback_type"])
    op.create_index("ix_client_feedback_created_by", "client_feedback", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_client_feedback_created_by", table_name="client_feedback")
    op.drop_index("ix_client_feedback_feedback_type", table_name="client_feedback")
    op.drop_index("ix_client_feedback_submission_id", table_name="client_feedback")
    op.drop_table("client_feedback")

    op.drop_index("ix_submissions_status", table_name="submissions")
    op.drop_index("ix_submissions_recruiter_id", table_name="submissions")
    op.drop_index("ix_submissions_engagement_id", table_name="submissions")
    op.drop_index("ix_submissions_client_id", table_name="submissions")
    op.drop_index("ix_submissions_job_id", table_name="submissions")
    op.drop_index("ix_submissions_candidate_id", table_name="submissions")
    op.drop_index("ix_submissions_candidate_job_assignment_id", table_name="submissions")
    op.drop_table("submissions")

    op.execute("DROP TYPE IF EXISTS client_feedback_type")
    op.execute("DROP TYPE IF EXISTS submission_status")
