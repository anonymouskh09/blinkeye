from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.core.security import hash_password
from app.models.activity_log import ActivityLog
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import JobStatus, PipelineStage, UserRole, UserStatus
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _apply_date_filter(query, column, date_from: date | None, date_to: date | None):
    if date_from:
        query = query.filter(func.date(column) >= date_from)
    if date_to:
        query = query.filter(func.date(column) <= date_to)
    return query


def _user_to_response(user: User, db: Session) -> dict:
    assigned_count = db.query(func.count(Job.id)).filter(
        Job.assigned_recruiter_id == user.id
    ).scalar() or 0
    data = UserResponse.model_validate(user).model_dump()
    data["assigned_jobs_count"] = assigned_count
    return data


@router.get("")
def list_users(
    search: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (User.name.ilike(term)) | (User.email.ilike(term))
        )
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_user_to_response(u, db) for u in users]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Users retrieved",
    )


@router.post("")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise BadRequestException("Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        password_hash=hash_password(payload.password),
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return success_response(data=_user_to_response(user, db), message="User created")


@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    jobs = db.query(Job).filter(Job.assigned_recruiter_id == user_id).all()
    data = _user_to_response(user, db)
    data["assigned_jobs"] = [
        {"id": j.id, "title": j.title, "status": j.status.value, "created_at": j.created_at.isoformat()}
        for j in jobs
    ]
    return success_response(data=data, message="User retrieved")


@router.get("/{user_id}/overview")
def get_user_overview(
    user_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    jobs_q = db.query(Job).filter(Job.assigned_recruiter_id == user_id)
    jobs_q = _apply_date_filter(jobs_q, Job.created_at, date_from, date_to)
    jobs = jobs_q.all()
    job_ids = [j.id for j in jobs]

    cand_q = db.query(Candidate).filter(Candidate.created_by == user_id)
    cand_q = _apply_date_filter(cand_q, Candidate.created_at, date_from, date_to)
    candidates_created = cand_q.count()
    resumes_added = cand_q.filter(Candidate.cv_file_path.isnot(None)).count()

    cj_base = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.assigned_recruiter_id == user_id
    )
    cj_base = _apply_date_filter(cj_base, CandidateJobAssignment.created_at, date_from, date_to)

    added_to_job = cj_base.count()
    shortlisted = cj_base.filter(CandidateJobAssignment.status == PipelineStage.SHORTLISTED).count()
    interviewed = cj_base.filter(CandidateJobAssignment.status.in_([
        PipelineStage.INTERVIEW_SCHEDULED, PipelineStage.INTERVIEW_COMPLETED,
    ])).count()
    offers = cj_base.filter(CandidateJobAssignment.status == PipelineStage.OFFER_SENT).count()
    hired = cj_base.filter(CandidateJobAssignment.status == PipelineStage.HIRED).count()

    cj_ids = [cj.id for cj in cj_base.all()]
    interviews_q = db.query(Interview).filter(Interview.candidate_job_id.in_(cj_ids)) if cj_ids else None
    if interviews_q is not None:
        if date_from:
            interviews_q = interviews_q.filter(Interview.interview_date >= date_from)
        if date_to:
            interviews_q = interviews_q.filter(Interview.interview_date <= date_to)
        interviews_scheduled = interviews_q.count()
    else:
        interviews_scheduled = 0

    job_stats = {
        "total": len(jobs),
        "active": len([j for j in jobs if j.status == JobStatus.ACTIVE]),
        "pending": len([j for j in jobs if j.status == JobStatus.PENDING]),
        "on_hold": len([j for j in jobs if j.status == JobStatus.ON_HOLD]),
        "closed": len([j for j in jobs if j.status == JobStatus.CLOSED]),
        "filled": len([j for j in jobs if j.status == JobStatus.FILLED]),
    }

    pipeline_groups = {
        "new": [PipelineStage.APPLIED, PipelineStage.CV_REVIEWED],
        "shortlisted": [PipelineStage.SHORTLISTED, PipelineStage.PHONE_SCREENING],
        "interview": [PipelineStage.INTERVIEW_SCHEDULED, PipelineStage.INTERVIEW_COMPLETED],
        "client_review": [PipelineStage.CLIENT_REVIEW],
        "offered": [PipelineStage.OFFER_SENT],
        "hired": [PipelineStage.HIRED],
    }
    pipeline: dict[str, list] = {k: [] for k in pipeline_groups}
    assignments_q = (
        db.query(CandidateJobAssignment)
        .options(joinedload(CandidateJobAssignment.candidate), joinedload(CandidateJobAssignment.job))
        .filter(CandidateJobAssignment.assigned_recruiter_id == user_id)
    )
    assignments_q = _apply_date_filter(assignments_q, CandidateJobAssignment.created_at, date_from, date_to)
    assignments = assignments_q.all()
    for assignment in assignments:
        for group, stages in pipeline_groups.items():
            if assignment.status in stages:
                job = assignment.job
                candidate = assignment.candidate
                pipeline[group].append({
                    "assignment_id": assignment.id,
                    "candidate_id": candidate.id,
                    "name": candidate.name,
                    "current_job_title": candidate.current_job_title,
                    "current_company": candidate.current_company,
                    "job_id": job.id if job else None,
                    "job_title": job.title if job else None,
                    "status": assignment.status.value,
                    "created_at": assignment.created_at.isoformat() if assignment.created_at else None,
                })
                break

    client_ids = list({j.client_id for j in jobs})
    clients = []
    client_map = {}
    if client_ids:
        client_map = {c.id: c.company_name for c in db.query(Client).filter(Client.id.in_(client_ids)).all()}
    assignment_counts = dict(
        db.query(CandidateJobAssignment.job_id, func.count(CandidateJobAssignment.id))
        .filter(CandidateJobAssignment.job_id.in_(job_ids))
        .group_by(CandidateJobAssignment.job_id)
        .all()
    ) if job_ids else {}

    if client_ids:
        for client_id in client_ids:
            client_jobs = [j for j in jobs if j.client_id == client_id]
            clients.append({
                "id": client_id,
                "company_name": client_map.get(client_id, ""),
                "jobs_count": len(client_jobs),
                "active_jobs": len([j for j in client_jobs if j.status == JobStatus.ACTIVE]),
            })

    activity_q = db.query(ActivityLog).filter(ActivityLog.created_by == user_id)
    activity_q = _apply_date_filter(activity_q, ActivityLog.created_at, date_from, date_to)
    activity_logs = activity_q.order_by(ActivityLog.created_at.desc()).limit(20).all()
    history = [
        {
            "id": log.id,
            "description": log.description,
            "action": log.action.value,
            "entity_type": log.entity_type.value,
            "created_at": log.created_at.isoformat(),
        }
        for log in activity_logs
    ]

    return success_response(
        data={
            "user": _user_to_response(user, db),
            "stats": {
                "candidates_created": candidates_created,
                "candidates_owned": candidates_created,
                "resumes_added": resumes_added,
                "added_to_job": added_to_job,
                "shortlisted": shortlisted,
                "interviewed": interviewed,
                "interviews_scheduled": interviews_scheduled,
                "offers": offers,
                "hired": hired,
                "jobs": job_stats,
                "clients_count": len(clients),
            },
            "pipeline": pipeline,
            "clients": clients,
            "jobs": [
                {
                    "id": j.id,
                    "title": j.title,
                    "status": j.status.value,
                    "client_name": client_map.get(j.client_id),
                    "candidate_count": assignment_counts.get(j.id, 0),
                    "created_at": j.created_at.isoformat(),
                }
                for j in jobs
            ],
            "history": history,
            "filter": {
                "date_from": date_from.isoformat() if date_from else None,
                "date_to": date_to.isoformat() if date_to else None,
            },
        },
        message="User overview retrieved",
    )


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            user.password_hash = hash_password(password)

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return success_response(data=_user_to_response(user, db), message="User updated")


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    if user.id == admin.id:
        raise BadRequestException("Cannot deactivate your own account")

    user.status = UserStatus.INACTIVE
    db.commit()
    return success_response(message="User deactivated")
