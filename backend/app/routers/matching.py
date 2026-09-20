from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import success_response
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import ActivityAction, EntityType, PipelineStage
from app.models.job import Job
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.matching_service import (
    match_candidates_for_job,
    match_jobs_for_candidate,
    result_to_dict,
    score_pair,
)
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
    data = match_jobs_for_candidate(
        db,
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
    data = match_candidates_for_job(
        db,
        job,
        min_score=min_score,
        limit=limit,
        location=location,
    )
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

    added = []
    skipped = []
    for cid in body.candidate_ids:
        candidate = db.query(Candidate).filter(Candidate.id == cid, Candidate.is_archived.is_(False)).first()
        if not candidate:
            skipped.append({"candidate_id": cid, "reason": "not_found"})
            continue
        existing = (
            db.query(CandidateJobAssignment)
            .filter(
                CandidateJobAssignment.candidate_id == cid,
                CandidateJobAssignment.job_id == job_id,
            )
            .first()
        )
        if existing:
            skipped.append({"candidate_id": cid, "reason": "already_assigned"})
            continue
        assignment = CandidateJobAssignment(
            candidate_id=cid,
            job_id=job_id,
            status=PipelineStage.APPLIED,
            assigned_recruiter_id=job.assigned_recruiter_id or current_user.id,
        )
        db.add(assignment)
        if not candidate.assigned_job_id:
            candidate.assigned_job_id = job_id
        log_activity(
            db,
            EntityType.CANDIDATE,
            cid,
            ActivityAction.UPDATED,
            f"Matched & shortlisted to job '{job.title}'",
            current_user.id,
        )
        added.append(cid)

    if not added and skipped:
        raise BadRequestException("No candidates were shortlisted")

    db.commit()
    return success_response(
        data={"added": added, "skipped": skipped},
        message=f"Shortlisted {len(added)} candidate(s)",
    )
