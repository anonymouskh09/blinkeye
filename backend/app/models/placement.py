from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import InvoicePaymentStatus, PlacementStatus


class Placement(Base, TimestampMixin):
    __tablename__ = "placements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int] = mapped_column(ForeignKey("engagements.id"), nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    offer_id: Mapped[int | None] = mapped_column(ForeignKey("offers.id"), nullable=True, unique=True, index=True)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"), nullable=True, index=True)
    candidate_job_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate_job_assignments.id"), nullable=True, index=True
    )
    placement_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    fee_percentage: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    flat_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    placement_fee: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    guarantee_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    guarantee_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    payment_status: Mapped[InvoicePaymentStatus] = mapped_column(
        pg_enum(InvoicePaymentStatus, name="invoice_payment_status"),
        nullable=False,
        default=InvoicePaymentStatus.PENDING,
        index=True,
    )
    status: Mapped[PlacementStatus] = mapped_column(
        pg_enum(PlacementStatus, name="placement_status"),
        nullable=False,
        default=PlacementStatus.ACTIVE,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate = relationship("Candidate")
    client = relationship("Client")
    engagement = relationship("Engagement")
    job = relationship("Job")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    offer = relationship("Offer", back_populates="placement")
    submission = relationship("Submission")
    assignment = relationship("CandidateJobAssignment")
    billable_items = relationship("BillableItem", back_populates="placement")
