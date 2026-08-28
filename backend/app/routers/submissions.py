from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import (
    ActivityAction,
    EntityType,
    SubmissionStatus,
    UserRole,
)
from app.models.job import Job
from app.models.submission import ClientFeedback, Submission
from app.models.user import User
from app.schemas.submission import (
    ClientFeedbackCreate,
    ClientFeedbackResponse,
    SubmissionCreate,
    SubmissionResponse,
    SubmissionStatusUpdate,
    SubmissionUpdate,
)
from app.services.activity_service import log_activity
from app.services.permission_service import require_job_access
from app.services.submission_service import (
    apply_feedback_sync,
    assignment_can_submit,
    has_active_submission,
    mark_assignment_submitted,
)

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _feedback_to_response(fb: ClientFeedback, db: Session) -> dict:
    user = db.query(User).filter(User.id == fb.created_by).first()
    return ClientFeedbackResponse(
        id=fb.id,
        submission_id=fb.submission_id,
        feedback_type=fb.feedback_type,
        feedback_text=fb.feedback_text,
        rating=fb.rating,
        rejection_reason=fb.rejection_reason,
        notes=fb.notes,
        created_by=fb.created_by,
        created_by_name=user.name if user else None,
        feedback_date=fb.feedback_date,
        created_at=fb.created_at,
        updated_at=fb.updated_at,
    ).model_dump(mode="json")


def _submission_to_response(sub: Submission, db: Session, include_feedback: bool = True) -> dict:
    candidate = db.query(Candidate).filter(Candidate.id == sub.candidate_id).first()
    job = db.query(Job).filter(Job.id == sub.job_id).first()
    client = db.query(Client).filter(Client.id == sub.client_id).first()
    engagement = (
        db.query(Engagement).filter(Engagement.id == sub.engagement_id).first()
        if sub.engagement_id
        else None
    )
    recruiter = db.query(User).filter(User.id == sub.recruiter_id).first()
    assignment = (
        db.query(CandidateJobAssignment)
        .filter(CandidateJobAssignment.id == sub.candidate_job_assignment_id)
        .first()
    )

    feedback = []
    if include_feedback:
        entries = (
            db.query(ClientFeedback)
            .filter(ClientFeedback.submission_id == sub.id)
            .order_by(ClientFeedback.feedback_date.desc(), ClientFeedback.id.desc())
            .all()
        )
        feedback = [_feedback_to_response(fb, db) for fb in entries]

    return SubmissionResponse(
        id=sub.id,
        candidate_job_assignment_id=sub.candidate_job_assignment_id,
        candidate_id=sub.candidate_id,
        candidate_name=candidate.name if candidate else None,
        job_id=sub.job_id,
        job_title=job.title if job else None,
        client_id=sub.client_id,
        client_name=client.company_name if client else None,
        engagement_id=sub.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        recruiter_id=sub.recruiter_id,
        recruiter_name=recruiter.name if recruiter else None,
        submission_date=sub.submission_date,
        resume_file_path=sub.resume_file_path,
        candidate_summary=sub.candidate_summary,
        expected_compensation=sub.expected_compensation,
        availability=sub.availability,
        recruiter_notes=sub.recruiter_notes,
        status=sub.status,
        assignment_status=assignment.status.value if assignment else None,
        feedback=feedback,
        created_at=sub.created_at,
        updated_at=sub.updated_at,
    ).model_dump(mode="json")


def _get_submission_or_404(db: Session, submission_id: int) -> Submission:
    sub = db.query(Submission).filter(Submission.id == submission_id).first()
    if not sub:
        raise NotFoundException("Submission not found")
    return sub


