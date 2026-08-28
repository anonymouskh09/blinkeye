from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import ActivityAction, EntityType, PIPELINE_STAGES_ORDER
from app.models.user import User
from app.schemas.candidate import PipelineStatusUpdate
from app.services.activity_service import log_activity
from app.services.permission_service import get_job_or_404, require_job_access

router = APIRouter(tags=["pipeline"])


@router.get("/jobs/{job_id}/pipeline")
def get_pipeline(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job)

    assignments = (
        db.query(CandidateJobAssignment)
        .options(joinedload(CandidateJobAssignment.candidate))
        .filter(CandidateJobAssignment.job_id == job_id)
        .all()
    )

    stages = {stage.value: [] for stage in PIPELINE_STAGES_ORDER}
    for assignment in assignments:
        candidate = assignment.candidate
        card = {
            "assignment_id": assignment.id,
            "candidate_id": candidate.id,
            "name": candidate.name,
            "current_job_title": candidate.current_job_title,
            "current_company": candidate.current_company,
            "experience_years": candidate.experience_years,
            "status": assignment.status.value,
            "created_at": assignment.created_at.isoformat() if assignment.created_at else None,
        }
        stages[assignment.status.value].append(card)

    return success_response(
        data={"job_id": job_id, "job_title": job.title, "stages": stages},
        message="Pipeline retrieved",
    )


@router.put("/candidate-jobs/{assignment_id}/status")
def update_pipeline_status(
    assignment_id: int,
    payload: PipelineStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = (
        db.query(CandidateJobAssignment)
        .options(joinedload(CandidateJobAssignment.candidate), joinedload(CandidateJobAssignment.job))
        .filter(CandidateJobAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise NotFoundException("Assignment not found")

    require_job_access(current_user, assignment.job)
    old_status = assignment.status.value
    # CandidateJobAssignment.status is the sole pipeline source of truth.
    # Do NOT write Candidate.candidate_status (legacy global CRM field).
    assignment.status = payload.status

    candidate = assignment.candidate
    log_activity(
        db,
        EntityType.CANDIDATE,
        candidate.id,
        ActivityAction.STATUS_CHANGED,
        f"Pipeline status changed from '{old_status}' to '{payload.status.value}' for job '{assignment.job.title}'",
        current_user.id,
    )
    db.commit()
    return success_response(
        data={"assignment_id": assignment.id, "status": assignment.status.value},
        message="Pipeline status updated",
    )
