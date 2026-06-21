"""Add client visibility and custom tags

Revision ID: 005_client_visibility_tags
Revises: 004_client_premium
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "005_client_visibility_tags"
down_revision: Union[str, None] = "004_client_premium"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("visibility", sa.String(20), nullable=False, server_default="public"))
    op.add_column("clients", sa.Column("custom_tags", JSONB, nullable=True, server_default="[]"))


def downgrade() -> None:
    op.drop_column("clients", "custom_tags")
    op.drop_column("clients", "visibility")
