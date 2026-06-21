from sqlalchemy import ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import PipelineStage


class CandidateJobAssignment(Base, TimestampMixin):
    __tablename__ = "candidate_job_assignments"
    __table_args__ = (UniqueConstraint("candidate_id", "job_id", name="uq_candidate_job"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"), nullable=False, index=True)
    status: Mapped[PipelineStage] = mapped_column(
        pg_enum(PipelineStage, name="pipeline_stage"),
        nullable=False,
        default=PipelineStage.APPLIED,
        index=True,
    )
    assigned_recruiter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate = relationship("Candidate", back_populates="assignments")
    job = relationship("Job", back_populates="candidate_assignments")
    assigned_recruiter = relationship("User", foreign_keys=[assigned_recruiter_id])
    interviews = relationship("Interview", back_populates="candidate_job")
