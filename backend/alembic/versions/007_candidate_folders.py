"""candidate folders

Revision ID: 007_candidate_folders
Revises: 006_candidate_profile
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_candidate_folders"
down_revision: Union[str, None] = "006_candidate_profile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "candidate_folders",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_candidate_folders_name"), "candidate_folders", ["name"], unique=False)
    op.create_index(op.f("ix_candidate_folders_created_by"), "candidate_folders", ["created_by"], unique=False)

    op.create_table(
        "candidate_folder_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("folder_id", sa.Integer(), nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("added_by", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["added_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["folder_id"], ["candidate_folders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("folder_id", "candidate_id", name="uq_folder_candidate"),
    )
    op.create_index(op.f("ix_candidate_folder_members_folder_id"), "candidate_folder_members", ["folder_id"], unique=False)
    op.create_index(op.f("ix_candidate_folder_members_candidate_id"), "candidate_folder_members", ["candidate_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_candidate_folder_members_candidate_id"), table_name="candidate_folder_members")
    op.drop_index(op.f("ix_candidate_folder_members_folder_id"), table_name="candidate_folder_members")
    op.drop_table("candidate_folder_members")
    op.drop_index(op.f("ix_candidate_folders_created_by"), table_name="candidate_folders")
    op.drop_index(op.f("ix_candidate_folders_name"), table_name="candidate_folders")
    op.drop_table("candidate_folders")
