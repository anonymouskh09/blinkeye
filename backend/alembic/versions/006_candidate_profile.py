"""candidate extended profile

Revision ID: 006_candidate_profile
Revises: 005_client_visibility_tags
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "006_candidate_profile"
down_revision: Union[str, None] = "005_client_visibility_tags"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("profile_extras", JSONB, nullable=True, server_default="{}"))
    op.add_column("candidates", sa.Column("experiences", JSONB, nullable=True, server_default="[]"))
    op.add_column("candidates", sa.Column("educations", JSONB, nullable=True, server_default="[]"))
    op.add_column("candidates", sa.Column("skill_levels", JSONB, nullable=True, server_default="[]"))


def downgrade() -> None:
    op.drop_column("candidates", "skill_levels")
    op.drop_column("candidates", "educations")
    op.drop_column("candidates", "experiences")
    op.drop_column("candidates", "profile_extras")
