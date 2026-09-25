"""Read side of the Matches feature: filtered, permission-scoped queries over
the `match_scores` cache. No scoring happens here."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, exists, func, or_
from sqlalchemy.orm import Query, Session, aliased

from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import JobStatus
from app.models.job import Job
from app.models.match import MatchDismissal, MatchScore
from app.models.user import User
from app.services.match_cache_service import STORE_FLOOR
from app.services.permission_service import (
    apply_hidden_candidates_filter,
    apply_jobs_visibility_filter,
    is_admin,
)

VERDICTS = ("strong_fit", "good_fit", "partial_fit", "weak_fit")
NEW_WINDOW = timedelta(hours=24)

Recruiter = aliased(User, name="recruiter")
Dismisser = aliased(User, name="dismisser")


@dataclass
class MatchFilters:
    job_id: int | None = None
    client_id: int | None = None
    candidate_id: int | None = None
    recruiter_id: int | None = None
    verdicts: list[str] = field(default_factory=list)
    min_score: int = 30
    max_score: int = 100
    search: str | None = None
    location: str | None = None
    job_type: str | None = None
    must_have_only: bool = False
    new_only: bool = False
    status: str = "active"  # active | dismissed


SORTS = {
    "score": MatchScore.overall_score,
    "newest": MatchScore.first_matched_at,
    "candidate": Candidate.name,
    "job": Job.title,
}


def base_query(db: Session, user: User, f: MatchFilters) -> Query:
    """Matches the user may see, with every filter applied. Selects the score,
    job, candidate, client, recruiter and (if any) the active dismissal."""
    active_dismissal = and_(
        MatchDismissal.job_id == MatchScore.job_id,
        MatchDismissal.candidate_id == MatchScore.candidate_id,
        MatchDismissal.undone_at.is_(None),
    )
    q = (
        db.query(MatchScore, Job, Candidate, Client, Recruiter.name, MatchDismissal, Dismisser.name)
        .join(Job, Job.id == MatchScore.job_id)
        .join(Candidate, Candidate.id == MatchScore.candidate_id)
        .join(Client, Client.id == Job.client_id)
        .outerjoin(Recruiter, Recruiter.id == Job.assigned_recruiter_id)
        .outerjoin(MatchDismissal, active_dismissal)
        .outerjoin(Dismisser, Dismisser.id == MatchDismissal.dismissed_by)
        .filter(Job.status == JobStatus.ACTIVE, Candidate.is_archived.is_(False))
        # Already in this job's pipeline (any stage) means it is no longer a lead.
        .filter(
            ~exists().where(
                CandidateJobAssignment.job_id == MatchScore.job_id,
                CandidateJobAssignment.candidate_id == MatchScore.candidate_id,
            )
        )
    )
    q = apply_jobs_visibility_filter(q, db, user)
    if not is_admin(user):
        q = apply_hidden_candidates_filter(q, db, user)

    q = q.filter(MatchDismissal.id.isnot(None) if f.status == "dismissed" else MatchDismissal.id.is_(None))

    if f.job_id:
        q = q.filter(MatchScore.job_id == f.job_id)
    if f.client_id:
        q = q.filter(Job.client_id == f.client_id)
    if f.candidate_id:
        q = q.filter(MatchScore.candidate_id == f.candidate_id)
    if f.recruiter_id and is_admin(user):
        q = q.filter(Job.assigned_recruiter_id == f.recruiter_id)
    verdicts = [v for v in f.verdicts if v in VERDICTS]
    if verdicts:
        q = q.filter(MatchScore.verdict.in_(verdicts))
    q = q.filter(MatchScore.overall_score >= max(f.min_score, STORE_FLOOR))
    if f.max_score < 100:
        q = q.filter(MatchScore.overall_score <= f.max_score)
    if f.search:
        term = f"%{f.search.strip()}%"
        q = q.filter(
            or_(
                Candidate.name.ilike(term),
                Candidate.current_job_title.ilike(term),
                Job.title.ilike(term),
                Client.company_name.ilike(term),
            )
        )
    if f.location:
        q = q.filter(or_(Candidate.location.ilike(f"%{f.location}%"), Job.location.ilike(f"%{f.location}%")))
    if f.job_type:
        q = q.filter(Job.job_type == f.job_type)
    if f.must_have_only:
        q = q.filter(MatchScore.must_have_total > 0, MatchScore.must_have_matched == MatchScore.must_have_total)
    if f.new_only:
        q = q.filter(MatchScore.first_matched_at >= datetime.now(timezone.utc) - NEW_WINDOW)
    return q


def apply_sort(q: Query, sort: str, order: str) -> Query:
    col = SORTS.get(sort, MatchScore.overall_score)
    primary = col.asc() if order == "asc" else col.desc()
    # Stable secondary keys so pagination never repeats or skips rows.
    return q.order_by(primary, MatchScore.overall_score.desc(), MatchScore.id.asc())


def serialize(row) -> dict:
    score, job, cand, client, recruiter_name, dismissal, dismisser_name = row
    now = datetime.now(timezone.utc)
    return {
        "id": score.id,
        "candidate_id": cand.id,
        "candidate_name": cand.name,
        "candidate_title": cand.current_job_title,
        "candidate_company": cand.current_company,
        "candidate_location": cand.location,
        "candidate_experience_years": cand.experience_years,
        "candidate_email": cand.email,
        "candidate_skills": cand.skills or [],
        "job_id": job.id,
        "job_title": job.title,
        "job_location": job.location,
        "job_type": job.job_type.value if hasattr(job.job_type, "value") else job.job_type,
        "client_id": client.id,
        "client_name": client.company_name,
        "recruiter_name": recruiter_name,
        "match_score": score.overall_score,
        "verdict": score.verdict,
        "matched_skills": score.matched_skills or [],
        "missing_skills": score.missing_skills or [],
        "must_have_total": score.must_have_total,
        "must_have_matched": score.must_have_matched,
        "dimensions": score.dimensions or [],
        "flags": score.flags or [],
        "first_matched_at": score.first_matched_at.isoformat() if score.first_matched_at else None,
        "computed_at": score.computed_at.isoformat() if score.computed_at else None,
        "is_new": bool(score.first_matched_at and now - score.first_matched_at <= NEW_WINDOW),
        "dismissal": (
            {
                "id": dismissal.id,
                "reason": dismissal.reason,
                "note": dismissal.note,
                "dismissed_by_name": dismisser_name,
                "dismissed_at": dismissal.dismissed_at.isoformat() if dismissal.dismissed_at else None,
            }
            if dismissal
            else None
        ),
    }


def summary(db: Session, user: User, f: MatchFilters) -> dict:
    sub = base_query(db, user, f).with_entities(
        MatchScore.overall_score.label("score"),
        MatchScore.verdict.label("verdict"),
        MatchScore.job_id.label("job_id"),
        MatchScore.candidate_id.label("candidate_id"),
    ).subquery()
    row = db.query(
        func.count(),
        func.count(case((sub.c.verdict == "strong_fit", 1))),
        func.count(case((sub.c.verdict == "good_fit", 1))),
        func.count(case((sub.c.verdict == "partial_fit", 1))),
        func.count(func.distinct(sub.c.job_id)),
        func.count(func.distinct(sub.c.candidate_id)),
        func.avg(sub.c.score),
    ).select_from(sub).one()
    total, strong, good, partial, jobs, candidates, avg = row
    return {
        "total": total,
        "strong_fit": strong,
        "good_fit": good,
        "partial_fit": partial,
        "jobs_with_matches": jobs,
        "candidates_matched": candidates,
        "avg_score": round(float(avg)) if avg is not None else 0,
    }


def by_job(db: Session, user: User, f: MatchFilters, page: int, page_size: int, per_job: int) -> dict:
    base = base_query(db, user, f)
    groups = (
        base.with_entities(
            MatchScore.job_id.label("job_id"),
            func.count().label("match_count"),
            func.count(case((MatchScore.verdict == "strong_fit", 1))).label("strong_count"),
            func.count(case((MatchScore.first_matched_at >= datetime.now(timezone.utc) - NEW_WINDOW, 1))).label(
                "new_count"
            ),
            func.max(MatchScore.overall_score).label("top_score"),
            func.avg(MatchScore.overall_score).label("avg_score"),
        )
        .order_by(None)
        .group_by(MatchScore.job_id)
        .subquery()
    )
    total = db.query(func.count()).select_from(groups).scalar() or 0
    job_rows = (
        db.query(groups, Job, Client, Recruiter.name.label("recruiter_name"))
        .join(Job, Job.id == groups.c.job_id)
        .join(Client, Client.id == Job.client_id)
        .outerjoin(Recruiter, Recruiter.id == Job.assigned_recruiter_id)
        .order_by(groups.c.strong_count.desc(), groups.c.top_score.desc(), groups.c.job_id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    job_ids = [r.job_id for r in job_rows]

    top: dict[int, list[dict]] = {jid: [] for jid in job_ids}
    if job_ids:
        rank = (
            func.row_number()
            .over(
                partition_by=MatchScore.job_id,
                order_by=(MatchScore.overall_score.desc(), MatchScore.id.asc()),
            )
            .label("rank")
        )
        ranked = (
            base.filter(MatchScore.job_id.in_(job_ids))
            .with_entities(MatchScore.id.label("score_id"), rank)
            .order_by(None)
            .subquery()
        )
        keep_ids = [
            r.score_id for r in db.query(ranked.c.score_id).filter(ranked.c.rank <= per_job).all()
        ]
        rows = apply_sort(base.filter(MatchScore.id.in_(keep_ids)), "score", "desc").all()
        for r in rows:
            top[r[0].job_id].append(serialize(r))

    jobs = []
    for r in job_rows:
        job, client = r.Job, r.Client
        jobs.append({
            "job_id": job.id,
            "job_title": job.title,
            "job_location": job.location,
            "client_id": client.id,
            "client_name": client.company_name,
            "recruiter_name": r.recruiter_name,
            "number_of_positions": job.number_of_positions,
            "match_count": r.match_count,
            "strong_count": r.strong_count,
            "new_count": r.new_count,
            "top_score": r.top_score,
            "avg_score": round(float(r.avg_score)) if r.avg_score is not None else 0,
            "items": top.get(job.id, []),
        })
    return {"items": jobs, "total": total, "page": page, "page_size": page_size,
            "total_pages": max(1, (total + page_size - 1) // page_size)}
