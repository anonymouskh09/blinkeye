"""user permissions + client_hidden_members

Revision ID: 019_user_permissions_client_hide
Revises: 018_billing_offers_placements
Create Date: 2026-09-07
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_user_permissions_client_hide"
down_revision: Union[str, None] = "018_billing_offers_placements"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERM_COLS = [
    "can_view_clients",
    "can_add_clients",
    "can_edit_clients",
    "can_view_jobs",
    "can_add_jobs",
    "can_edit_jobs",
    "can_view_candidates",
    "can_add_candidates",
    "can_edit_candidates",
]


def upgrade() -> None:
    for col in PERM_COLS:
        op.add_column(
            "users",
            sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.text("true")),
        )

    op.create_table(
        "client_hidden_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", "user_id", name="uq_client_hidden_member"),
    )
    op.create_index("ix_client_hidden_members_client_id", "client_hidden_members", ["client_id"])
    op.create_index("ix_client_hidden_members_user_id", "client_hidden_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_client_hidden_members_user_id", table_name="client_hidden_members")
    op.drop_index("ix_client_hidden_members_client_id", table_name="client_hidden_members")
    op.drop_table("client_hidden_members")
    for col in PERM_COLS:
        op.drop_column("users", col)
