"""outreach sequences and gmail accounts

Revision ID: 009_outreach_gmail
Revises: 008_entity_activities
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_outreach_gmail"
down_revision: Union[str, None] = "008_entity_activities"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_email_accounts",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False, server_default="gmail"),
        sa.Column("email_address", sa.String(length=255), nullable=False),
        sa.Column("access_token_encrypted", sa.Text(), nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scopes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="connected"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_email_accounts_user_id", "user_email_accounts", ["user_id"])

    op.create_table(
        "outreach_sequences",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("sender_account_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["sender_account_id"], ["user_email_accounts.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outreach_sequences_created_by", "outreach_sequences", ["created_by_user_id"])

    op.create_table(
        "outreach_sequence_steps",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sequence_id", sa.Integer(), nullable=False),
        sa.Column("step_number", sa.Integer(), nullable=False),
        sa.Column("step_name", sa.String(length=255), nullable=False),
        sa.Column("subject", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("delay_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sequence_id"], ["outreach_sequences.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outreach_sequence_steps_sequence_id", "outreach_sequence_steps", ["sequence_id"])

    op.create_table(
        "outreach_enrollments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sequence_id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("next_send_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enrolled_by_user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["enrolled_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["sequence_id"], ["outreach_sequences.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sequence_id", "candidate_id", name="uq_outreach_enrollment_candidate"),
    )
    op.create_index("ix_outreach_enrollments_sequence_id", "outreach_enrollments", ["sequence_id"])
    op.create_index("ix_outreach_enrollments_candidate_id", "outreach_enrollments", ["candidate_id"])
    op.create_index("ix_outreach_enrollments_next_send_at", "outreach_enrollments", ["next_send_at"])

    op.create_table(
        "outreach_email_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sequence_id", sa.Integer(), nullable=False),
        sa.Column("step_id", sa.Integer(), nullable=True),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("sender_user_id", sa.Integer(), nullable=False),
        sa.Column("sender_email", sa.String(length=255), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("rendered_subject", sa.String(length=500), nullable=False),
        sa.Column("rendered_body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="scheduled"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["sender_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["sequence_id"], ["outreach_sequences.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["step_id"], ["outreach_sequence_steps.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outreach_email_logs_sequence_id", "outreach_email_logs", ["sequence_id"])
    op.create_index("ix_outreach_email_logs_sender_user_id", "outreach_email_logs", ["sender_user_id"])


def downgrade() -> None:
    op.drop_index("ix_outreach_email_logs_sender_user_id", table_name="outreach_email_logs")
    op.drop_index("ix_outreach_email_logs_sequence_id", table_name="outreach_email_logs")
    op.drop_table("outreach_email_logs")
    op.drop_index("ix_outreach_enrollments_next_send_at", table_name="outreach_enrollments")
    op.drop_index("ix_outreach_enrollments_candidate_id", table_name="outreach_enrollments")
    op.drop_index("ix_outreach_enrollments_sequence_id", table_name="outreach_enrollments")
    op.drop_table("outreach_enrollments")
    op.drop_index("ix_outreach_sequence_steps_sequence_id", table_name="outreach_sequence_steps")
    op.drop_table("outreach_sequence_steps")
    op.drop_index("ix_outreach_sequences_created_by", table_name="outreach_sequences")
    op.drop_table("outreach_sequences")
    op.drop_index("ix_user_email_accounts_user_id", table_name="user_email_accounts")
    op.drop_table("user_email_accounts")
