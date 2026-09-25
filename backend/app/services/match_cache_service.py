"""Keeps `match_scores` in sync with jobs and candidates.

Scoring itself lives in `matching_service.score_pair`; this module decides
*which* pairs to score and persists the results:

- `refresh_for_job` / `refresh_for_candidate` rescore one side of the matrix
  after that record changes.
- `rebuild_all` rescores everything (nightly, on version bump, or on demand).

Only active jobs that carry a skill signal are scored, and only pairs at or
above `STORE_FLOOR` are stored, so the table stays small even with thousands
of candidates.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Iterable

from sqlalchemy import delete, func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.enums import JobStatus
from app.models.job import Job
from app.models.match import MatchScore
from app.services.matching_service import MatchResult, score_pair, skill_set

logger = logging.getLogger(__name__)

# Bump when score_pair's formula changes so stored rows get rebuilt on startup.
SCORE_VERSION = 1
# Pairs below this score are not stored; the UI slider starts here.
STORE_FLOOR = 20
_INSERT_CHUNK = 5000
_REBUILD_LOCK_KEY = 820_240_925  # arbitrary, unique to this job

# Only the columns score_pair reads, so bulk scoring skips heavy text/JSON.
_CANDIDATE_COLUMNS = (
    Candidate.id,
    Candidate.skills,
    Candidate.experience_years,
    Candidate.current_job_title,
    Candidate.headline,
    Candidate.experiences,
    Candidate.location,
    Candidate.salary_min,
    Candidate.salary_max,
    Candidate.expected_salary,
)


def job_must_have(job) -> set[str]:
    return skill_set(job.must_have_skills) or skill_set(re.split(r"[,;|\n]+", job.required_skills or ""))


def job_is_scoreable(job: Job | None) -> bool:
    if job is None or job.status != JobStatus.ACTIVE:
        return False
    return bool(job_must_have(job) or skill_set(job.nice_to_have_skills))


def _row(
    job_id: int, candidate_id: int, result: MatchResult, computed_at: datetime, first_matched_at: datetime | None
) -> dict:
    must_dim = next((d for d in result.dimensions if d.key == "must_have_skills"), None)
    return {
        "job_id": job_id,
        "candidate_id": candidate_id,
        "overall_score": result.overall_score,
        "verdict": result.verdict,
        "must_have_total": len(must_dim.matched) + len(must_dim.missing) if must_dim else 0,
        "must_have_matched": len(must_dim.matched) if must_dim else 0,
        "score_version": SCORE_VERSION,
        "computed_at": computed_at,
        # Only used on insert; the upsert never overwrites it.
        "first_matched_at": first_matched_at,
    }


_UPSERT = pg_insert(MatchScore)
_UPSERT = _UPSERT.on_conflict_do_update(
    constraint="uq_match_score_pair",
    # first_matched_at is deliberately kept from the original insert.
    set_={
        col: getattr(_UPSERT.excluded, col)
        for col in (
            "overall_score", "verdict", "must_have_total", "must_have_matched", "score_version", "computed_at",
        )
    },
)


def _upsert(db: Session, rows: list[dict]) -> None:
    # executemany lets SQLAlchemy batch these into multi-row INSERTs.
    for i in range(0, len(rows), _INSERT_CHUNK):
        db.execute(_UPSERT, rows[i : i + _INSERT_CHUNK])


def _score_job(job: Job, candidates: Iterable, computed_at: datetime) -> list[dict]:
    rows = []
    for cand in candidates:
        result = score_pair(job, cand)
        if result.overall_score >= STORE_FLOOR:
            rows.append(_row(job.id, cand.id, result, computed_at, first_matched_at=computed_at))
    return rows


def _active_candidates(db: Session) -> list:
    return db.execute(select(*_CANDIDATE_COLUMNS).where(Candidate.is_archived.is_(False))).all()


def _scoreable_jobs(db: Session) -> list[Job]:
    jobs = db.query(Job).filter(Job.status == JobStatus.ACTIVE).all()
    return [j for j in jobs if job_is_scoreable(j)]


def refresh_for_job(db: Session, job_id: int) -> int:
    """Rescore one job against every active candidate. Returns rows stored."""
    job = db.get(Job, job_id)
    if not job_is_scoreable(job):
        db.execute(delete(MatchScore).where(MatchScore.job_id == job_id))
        db.commit()
        return 0

    computed_at = datetime.now(timezone.utc)
    rows = _score_job(job, _active_candidates(db), computed_at)
    _upsert(db, rows)
    db.execute(
        delete(MatchScore).where(MatchScore.job_id == job_id, MatchScore.computed_at != computed_at)
    )
    db.commit()
    return len(rows)


def refresh_for_candidate(db: Session, candidate_id: int) -> int:
    """Rescore one candidate against every scoreable job. Returns rows stored."""
    cand = db.execute(select(*_CANDIDATE_COLUMNS).where(Candidate.id == candidate_id)).first()
    archived = db.execute(select(Candidate.is_archived).where(Candidate.id == candidate_id)).scalar()
    if cand is None or archived:
        db.execute(delete(MatchScore).where(MatchScore.candidate_id == candidate_id))
        db.commit()
        return 0

    computed_at = datetime.now(timezone.utc)
    rows: list[dict] = []
    for job in _scoreable_jobs(db):
        rows.extend(_score_job(job, [cand], computed_at))
    _upsert(db, rows)
    db.execute(
        delete(MatchScore).where(
            MatchScore.candidate_id == candidate_id, MatchScore.computed_at != computed_at
        )
    )
    db.commit()
    return len(rows)


def rebuild_all(db: Session) -> int | None:
    """Rescore the full matrix. Returns rows stored, or None if another
    process already holds the rebuild lock."""
    is_pg = db.bind is not None and db.bind.dialect.name == "postgresql"
    if is_pg and not db.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": _REBUILD_LOCK_KEY}).scalar():
        logger.info("Match rebuild skipped: another process holds the lock")
        db.rollback()
        return None
    try:
        computed_at = datetime.now(timezone.utc)
        # On the very first build every pair would otherwise look "new"; leave
        # first_matched_at empty for those so the badge means something.
        initial = db.execute(select(MatchScore.id).limit(1)).first() is None
        candidates = _active_candidates(db)
        jobs = _scoreable_jobs(db)
        total = 0
        for job in jobs:
            rows = _score_job(job, candidates, computed_at)
            if initial:
                for r in rows:
                    r["first_matched_at"] = None
            _upsert(db, rows)
            total += len(rows)
            db.commit()
        # Anything not rewritten above belongs to a job or candidate that is no
        # longer scoreable, or fell below the floor.
        db.execute(delete(MatchScore).where(MatchScore.computed_at != computed_at))
        db.commit()
        if is_pg:
            # A rebuild rewrites every row; fresh statistics keep the planner on
            # hash joins instead of assuming the table is tiny.
            db.execute(text("ANALYZE match_scores"))
            db.commit()
        logger.info("Match rebuild stored %s rows for %s jobs", total, len(jobs))
        return total
    finally:
        if is_pg:
            db.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _REBUILD_LOCK_KEY})
            db.commit()


def cache_needs_rebuild(db: Session) -> bool:
    """True when stored rows are from an older formula, or when scoreable jobs
    exist but nothing has ever been stored (fresh deploy)."""
    outdated = db.execute(
        select(func.count()).select_from(MatchScore).where(MatchScore.score_version != SCORE_VERSION)
    ).scalar()
    if outdated:
        return True
    has_rows = db.execute(select(MatchScore.id).limit(1)).first() is not None
    if has_rows:
        return False
    return bool(_scoreable_jobs(db)) and bool(
        db.execute(select(Candidate.id).where(Candidate.is_archived.is_(False)).limit(1)).first()
    )


def last_computed_at(db: Session) -> datetime | None:
    return db.execute(select(func.max(MatchScore.computed_at))).scalar()
