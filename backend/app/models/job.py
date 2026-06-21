from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import JobStatus, JobType


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_type: Mapped[JobType] = mapped_column(
        pg_enum(JobType, name="job_type"), nullable=False, default=JobType.FULL_TIME
    )
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    required_skills: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_required: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    number_of_positions: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[JobStatus] = mapped_column(
        pg_enum(JobStatus, name="job_status"), nullable=False, default=JobStatus.ACTIVE, index=True
    )
    assigned_recruiter_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    client = relationship("Client", back_populates="jobs")
    assigned_recruiter = relationship("User", back_populates="assigned_jobs", foreign_keys=[assigned_recruiter_id])
    candidate_assignments = relationship("CandidateJobAssignment", back_populates="job")
    activities = relationship("JobActivity", back_populates="job", cascade="all, delete-orphan")
