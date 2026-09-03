from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import (
    BillableItemStatus,
    BillableItemType,
    InvoicePaymentStatus,
    InvoiceStatus,
    PaymentMethod,
    RevenueType,
)


class BillableItem(Base, TimestampMixin):
    """Calculated/approved charge before or after invoicing."""

    __tablename__ = "billable_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int] = mapped_column(ForeignKey("engagements.id"), nullable=False, index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    recruiter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    placement_id: Mapped[int | None] = mapped_column(ForeignKey("placements.id"), nullable=True, index=True)
    billable_type: Mapped[BillableItemType] = mapped_column(
        pg_enum(BillableItemType, name="billable_item_type"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("1"))
    unit_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    billing_period_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_period_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")
    status: Mapped[BillableItemStatus] = mapped_column(
        pg_enum(BillableItemStatus, name="billable_item_status"),
        nullable=False,
        default=BillableItemStatus.APPROVED,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    client = relationship("Client")
    engagement = relationship("Engagement")
    job = relationship("Job")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    placement = relationship("Placement", back_populates="billable_items")
    invoice_line_items = relationship("InvoiceLineItem", back_populates="billable_item")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int | None] = mapped_column(ForeignKey("engagements.id"), nullable=True, index=True)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    amount_outstanding: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    status: Mapped[InvoiceStatus] = mapped_column(
        pg_enum(InvoiceStatus, name="invoice_status"),
        nullable=False,
        default=InvoiceStatus.DRAFT,
        index=True,
    )
    payment_status: Mapped[InvoicePaymentStatus] = mapped_column(
        pg_enum(InvoicePaymentStatus, name="invoice_payment_status", create_type=False),
        nullable=False,
        default=InvoicePaymentStatus.PENDING,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    client = relationship("Client")
    engagement = relationship("Engagement")
    created_by_user = relationship("User", foreign_keys=[created_by])
    line_items = relationship(
        "InvoiceLineItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )
    payments = relationship(
        "Payment",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )


class InvoiceLineItem(Base, TimestampMixin):
    __tablename__ = "invoice_line_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    billable_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("billable_items.id"), nullable=True, unique=True, index=True
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("1"))
    unit_rate: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    billable_type: Mapped[BillableItemType] = mapped_column(
        pg_enum(BillableItemType, name="billable_item_type", create_type=False),
        nullable=False,
    )
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    recruiter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    placement_id: Mapped[int | None] = mapped_column(ForeignKey("placements.id"), nullable=True, index=True)

    invoice = relationship("Invoice", back_populates="line_items")
    billable_item = relationship("BillableItem", back_populates="invoice_line_items")
    job = relationship("Job")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    placement = relationship("Placement")
    revenue_entry = relationship("RevenueEntry", back_populates="invoice_line_item", uselist=False)


class Payment(Base, TimestampMixin):
    """External payment recorded by the agency (not a payment gateway)."""

    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        pg_enum(PaymentMethod, name="payment_method"),
        nullable=False,
        default=PaymentMethod.BANK_TRANSFER,
    )
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    invoice = relationship("Invoice", back_populates="payments")
    recorded_by_user = relationship("User", foreign_keys=[recorded_by])


class RevenueEntry(Base, TimestampMixin):
    """Attribution ledger — one row per invoice line (avoids double-counting fees)."""

    __tablename__ = "revenue_entries"
    __table_args__ = (UniqueConstraint("invoice_line_item_id", name="uq_revenue_invoice_line"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int | None] = mapped_column(ForeignKey("engagements.id"), nullable=True, index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    recruiter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    placement_id: Mapped[int | None] = mapped_column(ForeignKey("placements.id"), nullable=True, index=True)
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True, index=True)
    invoice_line_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("invoice_line_items.id"), nullable=True, unique=True, index=True
    )
    billable_item_id: Mapped[int | None] = mapped_column(ForeignKey("billable_items.id"), nullable=True, index=True)
    billing_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    revenue_type: Mapped[RevenueType] = mapped_column(
        pg_enum(RevenueType, name="revenue_type"),
        nullable=False,
        index=True,
    )
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    invoiced_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    period_date: Mapped[date] = mapped_column(Date, nullable=False)
    recognized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    client = relationship("Client")
    engagement = relationship("Engagement")
    job = relationship("Job")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    placement = relationship("Placement")
    invoice = relationship("Invoice")
    invoice_line_item = relationship("InvoiceLineItem", back_populates="revenue_entry")
    billable_item = relationship("BillableItem")


class TimesheetEntry(Base, TimestampMixin):
    """Foundation for hourly billing — hours approved here become BillableItems."""

    __tablename__ = "timesheet_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int] = mapped_column(ForeignKey("engagements.id"), nullable=False, index=True)
    job_id: Mapped[int | None] = mapped_column(ForeignKey("jobs.id"), nullable=True, index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    work_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
    billable_item_id: Mapped[int | None] = mapped_column(ForeignKey("billable_items.id"), nullable=True, index=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    client = relationship("Client")
    engagement = relationship("Engagement")
    job = relationship("Job")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    billable_item = relationship("BillableItem")
