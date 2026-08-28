from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import ClientFeedbackType, SubmissionStatus


class Submission(Base, TimestampMixin):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_job_assignment_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_job_assignments.id"), nullable=False, index=True
    )
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_id: Mapped[int | None] = mapped_column(ForeignKey("engagements.id"), nullable=True, index=True)
    recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    submission_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    resume_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    candidate_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    expected_compensation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    availability: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recruiter_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SubmissionStatus] = mapped_column(
        pg_enum(SubmissionStatus, name="submission_status"),
        nullable=False,
        default=SubmissionStatus.SUBMITTED,
        index=True,
    )

    assignment = relationship("CandidateJobAssignment", back_populates="submissions")
    candidate = relationship("Candidate")
    job = relationship("Job")
    client = relationship("Client")
    engagement = relationship("Engagement")
    recruiter = relationship("User", foreign_keys=[recruiter_id])
    feedback_entries = relationship(
        "ClientFeedback",
        back_populates="submission",
        cascade="all, delete-orphan",
    )


class ClientFeedback(Base, TimestampMixin):
    __tablename__ = "client_feedback"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("submissions.id"), nullable=False, index=True)
    feedback_type: Mapped[ClientFeedbackType] = mapped_column(
        pg_enum(ClientFeedbackType, name="client_feedback_type"),
        nullable=False,
        index=True,
    )
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    feedback_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    submission = relationship("Submission", back_populates="feedback_entries")
    created_by_user = relationship("User", foreign_keys=[created_by])
