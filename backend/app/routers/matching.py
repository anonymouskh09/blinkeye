from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import success_response
from app.models.candidate import Candidate
from app.models.user import User
from app.services import match_action_service as actions
from app.services import match_query_service as mq
from app.services.matching_service import result_to_dict, score_pair
from app.services.permission_service import get_job_or_404, require_job_access, require_view_candidates

router = APIRouter(prefix="/matching", tags=["matching"])


class BulkAssignBody(BaseModel):
    candidate_ids: list[int] = Field(min_length=1)


@router.get("/candidates/{candidate_id}/jobs")
def jobs_for_candidate(
    candidate_id: int,
    min_score: int = Query(30, ge=0, le=100),
    limit: int = Query(50, ge=1, le=100),
    location: str | None = None,
    job_type: str | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_candidates),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate or candidate.is_archived:
        raise NotFoundException("Candidate not found")
    data = mq.jobs_for_candidate(
        db,
        current_user,
        candidate,
        min_score=min_score,
        limit=limit,
        location=location,
        job_type=job_type,
        client_id=client_id,
    )
    return success_response(data=data, message="Job matches retrieved")


@router.get("/jobs/{job_id}/candidates")
def candidates_for_job(
    job_id: int,
    min_score: int = Query(30, ge=0, le=100),
    limit: int = Query(50, ge=1, le=100),
    location: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    data = mq.candidates_for_job(db, current_user, job, min_score=min_score, limit=limit, location=location)
    return success_response(data=data, message="Candidate matches retrieved")


@router.get("/calibrate")
def calibrate_pair(
    candidate_id: int = Query(...),
    job_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate or candidate.is_archived:
        raise NotFoundException("Candidate not found")
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    result = score_pair(job, candidate)
    return success_response(
        data={
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "job_id": job.id,
            "job_title": job.title,
            "screening_questions": job.screening_questions or [],
            **result_to_dict(result),
        },
        message="Calibration retrieved",
    )


@router.post("/jobs/{job_id}/shortlist")
def shortlist_candidates(
    job_id: int,
    body: BulkAssignBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    result = actions.shortlist(db, current_user, [(job_id, cid) for cid in body.candidate_ids])
    added = [a["candidate_id"] for a in result["added"]]
    skipped = [{"candidate_id": s["candidate_id"], "reason": s["reason"]} for s in result["skipped"]]
    if not added and skipped:
        raise BadRequestException("No candidates were shortlisted")
    return success_response(
        data={"added": added, "skipped": skipped},
        message=f"Shortlisted {len(added)} candidate(s)",
    )
