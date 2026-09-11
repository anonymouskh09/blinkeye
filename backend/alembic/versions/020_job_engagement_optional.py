"""Make jobs.engagement_id optional

Revision ID: 020_job_engagement_optional
Revises: 019_user_permissions_client_hide
Create Date: 2026-09-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_job_engagement_optional"
down_revision: Union[str, None] = "019_user_permissions_client_hide"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "jobs",
        "engagement_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM jobs
        WHERE engagement_id IS NULL
        """
    )
    op.alter_column(
        "jobs",
        "engagement_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
