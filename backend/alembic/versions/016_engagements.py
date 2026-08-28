"""engagements table and jobs.engagement_id with legacy backfill

Revision ID: 016_engagements
Revises: 015_candidate_import_fields
Create Date: 2026-08-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "016_engagements"
down_revision: Union[str, None] = "015_candidate_import_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE engagement_status AS ENUM "
        "('prospect', 'active', 'paused', 'completed', 'cancelled'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE service_model AS ENUM "
        "('sourcing_only', 'sourcing_outreach', 'sourcing_outreach_qualification', "
        "'full_cycle', 'custom'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE billing_model AS ENUM "
        "('hourly', 'monthly_retainer', 'success_based', 'hybrid'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    engagement_status = postgresql.ENUM(
        "prospect", "active", "paused", "completed", "cancelled",
        name="engagement_status",
        create_type=False,
    )
    service_model = postgresql.ENUM(
        "sourcing_only",
        "sourcing_outreach",
        "sourcing_outreach_qualification",
        "full_cycle",
        "custom",
        name="service_model",
        create_type=False,
    )
    billing_model = postgresql.ENUM(
        "hourly",
        "monthly_retainer",
        "success_based",
        "hybrid",
        name="billing_model",
        create_type=False,
    )

    op.create_table(
        "engagements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_name", sa.String(length=255), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", engagement_status, nullable=False, server_default="active"),
        sa.Column("service_model", service_model, nullable=False, server_default="full_cycle"),
        sa.Column("billing_model", billing_model, nullable=False, server_default="success_based"),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="USD"),
        sa.Column("rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("billing_period", sa.String(length=50), nullable=True),
        sa.Column("monthly_fee", sa.Numeric(12, 2), nullable=True),
        sa.Column("included_hours", sa.Integer(), nullable=True),
        sa.Column("additional_hourly_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("placement_fee_percent", sa.Numeric(6, 2), nullable=True),
        sa.Column("flat_placement_fee", sa.Numeric(12, 2), nullable=True),
        sa.Column("guarantee_period_days", sa.Integer(), nullable=True),
        sa.Column("payment_terms", sa.String(length=255), nullable=True),
        sa.Column("contract_reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sla", sa.Text(), nullable=True),
        sa.Column("target_kpis", sa.Text(), nullable=True),
        sa.Column("custom_responsibilities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("assigned_recruiter_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["assigned_recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_engagements_client_id", "engagements", ["client_id"])
    op.create_index("ix_engagements_engagement_name", "engagements", ["engagement_name"])
    op.create_index("ix_engagements_status", "engagements", ["status"])
    op.create_index("ix_engagements_assigned_recruiter_id", "engagements", ["assigned_recruiter_id"])

    op.add_column("jobs", sa.Column("engagement_id", sa.Integer(), nullable=True))
    op.create_index("ix_jobs_engagement_id", "jobs", ["engagement_id"])
    op.create_foreign_key("fk_jobs_engagement_id", "jobs", "engagements", ["engagement_id"], ["id"])

    # Backfill: one Legacy engagement per client that has jobs
    op.execute(
        """
        INSERT INTO engagements (
            client_id, engagement_name, status, service_model, billing_model,
            currency, notes, custom_responsibilities, created_at, updated_at
        )
        SELECT
            c.id,
            'Legacy / Default Engagement',
            'active'::engagement_status,
            'full_cycle'::service_model,
            'success_based'::billing_model,
            'USD',
            'Auto-created during engagement architecture migration for existing jobs.',
            '[]'::jsonb,
            now(),
            now()
        FROM clients c
        WHERE EXISTS (SELECT 1 FROM jobs j WHERE j.client_id = c.id)
        """
    )
    op.execute(
        """
        UPDATE jobs j
        SET engagement_id = e.id
        FROM engagements e
        WHERE e.client_id = j.client_id
          AND e.engagement_name = 'Legacy / Default Engagement'
          AND j.engagement_id IS NULL
        """
    )

    # Safety: any remaining orphan jobs get a per-client legacy engagement
    op.execute(
        """
        INSERT INTO engagements (
            client_id, engagement_name, status, service_model, billing_model,
            currency, notes, custom_responsibilities, created_at, updated_at
        )
        SELECT DISTINCT
            j.client_id,
            'Legacy / Default Engagement',
            'active'::engagement_status,
            'full_cycle'::service_model,
            'success_based'::billing_model,
            'USD',
            'Auto-created for orphan jobs during migration.',
            '[]'::jsonb,
            now(),
            now()
        FROM jobs j
        WHERE j.engagement_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM engagements e
            WHERE e.client_id = j.client_id
              AND e.engagement_name = 'Legacy / Default Engagement'
          )
        """
    )
    op.execute(
        """
        UPDATE jobs j
        SET engagement_id = e.id
        FROM engagements e
        WHERE e.client_id = j.client_id
          AND e.engagement_name = 'Legacy / Default Engagement'
          AND j.engagement_id IS NULL
        """
    )

    op.alter_column("jobs", "engagement_id", nullable=False)


def downgrade() -> None:
    op.drop_constraint("fk_jobs_engagement_id", "jobs", type_="foreignkey")
    op.drop_index("ix_jobs_engagement_id", table_name="jobs")
    op.drop_column("jobs", "engagement_id")

    op.drop_index("ix_engagements_assigned_recruiter_id", table_name="engagements")
    op.drop_index("ix_engagements_status", table_name="engagements")
    op.drop_index("ix_engagements_engagement_name", table_name="engagements")
    op.drop_index("ix_engagements_client_id", table_name="engagements")
    op.drop_table("engagements")

    op.execute("DROP TYPE IF EXISTS billing_model")
    op.execute("DROP TYPE IF EXISTS service_model")
    op.execute("DROP TYPE IF EXISTS engagement_status")
