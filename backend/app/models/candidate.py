from sqlalchemy import ARRAY, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin
from app.models.enums import CandidateStatus


class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    current_job_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skills: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    expected_salary: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notice_period: Mapped[str | None] = mapped_column(String(100), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    headline: Mapped[str | None] = mapped_column(String(500), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    imported_via: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cv_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    profile_extras: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict)
    experiences: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    educations: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    skill_levels: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    candidate_status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=CandidateStatus.NEW.value,
        comment="Legacy global CRM status only — not job pipeline truth",
    )
    candidate_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("jobs.id"),
        nullable=True,
        index=True,
        comment="Optional primary-job pointer; pipeline truth is CandidateJobAssignment",
    )
    salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    salary_currency: Mapped[str | None] = mapped_column(String(10), nullable=True, default="USD")
    timezone: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_by_user = relationship("User", back_populates="created_candidates")
    assigned_job = relationship("Job", foreign_keys=[assigned_job_id])
    assignments = relationship("CandidateJobAssignment", back_populates="candidate")
    activities = relationship("CandidateActivity", back_populates="candidate", cascade="all, delete-orphan")