def _require_submission_access(user: User, db: Session, sub: Submission) -> Job:
    job = db.query(Job).filter(Job.id == sub.job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    require_job_access(user, job)
    return job


@router.get("")
def list_submissions(
    job_id: int | None = None,
    candidate_id: int | None = None,
    client_id: int | None = None,
    recruiter_id: int | None = None,
    status: SubmissionStatus | None = None,
    candidate_job_assignment_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Submission)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(
            (Submission.recruiter_id == current_user.id)
            | (Submission.job_id.in_(
                db.query(Job.id).filter(Job.assigned_recruiter_id == current_user.id)
            ))
        )
    if job_id:
        query = query.filter(Submission.job_id == job_id)
    if candidate_id:
        query = query.filter(Submission.candidate_id == candidate_id)
    if client_id:
        query = query.filter(Submission.client_id == client_id)
    if recruiter_id:
        query = query.filter(Submission.recruiter_id == recruiter_id)
    if status:
        query = query.filter(Submission.status == status)
    if candidate_job_assignment_id:
        query = query.filter(Submission.candidate_job_assignment_id == candidate_job_assignment_id)

    total = query.count()
    rows = (
        query.order_by(Submission.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [_submission_to_response(s, db, include_feedback=False) for s in rows]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Submissions retrieved",
    )


@router.post("")
def create_submission(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assignment = (
        db.query(CandidateJobAssignment)
        .options(
            joinedload(CandidateJobAssignment.candidate),
            joinedload(CandidateJobAssignment.job),
        )
        .filter(CandidateJobAssignment.id == payload.candidate_job_assignment_id)
        .first()
    )
    if not assignment:
        raise NotFoundException("Candidate-job assignment not found")

    job = assignment.job
    require_job_access(current_user, job)

    if not assignment_can_submit(assignment):
        raise BadRequestException(
            "Candidate must be at Qualified (or later) stage before submission. "
            f"Current stage: {assignment.status.value}"
        )

    existing = has_active_submission(db, assignment.id)
    if existing:
        raise BadRequestException(
            f"An active submission (#{existing.id}, status={existing.status.value}) "
            "already exists for this CandidateJob. Reject it before creating another."
        )

    candidate = assignment.candidate
    sub = Submission(
        candidate_job_assignment_id=assignment.id,
        candidate_id=assignment.candidate_id,
        job_id=assignment.job_id,
        client_id=job.client_id,
        engagement_id=job.engagement_id,
        recruiter_id=current_user.id,
        submission_date=payload.submission_date or date.today(),
        resume_file_path=payload.resume_file_path or candidate.cv_file_path,
        candidate_summary=payload.candidate_summary or candidate.summary,
        expected_compensation=payload.expected_compensation
        or (
            str(candidate.expected_salary)
            if candidate.expected_salary is not None
            else None
        ),
        availability=payload.availability or candidate.notice_period,
        recruiter_notes=payload.recruiter_notes,
        status=SubmissionStatus.SUBMITTED,
    )
    db.add(sub)

    old_stage = assignment.status.value
    mark_assignment_submitted(assignment)

    log_activity(
        db,
        EntityType.CANDIDATE,
        candidate.id,
        ActivityAction.CREATED,
        f"{current_user.name} submitted {candidate.name} to {job.title}.",
        current_user.id,
    )
    log_activity(
        db,
        EntityType.CANDIDATE,
        candidate.id,
        ActivityAction.STATUS_CHANGED,
        f"Pipeline status changed from '{old_stage}' to '{assignment.status.value}' "
        f"for job '{job.title}' (submission created)",
        current_user.id,
    )
    db.commit()
    db.refresh(sub)
    return success_response(
        data=_submission_to_response(sub, db),
        message="Candidate submitted",
    )


@router.get("/{submission_id}")
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = _get_submission_or_404(db, submission_id)
    _require_submission_access(current_user, db, sub)
    return success_response(data=_submission_to_response(sub, db), message="Submission retrieved")


@router.put("/{submission_id}")
def update_submission(
    submission_id: int,
    payload: SubmissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = _get_submission_or_404(db, submission_id)
    _require_submission_access(current_user, db, sub)

    update_data = payload.model_dump(exclude_unset=True)
    old_status = sub.status
    for key, value in update_data.items():
        setattr(sub, key, value)

    if "status" in update_data and update_data["status"] != old_status:
        log_activity(
            db,
            EntityType.CANDIDATE,
            sub.candidate_id,
            ActivityAction.STATUS_CHANGED,
            f"Submission #{sub.id} status changed from '{old_status.value}' to '{sub.status.value}'",
            current_user.id,
        )

    db.commit()
    db.refresh(sub)
    return success_response(data=_submission_to_response(sub, db), message="Submission updated")


@router.patch("/{submission_id}/status")
def update_submission_status(
    submission_id: int,
    payload: SubmissionStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = _get_submission_or_404(db, submission_id)
    _require_submission_access(current_user, db, sub)
    old = sub.status
    sub.status = payload.status
    log_activity(
        db,
        EntityType.CANDIDATE,
        sub.candidate_id,
        ActivityAction.STATUS_CHANGED,
        f"Submission #{sub.id} status changed from '{old.value}' to '{sub.status.value}'",
        current_user.id,
    )
    db.commit()
    db.refresh(sub)
    return success_response(data=_submission_to_response(sub, db), message="Submission status updated")


@router.post("/{submission_id}/feedback")
def add_client_feedback(
    submission_id: int,
    payload: ClientFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = _get_submission_or_404(db, submission_id)
    job = _require_submission_access(current_user, db, sub)

    assignment = (
        db.query(CandidateJobAssignment)
        .filter(CandidateJobAssignment.id == sub.candidate_job_assignment_id)
        .first()
    )
    if not assignment:
        raise NotFoundException("Candidate-job assignment not found")

    fb = ClientFeedback(
        submission_id=sub.id,
        feedback_type=payload.feedback_type,
        feedback_text=payload.feedback_text,
        rating=payload.rating,
        rejection_reason=payload.rejection_reason,
        notes=payload.notes,
        created_by=current_user.id,
        feedback_date=payload.feedback_date or datetime.now(timezone.utc),
    )
    db.add(fb)

    old_sub = sub.status.value
    old_pipe = assignment.status.value
    new_sub, new_pipe = apply_feedback_sync(sub, assignment, payload.feedback_type)

    log_activity(
        db,
        EntityType.CANDIDATE,
        sub.candidate_id,
        ActivityAction.CREATED,
        f"Client feedback recorded: {payload.feedback_type.value.replace('_', ' ').title()} "
        f"on submission #{sub.id} for {job.title}.",
        current_user.id,
    )
    if new_sub is not None and new_sub.value != old_sub:
        log_activity(
            db,
            EntityType.CANDIDATE,
            sub.candidate_id,
            ActivityAction.STATUS_CHANGED,
            f"Submission #{sub.id} status changed from '{old_sub}' to '{new_sub.value}' "
            f"because of client feedback",
            current_user.id,
        )
    if new_pipe is not None and new_pipe.value != old_pipe:
        log_activity(
            db,
            EntityType.CANDIDATE,
            sub.candidate_id,
            ActivityAction.STATUS_CHANGED,
            f"Pipeline status changed from '{old_pipe}' to '{new_pipe.value}' "
            f"for job '{job.title}' because of client feedback",
            current_user.id,
        )

    db.commit()
    db.refresh(sub)
    return success_response(
        data=_submission_to_response(sub, db),
        message="Client feedback recorded",
    )
