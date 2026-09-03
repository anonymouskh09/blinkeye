"""billing, offers, placements tables

Revision ID: 018_billing_offers_placements
Revises: 017_submissions_feedback
Create Date: 2026-09-03
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "018_billing_offers_placements"
down_revision: Union[str, None] = "017_submissions_feedback"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend existing billing_model enum with 'fixed'
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS ("
        "  SELECT 1 FROM pg_enum e "
        "  JOIN pg_type t ON e.enumtypid = t.oid "
        "  WHERE t.typname = 'billing_model' AND e.enumlabel = 'fixed'"
        ") THEN "
        "  ALTER TYPE billing_model ADD VALUE 'fixed'; "
        "END IF; "
        "END $$;"
    )

    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE offer_status AS ENUM "
        "('draft', 'sent', 'accepted', 'rejected', 'withdrawn', 'expired'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE placement_status AS ENUM "
        "('active', 'completed', 'cancelled', 'guarantee_failed'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE billable_item_type AS ENUM "
        "('hourly', 'retainer', 'success_fee', 'fixed', 'other'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE billable_item_status AS ENUM "
        "('draft', 'approved', 'invoiced', 'void'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE invoice_status AS ENUM "
        "('draft', 'sent', 'partially_paid', 'paid', 'void', 'overdue'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE invoice_payment_status AS ENUM "
        "('pending', 'partial', 'paid', 'refunded'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE payment_method AS ENUM "
        "('bank_transfer', 'wire', 'check', 'cash', 'other'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE revenue_type AS ENUM "
        "('hourly', 'retainer', 'success_fee', 'fixed', 'hybrid', 'other'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    offer_status = postgresql.ENUM(
        "draft",
        "sent",
        "accepted",
        "rejected",
        "withdrawn",
        "expired",
        name="offer_status",
        create_type=False,
    )
    placement_status = postgresql.ENUM(
        "active",
        "completed",
        "cancelled",
        "guarantee_failed",
        name="placement_status",
        create_type=False,
    )
    billable_item_type = postgresql.ENUM(
        "hourly",
        "retainer",
        "success_fee",
        "fixed",
        "other",
        name="billable_item_type",
        create_type=False,
    )
    billable_item_status = postgresql.ENUM(
        "draft",
        "approved",
        "invoiced",
        "void",
        name="billable_item_status",
        create_type=False,
    )
    invoice_status = postgresql.ENUM(
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "void",
        "overdue",
        name="invoice_status",
        create_type=False,
    )
    invoice_payment_status = postgresql.ENUM(
        "pending",
        "partial",
        "paid",
        "refunded",
        name="invoice_payment_status",
        create_type=False,
    )
    payment_method = postgresql.ENUM(
        "bank_transfer",
        "wire",
        "check",
        "cash",
        "other",
        name="payment_method",
        create_type=False,
    )
    revenue_type = postgresql.ENUM(
        "hourly",
        "retainer",
        "success_fee",
        "fixed",
        "hybrid",
        "other",
        name="revenue_type",
        create_type=False,
    )

    op.create_table(
        "offers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=True),
        sa.Column("submission_id", sa.Integer(), nullable=True),
        sa.Column("candidate_job_assignment_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("bonus", sa.Numeric(14, 2), nullable=True),
        sa.Column("equity", sa.String(length=255), nullable=True),
        sa.Column("offer_date", sa.Date(), nullable=False),
        sa.Column("acceptance_date", sa.Date(), nullable=True),
        sa.Column("rejection_date", sa.Date(), nullable=True),
        sa.Column("status", offer_status, server_default="draft", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.ForeignKeyConstraint(["candidate_job_assignment_id"], ["candidate_job_assignments.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_offers_candidate_id", "offers", ["candidate_id"])
    op.create_index("ix_offers_job_id", "offers", ["job_id"])
    op.create_index("ix_offers_client_id", "offers", ["client_id"])
    op.create_index("ix_offers_engagement_id", "offers", ["engagement_id"])
    op.create_index("ix_offers_submission_id", "offers", ["submission_id"])
    op.create_index("ix_offers_candidate_job_assignment_id", "offers", ["candidate_job_assignment_id"])
    op.create_index("ix_offers_recruiter_id", "offers", ["recruiter_id"])
    op.create_index("ix_offers_status", "offers", ["status"])

    op.create_table(
        "placements",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("candidate_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=False),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("offer_id", sa.Integer(), nullable=True),
        sa.Column("submission_id", sa.Integer(), nullable=True),
        sa.Column("candidate_job_assignment_id", sa.Integer(), nullable=True),
        sa.Column("placement_date", sa.Date(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("salary", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("fee_percentage", sa.Numeric(6, 2), nullable=True),
        sa.Column("flat_fee", sa.Numeric(14, 2), nullable=True),
        sa.Column("placement_fee", sa.Numeric(14, 2), nullable=False),
        sa.Column("guarantee_period_days", sa.Integer(), nullable=True),
        sa.Column("guarantee_end_date", sa.Date(), nullable=True),
        sa.Column("payment_status", invoice_payment_status, server_default="pending", nullable=False),
        sa.Column("status", placement_status, server_default="active", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["offer_id"], ["offers.id"]),
        sa.ForeignKeyConstraint(["submission_id"], ["submissions.id"]),
        sa.ForeignKeyConstraint(["candidate_job_assignment_id"], ["candidate_job_assignments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("offer_id"),
    )
    op.create_index("ix_placements_candidate_id", "placements", ["candidate_id"])
    op.create_index("ix_placements_client_id", "placements", ["client_id"])
    op.create_index("ix_placements_engagement_id", "placements", ["engagement_id"])
    op.create_index("ix_placements_job_id", "placements", ["job_id"])
    op.create_index("ix_placements_recruiter_id", "placements", ["recruiter_id"])
    op.create_index("ix_placements_offer_id", "placements", ["offer_id"])
    op.create_index("ix_placements_submission_id", "placements", ["submission_id"])
    op.create_index("ix_placements_candidate_job_assignment_id", "placements", ["candidate_job_assignment_id"])
    op.create_index("ix_placements_payment_status", "placements", ["payment_status"])
    op.create_index("ix_placements_status", "placements", ["status"])

    op.create_table(
        "billable_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=True),
        sa.Column("placement_id", sa.Integer(), nullable=True),
        sa.Column("billable_type", billable_item_type, nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), server_default="1", nullable=False),
        sa.Column("unit_rate", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("billing_period_start", sa.Date(), nullable=True),
        sa.Column("billing_period_end", sa.Date(), nullable=True),
        sa.Column("source_type", sa.String(length=50), server_default="manual", nullable=False),
        sa.Column("status", billable_item_status, server_default="approved", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["placement_id"], ["placements.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billable_items_client_id", "billable_items", ["client_id"])
    op.create_index("ix_billable_items_engagement_id", "billable_items", ["engagement_id"])
    op.create_index("ix_billable_items_job_id", "billable_items", ["job_id"])
    op.create_index("ix_billable_items_recruiter_id", "billable_items", ["recruiter_id"])
    op.create_index("ix_billable_items_placement_id", "billable_items", ["placement_id"])
    op.create_index("ix_billable_items_billable_type", "billable_items", ["billable_type"])
    op.create_index("ix_billable_items_status", "billable_items", ["status"])

    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("invoice_number", sa.String(length=50), nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=True),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("subtotal", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("tax", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("total", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("amount_paid", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("amount_outstanding", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("status", invoice_status, server_default="draft", nullable=False),
        sa.Column("payment_status", invoice_payment_status, server_default="pending", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_number"),
    )
    op.create_index("ix_invoices_invoice_number", "invoices", ["invoice_number"])
    op.create_index("ix_invoices_client_id", "invoices", ["client_id"])
    op.create_index("ix_invoices_engagement_id", "invoices", ["engagement_id"])
    op.create_index("ix_invoices_status", "invoices", ["status"])
    op.create_index("ix_invoices_payment_status", "invoices", ["payment_status"])

    op.create_table(
        "invoice_line_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("billable_item_id", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), server_default="1", nullable=False),
        sa.Column("unit_rate", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("billable_type", billable_item_type, nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=True),
        sa.Column("placement_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["placement_id"], ["placements.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("billable_item_id"),
    )
    op.create_index("ix_invoice_line_items_invoice_id", "invoice_line_items", ["invoice_id"])
    op.create_index("ix_invoice_line_items_billable_item_id", "invoice_line_items", ["billable_item_id"])
    op.create_index("ix_invoice_line_items_job_id", "invoice_line_items", ["job_id"])
    op.create_index("ix_invoice_line_items_recruiter_id", "invoice_line_items", ["recruiter_id"])
    op.create_index("ix_invoice_line_items_placement_id", "invoice_line_items", ["placement_id"])

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("invoice_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("payment_method", payment_method, server_default="bank_transfer", nullable=False),
        sa.Column("reference", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["recorded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])

    op.create_table(
        "revenue_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=True),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=True),
        sa.Column("placement_id", sa.Integer(), nullable=True),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("invoice_line_item_id", sa.Integer(), nullable=True),
        sa.Column("billable_item_id", sa.Integer(), nullable=True),
        sa.Column("billing_model", sa.String(length=50), nullable=True),
        sa.Column("revenue_type", revenue_type, nullable=False),
        sa.Column("expected_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("invoiced_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("paid_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(length=10), server_default="USD", nullable=False),
        sa.Column("period_date", sa.Date(), nullable=False),
        sa.Column("recognized_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["placement_id"], ["placements.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["invoice_line_item_id"], ["invoice_line_items.id"]),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invoice_line_item_id", name="uq_revenue_invoice_line"),
    )
    op.create_index("ix_revenue_entries_client_id", "revenue_entries", ["client_id"])
    op.create_index("ix_revenue_entries_engagement_id", "revenue_entries", ["engagement_id"])
    op.create_index("ix_revenue_entries_job_id", "revenue_entries", ["job_id"])
    op.create_index("ix_revenue_entries_recruiter_id", "revenue_entries", ["recruiter_id"])
    op.create_index("ix_revenue_entries_placement_id", "revenue_entries", ["placement_id"])
    op.create_index("ix_revenue_entries_invoice_id", "revenue_entries", ["invoice_id"])
    op.create_index("ix_revenue_entries_invoice_line_item_id", "revenue_entries", ["invoice_line_item_id"])
    op.create_index("ix_revenue_entries_billable_item_id", "revenue_entries", ["billable_item_id"])
    op.create_index("ix_revenue_entries_revenue_type", "revenue_entries", ["revenue_type"])

    op.create_table(
        "timesheet_entries",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("client_id", sa.Integer(), nullable=False),
        sa.Column("engagement_id", sa.Integer(), nullable=False),
        sa.Column("job_id", sa.Integer(), nullable=True),
        sa.Column("recruiter_id", sa.Integer(), nullable=False),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("hours", sa.Numeric(8, 2), nullable=False),
        sa.Column("hourly_rate", sa.Numeric(12, 2), nullable=True),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=30), server_default="pending", nullable=False),
        sa.Column("billable_item_id", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"]),
        sa.ForeignKeyConstraint(["engagement_id"], ["engagements.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["billable_item_id"], ["billable_items.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timesheet_entries_client_id", "timesheet_entries", ["client_id"])
    op.create_index("ix_timesheet_entries_engagement_id", "timesheet_entries", ["engagement_id"])
    op.create_index("ix_timesheet_entries_job_id", "timesheet_entries", ["job_id"])
    op.create_index("ix_timesheet_entries_recruiter_id", "timesheet_entries", ["recruiter_id"])
    op.create_index("ix_timesheet_entries_work_date", "timesheet_entries", ["work_date"])
    op.create_index("ix_timesheet_entries_status", "timesheet_entries", ["status"])
    op.create_index("ix_timesheet_entries_billable_item_id", "timesheet_entries", ["billable_item_id"])


def downgrade() -> None:
    op.drop_index("ix_timesheet_entries_billable_item_id", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_status", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_work_date", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_recruiter_id", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_job_id", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_engagement_id", table_name="timesheet_entries")
    op.drop_index("ix_timesheet_entries_client_id", table_name="timesheet_entries")
    op.drop_table("timesheet_entries")

    op.drop_index("ix_revenue_entries_revenue_type", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_billable_item_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_invoice_line_item_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_invoice_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_placement_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_recruiter_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_job_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_engagement_id", table_name="revenue_entries")
    op.drop_index("ix_revenue_entries_client_id", table_name="revenue_entries")
    op.drop_table("revenue_entries")

    op.drop_index("ix_payments_invoice_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_invoice_line_items_placement_id", table_name="invoice_line_items")
    op.drop_index("ix_invoice_line_items_recruiter_id", table_name="invoice_line_items")
    op.drop_index("ix_invoice_line_items_job_id", table_name="invoice_line_items")
    op.drop_index("ix_invoice_line_items_billable_item_id", table_name="invoice_line_items")
    op.drop_index("ix_invoice_line_items_invoice_id", table_name="invoice_line_items")
    op.drop_table("invoice_line_items")

    op.drop_index("ix_invoices_payment_status", table_name="invoices")
    op.drop_index("ix_invoices_status", table_name="invoices")
    op.drop_index("ix_invoices_engagement_id", table_name="invoices")
    op.drop_index("ix_invoices_client_id", table_name="invoices")
    op.drop_index("ix_invoices_invoice_number", table_name="invoices")
    op.drop_table("invoices")

    op.drop_index("ix_billable_items_status", table_name="billable_items")
    op.drop_index("ix_billable_items_billable_type", table_name="billable_items")
    op.drop_index("ix_billable_items_placement_id", table_name="billable_items")
    op.drop_index("ix_billable_items_recruiter_id", table_name="billable_items")
    op.drop_index("ix_billable_items_job_id", table_name="billable_items")
    op.drop_index("ix_billable_items_engagement_id", table_name="billable_items")
    op.drop_index("ix_billable_items_client_id", table_name="billable_items")
    op.drop_table("billable_items")

    op.drop_index("ix_placements_status", table_name="placements")
    op.drop_index("ix_placements_payment_status", table_name="placements")
    op.drop_index("ix_placements_candidate_job_assignment_id", table_name="placements")
    op.drop_index("ix_placements_submission_id", table_name="placements")
    op.drop_index("ix_placements_offer_id", table_name="placements")
    op.drop_index("ix_placements_recruiter_id", table_name="placements")
    op.drop_index("ix_placements_job_id", table_name="placements")
    op.drop_index("ix_placements_engagement_id", table_name="placements")
    op.drop_index("ix_placements_client_id", table_name="placements")
    op.drop_index("ix_placements_candidate_id", table_name="placements")
    op.drop_table("placements")

    op.drop_index("ix_offers_status", table_name="offers")
    op.drop_index("ix_offers_recruiter_id", table_name="offers")
    op.drop_index("ix_offers_candidate_job_assignment_id", table_name="offers")
    op.drop_index("ix_offers_submission_id", table_name="offers")
    op.drop_index("ix_offers_engagement_id", table_name="offers")
    op.drop_index("ix_offers_client_id", table_name="offers")
    op.drop_index("ix_offers_job_id", table_name="offers")
    op.drop_index("ix_offers_candidate_id", table_name="offers")
    op.drop_table("offers")

    op.execute("DROP TYPE IF EXISTS revenue_type")
    op.execute("DROP TYPE IF EXISTS payment_method")
    op.execute("DROP TYPE IF EXISTS invoice_payment_status")
    op.execute("DROP TYPE IF EXISTS invoice_status")
    op.execute("DROP TYPE IF EXISTS billable_item_status")
    op.execute("DROP TYPE IF EXISTS billable_item_type")
    op.execute("DROP TYPE IF EXISTS placement_status")
    op.execute("DROP TYPE IF EXISTS offer_status")
