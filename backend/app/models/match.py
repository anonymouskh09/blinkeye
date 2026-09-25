"""Cached candidate↔job match scores and recruiter dismissals.

`match_scores` caches the outcome of `matching_service.score_pair` (score,
verdict, must-have coverage) for every pair, so filtering, sorting and paging
the Matches page never scores on read. Rows stay narrow on purpose: the
breakdown is recomputed only for the handful of rows on screen. Rows are
refreshed in the background when a job or candidate changes (see
`match_cache_service`) and rebuilt nightly.

`match_dismissals` is an audit trail: undoing a dismissal stamps `undone_*`
instead of deleting the row, so there is at most one *active* dismissal per
pair but the full history is kept.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MatchScore(Base):
    __tablename__ = "match_scores"
    __table_args__ = (
        UniqueConstraint("job_id", "candidate_id", name="uq_match_score_pair"),
        Index("ix_match_scores_job_score", "job_id", "overall_score"),
        Index("ix_match_scores_candidate_score", "candidate_id", "overall_score"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    overall_score: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    verdict: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    must_have_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    must_have_matched: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score_version: Mapped[int] = mapped_column(Integer, nullable=False)
    # First time this pair crossed the storage floor; drives the "New" badge.
    # NULL for pairs found by the very first backfill, which predate tracking.
    first_matched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    job = relationship("Job")
    candidate = relationship("Candidate")


class MatchDismissal(Base):
    __tablename__ = "match_dismissals"
    __table_args__ = (
        Index(
            "uq_match_dismissal_active",
            "job_id",
            "candidate_id",
            unique=True,
            postgresql_where=text("undone_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    dismissed_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    dismissed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    undone_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    undone_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    dismissed_by_user = relationship("User", foreign_keys=[dismissed_by])
    undone_by_user = relationship("User", foreign_keys=[undone_by])
