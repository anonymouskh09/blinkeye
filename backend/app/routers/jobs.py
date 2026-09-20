from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.response import paginate, success_response
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import ActivityAction, EntityType, JobStatus, UserRole
from app.models.job import Job
from app.models.job_activity import JobActivity
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse, JobUpdate
from app.schemas.scheduled_activity import ScheduledActivityCreate, ScheduledActivityUpdate
from app.services.activity_service import log_activity
from app.services.permission_service import (
    apply_jobs_visibility_filter,
    apply_hidden_clients_filter,
    get_job_or_404,
    require_add_jobs,
    require_edit_jobs,
    require_job_access,
    require_view_jobs,
)
from app.services.scheduled_activity_service import scheduled_activity_response

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_to_response(job: Job, db: Session) -> dict:
    client = db.query(Client).filter(Client.id == job.client_id).first()
    engagement = (
        db.query(Engagement).filter(Engagement.id == job.engagement_id).first()
        if job.engagement_id
        else None
    )
    recruiter = None
    if job.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == job.assigned_recruiter_id).first()
    candidate_count = len(job.candidate_assignments) if job.candidate_assignments else 0
    return JobResponse(
        id=job.id,
        title=job.title,
        client_id=job.client_id,
        client_name=client.company_name if client else None,
        engagement_id=job.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        service_model=engagement.service_model if engagement else None,
        billing_model=engagement.billing_model if engagement else None,
        location=job.location,
        job_type=job.job_type,
        salary_min=job.salary_min,
        salary_max=job.salary_max,
        required_skills=job.required_skills,
        must_have_skills=job.must_have_skills,
        nice_to_have_skills=job.nice_to_have_skills,
        experience_required=job.experience_required,
        min_experience_years=job.min_experience_years,
        max_experience_years=job.max_experience_years,
        description=job.description,
        screening_questions=job.screening_questions,
        number_of_positions=job.number_of_positions,
        status=job.status,
        assigned_recruiter_id=job.assigned_recruiter_id,
        assigned_recruiter_name=recruiter.name if recruiter else None,
        candidate_count=candidate_count,
        created_at=job.created_at,
        updated_at=job.updated_at,
    ).model_dump(mode="json")



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
    engagement_id: int | None = None,
    recruiter_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_view_jobs),
):
    query = db.query(Job).options(joinedload(Job.candidate_assignments))
    query = apply_jobs_visibility_filter(query, db, current_user)

    if current_user.role == UserRole.ADMIN and recruiter_id:
        query = query.filter(Job.assigned_recruiter_id == recruiter_id)

    if search:
        term = f"%{search}%"
        from app.services.search_refs import parse_job_ref

        clauses = [
            Job.title.ilike(term),
            Job.location.ilike(term),
            Job.description.ilike(term),
            cast(Job.id, String).ilike(term),
        ]
        ref_id = parse_job_ref(search)
        if ref_id is not None:
            clauses.append(Job.id == ref_id)
        query = query.filter(or_(*clauses))
    if status:
        query = query.filter(Job.status == status)
    else:
        query = query.filter(Job.status != JobStatus.ARCHIVED)
    if client_id:
        query = query.filter(Job.client_id == client_id)
    if engagement_id:
        query = query.filter(Job.engagement_id == engagement_id)
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
    current_user: User = Depends(require_add_jobs),
):
    engagement = None
    if payload.engagement_id:
        engagement = db.query(Engagement).filter(Engagement.id == payload.engagement_id).first()
        if not engagement:
            raise BadRequestException("Engagement not found.")
        if payload.client_id is not None and payload.client_id != engagement.client_id:
            raise BadRequestException("Selected Engagement does not belong to the selected Client.")
        client_id = engagement.client_id
    else:
        if not payload.client_id:
            raise BadRequestException("Client is required.")
        client = db.query(Client).filter(Client.id == payload.client_id).first()
        if not client:
            raise NotFoundException("Client not found")
        client_id = client.id

    if payload.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == payload.assigned_recruiter_id).first()
        if not recruiter:
            raise NotFoundException("Recruiter not found")

    data = payload.model_dump(exclude={"client_id"})
    data["client_id"] = client_id
    data["engagement_id"] = engagement.id if engagement else None
    if data.get("must_have_skills") and not data.get("required_skills"):
        data["required_skills"] = ", ".join(data["must_have_skills"])
    if not data.get("assigned_recruiter_id") and current_user.role != UserRole.ADMIN:
        data["assigned_recruiter_id"] = current_user.id
    job = Job(**data)
    db.add(job)
    db.flush()
    engagement_label = engagement.engagement_name if engagement else "no engagement"
    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.CREATED,
        f"Job '{job.title}' was created ({engagement_label})", current_user.id,
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
    require_job_access(current_user, job, db)
    data = _job_to_response(job, db)
    data["activities"] = _list_job_activities(db, job_id)
    return success_response(data=data, message="Job retrieved")


