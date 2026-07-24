"""add on_hold client stage

Revision ID: 013_client_stage_on_hold
Revises: 012_add_manager_role
Create Date: 2026-07-14
"""
from typing import Sequence, Union

from alembic import op

revision: str = "013_client_stage_on_hold"
down_revision: Union[str, None] = "012_add_manager_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE client_stage ADD VALUE IF NOT EXISTS 'on_hold'")


def downgrade() -> None:
    pass
