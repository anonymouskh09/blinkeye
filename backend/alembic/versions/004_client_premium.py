"""Client tags, activities, note enhancements

Revision ID: 004_client_premium
Revises: 003_client_attachments
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "004_client_premium"
down_revision: Union[str, None] = "003_client_attachments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("tags", JSONB, nullable=True, server_default="[]"))
    op.add_column("notes", sa.Column("is_private", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("notes", sa.Column("category_type", sa.String(20), nullable=False, server_default="general"))
    op.add_column("notes", sa.Column("category_ref_id", sa.Integer(), nullable=True))
    op.add_column("notes", sa.Column("shared_with_guest", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "client_activities",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("activity_type", sa.String(length=20), nullable=False, server_default="task"),
        sa.Column("activity_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(length=10), nullable=True),
        sa.Column("end_time", sa.String(length=10), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("assigned_to_id", sa.Integer(), nullable=True),
        sa.Column("share_with_guests", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_to_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_client_activities_client_id", "client_activities", ["client_id"])


def downgrade() -> None:
    op.drop_table("client_activities")
    op.drop_column("notes", "shared_with_guest")
    op.drop_column("notes", "category_ref_id")
    op.drop_column("notes", "category_type")
    op.drop_column("notes", "is_private")
    op.drop_column("clients", "tags")