@router.put("/{job_id}")
def update_job(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edit_jobs),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    update_data = payload.model_dump(exclude_unset=True)

    if "engagement_id" in update_data:
        if update_data["engagement_id"] is None:
            pass
        else:
            engagement = db.query(Engagement).filter(Engagement.id == update_data["engagement_id"]).first()
            if not engagement:
                raise BadRequestException("Engagement not found.")
            update_data["client_id"] = engagement.client_id

    if "client_id" in update_data and update_data["client_id"] is not None:
        new_client = db.query(Client).filter(Client.id == update_data["client_id"]).first()
        if not new_client:
            raise NotFoundException("Client not found")
        # Engagement must belong to the new client (or be cleared)
        next_engagement_id = update_data.get("engagement_id", job.engagement_id)
        if "engagement_id" in update_data and update_data["engagement_id"] is None:
            next_engagement_id = None
        if next_engagement_id:
            engagement = db.query(Engagement).filter(Engagement.id == next_engagement_id).first()
            if not engagement or engagement.client_id != update_data["client_id"]:
                update_data["engagement_id"] = None

    for key, value in update_data.items():
        setattr(job, key, value)

    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.UPDATED,
        f"Job '{job.title}' was updated", current_user.id,
    )
    db.commit()
    db.refresh(job)
    return success_response(data=_job_to_response(job, db), message="Job updated")


@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edit_jobs),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    job.status = JobStatus.ARCHIVED
    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.DELETED,
        f"Job '{job.title}' was archived", current_user.id,
    )
    db.commit()
    return success_response(message="Job archived")


@router.post("/{job_id}/unarchive")
def unarchive_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_edit_jobs),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
    job.status = JobStatus.ACTIVE
    log_activity(
        db, EntityType.JOB, job.id, ActivityAction.STATUS_CHANGED,
        f"Job '{job.title}' was restored from archive", current_user.id,
    )
    db.commit()
    db.refresh(job)
    return success_response(data=_job_to_response(job, db), message="Job restored")


@router.delete("/{job_id}/permanent")
def permanently_delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from app.models.candidate_job import CandidateJobAssignment

    job = get_job_or_404(db, job_id)
    title = job.title
    db.query(CandidateJobAssignment).filter(CandidateJobAssignment.job_id == job_id).delete()
    db.delete(job)
    log_activity(
        db, EntityType.JOB, job_id, ActivityAction.DELETED,
        f"Job '{title}' was permanently deleted", current_user.id,
    )
    db.commit()
    return success_response(message="Job permanently deleted")


@router.post("/{job_id}/activities")
def create_job_activity(
    job_id: int,
    payload: ScheduledActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = get_job_or_404(db, job_id)
    require_job_access(current_user, job, db)
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
    require_job_access(current_user, job, db)
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
    require_job_access(current_user, job, db)
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
