"""Read side of the Matches feature: filtered, permission-scoped queries over
the `match_scores` cache. No scoring happens here."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, case, exists, func, or_, select
from sqlalchemy.orm import Query, Session, aliased

from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import JobStatus
from app.models.job import Job
from app.models.match import MatchDismissal, MatchScore
from app.models.user import User
from app.services.match_cache_service import STORE_FLOOR
from app.services.matching_service import result_to_dict, score_pair
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
    candidate_location: str | None = None
    job_location: str | None = None
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
        # Resolve the (small) sets of matching candidates and jobs first rather
        # than running ILIKE against every joined match row.
        term = f"%{f.search.strip()}%"
        cand_ids = select(Candidate.id).where(
            or_(Candidate.name.ilike(term), Candidate.current_job_title.ilike(term))
        )
        job_ids = (
            select(Job.id)
            .join(Client, Client.id == Job.client_id)
            .where(or_(Job.title.ilike(term), Client.company_name.ilike(term)))
        )
        q = q.filter(or_(MatchScore.candidate_id.in_(cand_ids), MatchScore.job_id.in_(job_ids)))
    if f.candidate_location:
        q = q.filter(Candidate.location.ilike(f"%{f.candidate_location}%"))
    if f.job_location:
        q = q.filter(Job.location.ilike(f"%{f.job_location}%"))
    if f.job_type:
        q = q.filter(Job.job_type == f.job_type)
    if f.must_have_only:
        q = q.filter(MatchScore.must_have_total > 0, MatchScore.must_have_matched == MatchScore.must_have_total)
    if f.new_only:
        q = q.filter(MatchScore.first_matched_at >= datetime.now(timezone.utc) - NEW_WINDOW)
    return q


def fetch_page(q: Query, sort: str, order: str, offset: int, limit: int) -> tuple[int, list]:
    """Count and page on narrow columns, then load full rows for the page only.
    Sorting wide candidate rows (resume text, JSON) across every match was the
    dominant cost before this split."""
    total = q.with_entities(func.count(MatchScore.id)).order_by(None).scalar() or 0
    ids = [r[0] for r in apply_sort(q.with_entities(MatchScore.id), sort, order).offset(offset).limit(limit).all()]
    if not ids:
        return total, []
    by_id = {r[0].id: r for r in q.filter(MatchScore.id.in_(ids)).order_by(None).all()}
    return total, [by_id[i] for i in ids if i in by_id]


def apply_sort(q: Query, sort: str, order: str) -> Query:
    col = SORTS.get(sort, MatchScore.overall_score)
    primary = (col.asc() if order == "asc" else col.desc()).nullslast()
    # Stable secondary keys so pagination never repeats or skips rows.
    return q.order_by(primary, MatchScore.overall_score.desc(), MatchScore.id.asc())


def serialize(row) -> dict:
    """One match for the API. The cached row decides filtering and order; the
    breakdown is rescored here from the live job and candidate, which is cheap
    for a page of rows and always reflects the latest edits."""
    score, job, cand, client, recruiter_name, dismissal, dismisser_name = row
    now = datetime.now(timezone.utc)
    fresh = result_to_dict(score_pair(job, cand))
    must = next((d for d in fresh["dimensions"] if d["key"] == "must_have_skills"), None)
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
        "match_score": fresh["overall_score"],
        "verdict": fresh["verdict"],
        "matched_skills": fresh["matched_skills"],
        "missing_skills": fresh["missing_skills"],
        "must_have_total": len(must["matched"]) + len(must["missing"]) if must else 0,
        "must_have_matched": len(must["matched"]) if must else 0,
        "dimensions": fresh["dimensions"],
        "flags": fresh["flags"],
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


def filter_options(db: Session, user: User) -> dict:
    """Jobs, clients and recruiters that currently have visible matches, from a
    single aggregate over the cache plus a lookup of at most a few hundred jobs."""
    counts = dict(
        base_query(db, user, MatchFilters(min_score=STORE_FLOOR))
        .with_entities(MatchScore.job_id, func.count(MatchScore.id))
        .order_by(None)
        .group_by(MatchScore.job_id)
        .all()
    )
    if not counts:
        return {"jobs": [], "clients": [], "recruiters": []}
    rows = (
        db.query(Job.id, Job.title, Job.client_id, Client.company_name, Recruiter.id, Recruiter.name)
        .join(Client, Client.id == Job.client_id)
        .outerjoin(Recruiter, Recruiter.id == Job.assigned_recruiter_id)
        .filter(Job.id.in_(list(counts)))
        .order_by(Job.title, Job.id)
        .all()
    )
    clients = {r[2]: r[3] for r in rows}
    recruiters = {r[4]: r[5] for r in rows if r[4] is not None}
    return {
        "jobs": [{"id": r[0], "title": r[1], "client_id": r[2], "match_count": counts[r[0]]} for r in rows],
        "clients": [{"id": k, "name": v} for k, v in sorted(clients.items(), key=lambda kv: kv[1].lower())],
        "recruiters": [{"id": k, "name": v} for k, v in sorted(recruiters.items(), key=lambda kv: kv[1].lower())],
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
    # One aggregate pass; there is at most one group per active job, so the
    # grouped rows are paged in Python instead of re-aggregating to count them.
    all_groups = (
        db.query(groups, Job, Client, Recruiter.name.label("recruiter_name"))
        .join(Job, Job.id == groups.c.job_id)
        .join(Client, Client.id == Job.client_id)
        .outerjoin(Recruiter, Recruiter.id == Job.assigned_recruiter_id)
        .order_by(groups.c.strong_count.desc(), groups.c.top_score.desc(), groups.c.job_id.asc())
        .all()
    )
    total = len(all_groups)
    job_rows = all_groups[(page - 1) * page_size : page * page_size]
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
        if keep_ids:
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


# -- Job detail "Matches" tab and candidate detail "Jobs" tab ---------------

def _calibration(m: dict) -> dict:
    return {k: m[k] for k in ("matched_skills", "missing_skills", "flags", "dimensions")} | {
        "overall_score": m["match_score"],
        "verdict": m["verdict"],
    }


def candidates_for_job(
    db: Session, user: User, job: Job, *, min_score: int, limit: int, location: str | None = None
) -> dict:
    q = base_query(db, user, MatchFilters(job_id=job.id, min_score=min_score, candidate_location=location))
    total, rows = fetch_page(q, "score", "desc", 0, limit)
    items = []
    for r in rows:
        m, cand = serialize(r), r[2]
        items.append({
            "candidate_id": m["candidate_id"],
            "candidate_name": m["candidate_name"],
            "candidate_title": m["candidate_title"],
            "candidate_email": m["candidate_email"],
            "location": m["candidate_location"],
            "experience_years": m["candidate_experience_years"],
            "skills": cand.skills or [],
            "match_score": m["match_score"],
            "verdict": m["verdict"],
            "matched_skills": m["matched_skills"],
            "missing_skills": m["missing_skills"],
            "flags": m["flags"],
            "calibration": _calibration(m),
        })
    scanned = db.query(func.count(Candidate.id)).filter(Candidate.is_archived.is_(False)).scalar() or 0
    return {
        "job_id": job.id,
        "job_title": job.title,
        "screening_questions": job.screening_questions or [],
        "scanned": scanned,
        "matched": total,
        "items": items,
    }


def jobs_for_candidate(
    db: Session,
    user: User,
    candidate: Candidate,
    *,
    min_score: int,
    limit: int,
    location: str | None = None,
    job_type: str | None = None,
    client_id: int | None = None,
) -> dict:
    f = MatchFilters(
        candidate_id=candidate.id, min_score=min_score, job_location=location, job_type=job_type, client_id=client_id,
    )
    total, rows = fetch_page(base_query(db, user, f), "score", "desc", 0, limit)
    items = []
    for r in rows:
        m, job = serialize(r), r[1]
        items.append({
            "job_id": job.id,
            "job_title": job.title,
            "client_id": m["client_id"],
            "client_name": m["client_name"],
            "location": job.location,
            "job_type": m["job_type"],
            "min_experience_years": job.min_experience_years,
            "max_experience_years": job.max_experience_years,
            "salary_min": job.salary_min,
            "salary_max": job.salary_max,
            "screening_questions": job.screening_questions or [],
            "match_score": m["match_score"],
            "verdict": m["verdict"],
            "matched_skills": m["matched_skills"],
            "missing_skills": m["missing_skills"],
            "flags": m["flags"],
            "calibration": _calibration(m),
        })
    scanned = apply_jobs_visibility_filter(
        db.query(func.count(Job.id)).filter(Job.status == JobStatus.ACTIVE), db, user
    ).scalar() or 0
    return {"candidate_id": candidate.id, "scanned": scanned, "matched": total, "items": items}
