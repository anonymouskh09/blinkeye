"""candidate import fields, linkedin unique index, candidate_imported action

Revision ID: 015_candidate_import_fields
Revises: 014_extension_auth
Create Date: 2026-07-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "015_candidate_import_fields"
down_revision: Union[str, None] = "014_extension_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("headline", sa.String(length=500), nullable=True))
    op.add_column("candidates", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("candidates", sa.Column("profile_image_url", sa.String(length=1000), nullable=True))
    op.add_column("candidates", sa.Column("source", sa.String(length=50), nullable=True))
    op.add_column("candidates", sa.Column("imported_via", sa.String(length=50), nullable=True))
    op.create_index("ix_candidates_source", "candidates", ["source"])

    # Existing DBs may already contain duplicate LinkedIn URLs. Keep the oldest
    # row (lowest id) and clear linkedin_url on the rest so the unique index
    # can be created.
    op.execute(
        """
        UPDATE candidates
        SET linkedin_url = NULL
        WHERE id IN (
            SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                           PARTITION BY linkedin_url ORDER BY id
                       ) AS rn
                FROM candidates
                WHERE linkedin_url IS NOT NULL
            ) ranked
            WHERE rn > 1
        )
        """
    )

    # Partial unique index: a LinkedIn URL may appear at most once, but many
    # candidates can have NULL (no LinkedIn URL).
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_candidates_linkedin_url "
        "ON candidates (linkedin_url) WHERE linkedin_url IS NOT NULL"
    )

    # Add the new activity action enum value (idempotent).
    op.execute("ALTER TYPE activity_action ADD VALUE IF NOT EXISTS 'candidate_imported'")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_candidates_linkedin_url")
    op.drop_index("ix_candidates_source", table_name="candidates")
    op.drop_column("candidates", "imported_via")
    op.drop_column("candidates", "source")
    op.drop_column("candidates", "profile_image_url")
    op.drop_column("candidates", "summary")
    op.drop_column("candidates", "headline")
    # Enum values cannot be dropped in PostgreSQL without recreating the type.
