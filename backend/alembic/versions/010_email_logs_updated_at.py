"""add updated_at to outreach_email_logs

Revision ID: 010_email_logs_updated_at
Revises: 009_outreach_gmail
Create Date: 2026-06-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_email_logs_updated_at"
down_revision: Union[str, None] = "009_outreach_gmail"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "outreach_email_logs",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("outreach_email_logs", "updated_at")
