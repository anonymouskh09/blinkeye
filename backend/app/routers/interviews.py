from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.response import paginate, success_response
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import ActivityAction, EntityType, InterviewStatus, UserRole
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.schemas.interview import InterviewCreate, InterviewResponse, InterviewUpdate
from app.services.activity_service import log_activity

router = APIRouter(prefix="/interviews", tags=["interviews"])


def _interview_to_response(interview: Interview, db: Session) -> dict:
    cj = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.id == interview.candidate_job_id
    ).first()
    candidate_name = job_title = client_name = None
    if cj:
        candidate_name = cj.candidate.name if cj.candidate else None
        job = db.query(Job).filter(Job.id == cj.job_id).first()
        if job:
            job_title = job.title
            client = db.query(Client).filter(Client.id == job.client_id).first()
            client_name = client.company_name if client else None

    creator = db.query(User).filter(User.id == interview.created_by).first()
    return InterviewResponse(
        id=interview.id,
        candidate_job_id=interview.candidate_job_id,
        candidate_name=candidate_name,
        job_title=job_title,
        client_name=client_name,
        interview_date=interview.interview_date,
        interview_time=interview.interview_time,
        interview_type=interview.interview_type,
        interviewer_name=interview.interviewer_name,
        meeting_link=interview.meeting_link,
        location=interview.location,
        status=interview.status,
        notes=interview.notes,
        created_by=interview.created_by,
        created_by_name=creator.name if creator else None,
        created_at=interview.created_at,
        updated_at=interview.updated_at,
    ).model_dump()


def _can_access_interview(user: User, interview: Interview, db: Session) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    cj = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.id == interview.candidate_job_id
    ).first()
    if not cj:
        return False
    job = db.query(Job).filter(Job.id == cj.job_id).first()
    return job and job.assigned_recruiter_id == user.id


@router.get("")
def list_interviews(
    status: InterviewStatus | None = None,
    job_id: int | None = None,
    recruiter_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Interview).options(joinedload(Interview.candidate_job))

    if current_user.role != UserRole.ADMIN:
        recruiter_id = current_user.id

    if recruiter_id:
        job_ids = [j.id for j in db.query(Job).filter(Job.assigned_recruiter_id == recruiter_id).all()]
        cj_ids = [
            cj.id for cj in db.query(CandidateJobAssignment).filter(
                CandidateJobAssignment.job_id.in_(job_ids)
            ).all()
        ] if job_ids else []
        query = query.filter(Interview.candidate_job_id.in_(cj_ids if cj_ids else [-1]))

    if status:
        query = query.filter(Interview.status == status)
    if date_from:
        query = query.filter(Interview.interview_date >= date_from)
    if date_to:
        query = query.filter(Interview.interview_date <= date_to)
    if job_id:
        cj_ids = [
            cj.id for cj in db.query(CandidateJobAssignment).filter(
                CandidateJobAssignment.job_id == job_id
            ).all()
        ]
        query = query.filter(Interview.candidate_job_id.in_(cj_ids if cj_ids else [-1]))

    total = query.count()
    interviews = query.order_by(Interview.interview_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_interview_to_response(i, db) for i in interviews]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Interviews retrieved",
    )


@router.post("")
def create_interview(
    payload: InterviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cj = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.id == payload.candidate_job_id
    ).first()
    if not cj:
        raise NotFoundException("Candidate job assignment not found")

    job = db.query(Job).filter(Job.id == cj.job_id).first()
    if current_user.role != UserRole.ADMIN and job.assigned_recruiter_id != current_user.id:
        raise ForbiddenException("Access denied")

    interview = Interview(**payload.model_dump(), created_by=current_user.id)
    db.add(interview)
    db.flush()
    log_activity(
        db, EntityType.CANDIDATE, cj.candidate_id, ActivityAction.INTERVIEW_SCHEDULED,
        f"Interview scheduled with {payload.interviewer_name} on {payload.interview_date}",
        current_user.id,
    )
    db.commit()
    db.refresh(interview)
    return success_response(data=_interview_to_response(interview, db), message="Interview scheduled")


@router.put("/{interview_id}")
def update_interview(
    interview_id: int,
    payload: InterviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise NotFoundException("Interview not found")
    if not _can_access_interview(current_user, interview, db):
        raise ForbiddenException("Access denied")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(interview, key, value)

    cj = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.id == interview.candidate_job_id
    ).first()
    action = ActivityAction.INTERVIEW_UPDATED
    if payload.status == InterviewStatus.CANCELLED:
        action = ActivityAction.INTERVIEW_CANCELLED

    if cj:
        log_activity(
            db, EntityType.CANDIDATE, cj.candidate_id, action,
            f"Interview updated - status: {interview.status.value}", current_user.id,
        )

    db.commit()
    db.refresh(interview)
    return success_response(data=_interview_to_response(interview, db), message="Interview updated")


@router.delete("/{interview_id}")
def delete_interview(
    interview_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    interview = db.query(Interview).filter(Interview.id == interview_id).first()
    if not interview:
        raise NotFoundException("Interview not found")
    if not _can_access_interview(current_user, interview, db):
        raise ForbiddenException("Access denied")

    cj = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.id == interview.candidate_job_id
    ).first()
    if cj:
        log_activity(
            db, EntityType.CANDIDATE, cj.candidate_id, ActivityAction.INTERVIEW_CANCELLED,
            "Interview was cancelled/deleted", current_user.id,
        )

    interview.status = InterviewStatus.CANCELLED
    db.commit()
    return success_response(message="Interview cancelled")
