"""extension auth codes and tokens

Revision ID: 014_extension_auth
Revises: 013_client_stage_on_hold
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_extension_auth"
down_revision: Union[str, None] = "013_client_stage_on_hold"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "extension_auth_codes",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_extension_auth_codes_code_hash", "extension_auth_codes", ["code_hash"], unique=True)
    op.create_index("ix_extension_auth_codes_user_id", "extension_auth_codes", ["user_id"])

    op.create_table(
        "extension_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_extension_tokens_token_hash", "extension_tokens", ["token_hash"], unique=True)
    op.create_index("ix_extension_tokens_user_id", "extension_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_extension_tokens_user_id", table_name="extension_tokens")
    op.drop_index("ix_extension_tokens_token_hash", table_name="extension_tokens")
    op.drop_table("extension_tokens")
    op.drop_index("ix_extension_auth_codes_user_id", table_name="extension_auth_codes")
    op.drop_index("ix_extension_auth_codes_code_hash", table_name="extension_auth_codes")
    op.drop_table("extension_auth_codes")
