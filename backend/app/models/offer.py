from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import OfferStatus


class Offer(Base, TimestampMixin):
    __tablename__ = "offers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int | None] = mapped_column(ForeignKey("engagements.id"), nullable=True, index=True)
    submission_id: Mapped[int | None] = mapped_column(ForeignKey("submissions.id"), nullable=True, index=True)
    candidate_job_assignment_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate_job_assignments.id"), nullable=True, index=True
    )
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    salary: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bonus: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    equity: Mapped[str | None] = mapped_column(String(255), nullable=True)
    offer_date: Mapped[date] = mapped_column(Date, nullable=False)
    acceptance_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rejection_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[OfferStatus] = mapped_column(
        pg_enum(OfferStatus, name="offer_status"),
        nullable=False,
        default=OfferStatus.DRAFT,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate = relationship("Candidate")
    job = relationship("Job")
    client = relationship("Client")
    engagement = relationship("Engagement")
    submission = relationship("Submission")
    assignment = relationship("CandidateJobAssignment")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    placement = relationship("Placement", back_populates="offer", uselist=False)
