from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.response import paginate, success_response
from app.models.client import Client
from app.models.enums import ActivityAction, EntityType, JobStatus, UserRole
from app.models.job import Job
from app.models.job_activity import JobActivity
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse, JobUpdate
from app.schemas.scheduled_activity import ScheduledActivityCreate, ScheduledActivityUpdate
from app.services.activity_service import log_activity
from app.services.permission_service import get_job_or_404, require_job_access
from app.services.scheduled_activity_service import scheduled_activity_response

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_to_response(job: Job, db: Session) -> dict:
    client = db.query(Client).filter(Client.id == job.client_id).first()
    recruiter = None
    if job.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == job.assigned_recruiter_id).first()
    candidate_count = len(job.candidate_assignments) if job.candidate_assignments else 0
    return JobResponse(
        id=job.id,
        title=job.title,
        client_id=job.client_id,
        client_name=client.company_name if client else None,
        location=job.location,
        job_type=job.job_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        required_skills=job.required_skills,
        experience_required=job.experience_required,
        description=job.description,
        number_of_positions=job.number_of_positions,
        status=job.status,
        assigned_recruiter_id=job.assigned_recruiter_id,
        assigned_recruiter_name=recruiter.name if recruiter else None,
        candidate_count=candidate_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
    ).model_dump()


def _list_job_activities(db: Session, job_id: int) -> list[dict]:
    activities = (
        db.query(JobActivity)
        .filter(JobActivity.job_id == job_id)
        .order_by(JobActivity.activity_date.desc(), JobActivity.created_at.desc())
        .all()
    )
    return [scheduled_activity_response(a, db) for a in activities]


@router.get("")
def list_jobs(
    search: str | None = None,
    status: JobStatus | None = None,
    client_id: int | None = None,
    recruiter_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Job).options(joinedload(Job.candidate_assignments))

    if current_user.role != UserRole.ADMIN:
        query = query.filter(Job.assigned_recruiter_id == current_user.id)
    elif recruiter_id:
        query = query.filter(Job.assigned_recruiter_id == recruiter_id)

    if search:
        query = query.filter(Job.title.ilike(f"%{search}%"))
    if status:
        query = query.filter(Job.status == status)
    if client_id:
        query = query.filter(Job.client_id == client_id)
    if date_from:
        query = query.filter(func.date(Job.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(Job.created_at) <= date_to)

    total = query.count()
    jobs = query.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_job_to_response(j, db) for j in jobs]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Jobs retrieved",
    )


@router.post("")
def create_job(
    payload: JobCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise NotFoundException("Client not found")

    if payload.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == payload.assigned_recruiter_id).first()
        if not recruiter:
            raise NotFoundException("Recruiter not found")

    job = Job(**payload.model_dump())
    db.add(job)
    db.flush()
    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.CREATED,
        f"Job '{job.title}' was created", admin.id,
    )
    db.commit()
    db.refresh(job)
    return success_response(data=_job_to_response(job, db), message="Job created")


@router.get("/{job_id}")
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).options(joinedload(Job.candidate_assignments)).filter(Job.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    require_job_access(current_user, job)
    data = _job_to_response(job, db)
    data["activities"] = _list_job_activities(db, job_id)
    return success_response(data=data, message="Job retrieved")


@router.put("/{job_id}")
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    job = get_job_or_404(db, job_id)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(job, key, value)

    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.UPDATED,
        f"Job '{job.title}' was updated", admin.id,
    )
    db.commit()
    db.refresh(job)
    return success_response(data=_job_to_response(job, db), message="Job updated")


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    job = get_job_or_404(db, job_id)
    job.status = JobStatus.CLOSED
    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.DELETED,
        f"Job '{job.title}' was closed", admin.id,
    )
    db.commit()
    return success_response(message="Job closed")


@router.post("/{job_id}/activities")
def create_job_activity(
    job_id: int,
    payload: ScheduledActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job)
    activity = JobActivity(
        job_id=job_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(activity)
    log_activity(
        db, EntityType.JOB, job_id, ActivityAction.UPDATED,
        f"Activity '{payload.title}' was created", current_user.id,
    )
    db.commit()
    db.refresh(activity)
    return success_response(
        data=scheduled_activity_response(activity, db),
        message="Activity created",
    )


@router.put("/{job_id}/activities/{activity_id}")
def update_job_activity(
    job_id: int,
    activity_id: int,
    payload: ScheduledActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job)
    activity = db.query(JobActivity).filter(
        JobActivity.id == activity_id,
        JobActivity.job_id == job_id,
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    log_activity(
        db, EntityType.JOB, job_id, ActivityAction.UPDATED,
        f"Activity '{activity.title}' was updated", current_user.id,
    )
    db.commit()
    db.refresh(activity)
    return success_response(
        data=scheduled_activity_response(activity, db),
        message="Activity updated",
    )


@router.delete("/{job_id}/activities/{activity_id}")
def delete_job_activity(
    job_id: int,
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job)
    activity = db.query(JobActivity).filter(
        JobActivity.id == activity_id,
        JobActivity.job_id == job_id,
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    title = activity.title
    db.delete(activity)
    log_activity(
        db, EntityType.JOB, job_id, ActivityAction.UPDATED,
        f"Activity '{title}' was deleted", current_user.id,
    )
    db.commit()
    return success_response(message="Activity deleted")
