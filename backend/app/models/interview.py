from datetime import date, time

from sqlalchemy import Date, ForeignKey, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import InterviewStatus, InterviewType


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_job_id: Mapped[int] = mapped_column(
        ForeignKey("candidate_job_assignments.id"), nullable=False, index=True
    )
    interview_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    interview_time: Mapped[time] = mapped_column(Time, nullable=False)
    interview_type: Mapped[InterviewType] = mapped_column(
        pg_enum(InterviewType, name="interview_type"), nullable=False
    )
    interviewer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[InterviewStatus] = mapped_column(
        pg_enum(InterviewStatus, name="interview_status"),
        nullable=False,
        default=InterviewStatus.SCHEDULED,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    candidate_job = relationship("CandidateJobAssignment", back_populates="interviews")
    created_by_user = relationship("User", foreign_keys=[created_by])
