"""add manager user role

Revision ID: 012_add_manager_role
Revises: 011_candidate_profile_fields
Create Date: 2026-06-22
"""
from typing import Sequence, Union

from alembic import op

revision: str = "012_add_manager_role"
down_revision: Union[str, None] = "011_candidate_profile_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager'")


def downgrade() -> None:
    pass
