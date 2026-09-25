"""Matches page API: cached candidate↔job matches with filters, grouping,
bulk shortlist/dismiss/undo, CSV export and cache status."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import ForbiddenException
from app.core.response import paginate, success_response
from app.models.job import Job
from app.models.enums import JobStatus
from app.models.user import User
from app.services import match_action_service as actions
from app.services import match_cache_service as cache
from app.services import match_query_service as mq
from app.services.match_refresh_worker import worker
from app.services.permission_service import apply_jobs_visibility_filter, has_permission, is_admin

router = APIRouter(prefix="/matches", tags=["matches"])

EXPORT_LIMIT = 10_000


def require_match_access(current_user: User = Depends(get_current_user)) -> User:
    """Seeing a match reveals both the job and the candidate."""
    if not (has_permission(current_user, "can_view_jobs") and has_permission(current_user, "can_view_candidates")):
        raise ForbiddenException("You need permission to view jobs and candidates to see matches")
    return current_user


def match_filters(
    job_id: int | None = None,
    client_id: int | None = None,
    candidate_id: int | None = None,
    recruiter_id: int | None = None,
    verdict: list[str] = Query(default=[]),
    min_score: int = Query(30, ge=0, le=100),
    max_score: int = Query(100, ge=0, le=100),
    q: str | None = Query(None, max_length=100),
    must_have_only: bool = False,
    new_only: bool = False,
    status: Literal["active", "dismissed"] = "active",
) -> mq.MatchFilters:
    return mq.MatchFilters(
        job_id=job_id,
        client_id=client_id,
        candidate_id=candidate_id,
        recruiter_id=recruiter_id,
        verdicts=verdict,
        min_score=min_score,
        max_score=max_score,
        search=q or None,
        must_have_only=must_have_only,
        new_only=new_only,
        status=status,
    )


class Pair(BaseModel):
    job_id: int
    candidate_id: int


class ShortlistBody(BaseModel):
    pairs: list[Pair] = Field(min_length=1, max_length=200)


class DismissBody(BaseModel):
    pairs: list[Pair] = Field(min_length=1, max_length=200)
    reason: Literal[tuple(actions.DISMISS_REASONS)]  # type: ignore[valid-type]
    note: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _note_for_other(self):
        self.note = (self.note or "").strip() or None
        if self.reason == "other" and not self.note:
            raise ValueError("Please add a note when the reason is 'Other'")
        return self


class UndoBody(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=200)


@router.get("")
def list_matches(
    filters: mq.MatchFilters = Depends(match_filters),
    sort: Literal["score", "newest", "candidate", "job"] = "score",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    q = mq.base_query(db, current_user, filters)
    total = q.order_by(None).count()
    rows = mq.apply_sort(q, sort, order).offset((page - 1) * page_size).limit(page_size).all()
    meta = paginate(total, page, page_size)
    return success_response(
        data={"items": [mq.serialize(r) for r in rows], **meta.model_dump()},
        message="Matches retrieved",
    )


@router.get("/summary")
def matches_summary(
    filters: mq.MatchFilters = Depends(match_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    data = mq.summary(db, current_user, filters)
    data["shortlisted_this_week"] = actions.shortlisted_this_week(db, current_user)
    return success_response(data=data, message="Match summary retrieved")


@router.get("/by-job")
def matches_by_job(
    filters: mq.MatchFilters = Depends(match_filters),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    per_job: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    data = mq.by_job(db, current_user, filters, page, page_size, per_job)
    return success_response(data=data, message="Matches by job retrieved")


@router.get("/export.csv")
def export_matches(
    filters: mq.MatchFilters = Depends(match_filters),
    sort: Literal["score", "newest", "candidate", "job"] = "score",
    order: Literal["asc", "desc"] = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    rows = mq.apply_sort(mq.base_query(db, current_user, filters), sort, order).limit(EXPORT_LIMIT).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Candidate", "Candidate Title", "Candidate Location", "Experience (yrs)", "Candidate Email",
        "Job", "Client", "Job Location", "Recruiter", "Match Score", "Verdict",
        "Must-have Matched", "Matched Skills", "Missing Skills", "First Matched",
        *(["Dismissed Reason", "Dismissed By", "Dismissed At"] if filters.status == "dismissed" else []),
    ])
    for r in rows:
        m = mq.serialize(r)
        d = m["dismissal"] or {}
        w.writerow([
            m["candidate_name"], m["candidate_title"] or "", m["candidate_location"] or "",
            m["candidate_experience_years"] if m["candidate_experience_years"] is not None else "",
            m["candidate_email"] or "", m["job_title"], m["client_name"], m["job_location"] or "",
            m["recruiter_name"] or "", m["match_score"], m["verdict"].replace("_", " ").title(),
            f"{m['must_have_matched']}/{m['must_have_total']}",
            "; ".join(m["matched_skills"]), "; ".join(m["missing_skills"]),
            (m["first_matched_at"] or "")[:10],
            *([actions.DISMISS_REASONS.get(d.get("reason"), ""), d.get("dismissed_by_name") or "",
               (d.get("dismissed_at") or "")[:16]] if filters.status == "dismissed" else []),
        ])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="matches-{stamp}.csv"'},
    )


@router.get("/status")
def cache_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    jobs_q = apply_jobs_visibility_filter(db.query(Job).filter(Job.status == JobStatus.ACTIVE), db, current_user)
    active_jobs = jobs_q.all()
    scoreable = sum(1 for j in active_jobs if cache.job_is_scoreable(j))
    last = cache.last_computed_at(db)
    pending = worker.pending
    data = {
        "last_computed_at": last.isoformat() if last else None,
        "refreshing": worker.busy or pending["full_rebuild"] or bool(pending["jobs"] or pending["candidates"]),
        "active_jobs": len(active_jobs),
        "jobs_with_skills": scoreable,
        "store_floor": cache.STORE_FLOOR,
        "dismiss_reasons": [{"value": k, "label": v} for k, v in actions.DISMISS_REASONS.items()],
    }
    if is_admin(current_user):
        data["last_error"] = worker.last_error
        data["pending"] = pending
    return success_response(data=data, message="Match cache status retrieved")


@router.post("/recalculate")
def recalculate(current_user: User = Depends(require_admin)):
    worker.enqueue_full()
    return success_response(message="Match scores are being recalculated")


@router.post("/shortlist")
def shortlist(
    body: ShortlistBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    result = actions.shortlist(db, current_user, [(p.job_id, p.candidate_id) for p in body.pairs])
    n = len(result["added"])
    return success_response(data=result, message=f"Shortlisted {n} candidate{'s' if n != 1 else ''}")


@router.post("/dismiss")
def dismiss(
    body: DismissBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    result = actions.dismiss(db, current_user, [(p.job_id, p.candidate_id) for p in body.pairs], body.reason, body.note)
    n = len(result["dismissed"])
    return success_response(data=result, message=f"Dismissed {n} match{'es' if n != 1 else ''}")


@router.post("/dismissals/undo")
def undo(
    body: UndoBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    result = actions.undo_dismissals(db, current_user, body.ids)
    n = len(result["restored"])
    return success_response(data=result, message=f"Restored {n} match{'es' if n != 1 else ''}")


@router.get("/filter-options")
def filter_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_match_access),
):
    """Jobs, clients and recruiters that currently have visible matches."""
    base = mq.base_query(db, current_user, mq.MatchFilters(min_score=cache.STORE_FLOOR))
    job_rows = (
        base.with_entities(Job.id, Job.title, Job.client_id, func.count())
        .order_by(None)
        .group_by(Job.id, Job.title, Job.client_id)
        .order_by(Job.title)
        .all()
    )
    client_rows = (
        base.with_entities(mq.Client.id, mq.Client.company_name)
        .order_by(None)
        .distinct()
        .order_by(mq.Client.company_name)
        .all()
    )
    data = {
        "jobs": [{"id": j[0], "title": j[1], "client_id": j[2], "match_count": j[3]} for j in job_rows],
        "clients": [{"id": c[0], "name": c[1]} for c in client_rows],
    }
    if is_admin(current_user):
        rec_rows = (
            base.with_entities(mq.Recruiter.id, mq.Recruiter.name)
            .filter(mq.Recruiter.id.isnot(None))
            .order_by(None)
            .distinct()
            .order_by(mq.Recruiter.name)
            .all()
        )
        data["recruiters"] = [{"id": r[0], "name": r[1]} for r in rec_rows]
    return success_response(data=data, message="Filter options retrieved")
