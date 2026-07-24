from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.response import success_response
from app.models.activity_log import ActivityLog
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import ClientStatus, InterviewStatus, JobStatus, PipelineStage, UserRole, UserStatus, PIPELINE_STAGES_ORDER
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.schemas.dashboard import (
    ChartDataPoint,
    DashboardCharts,
    DashboardRecentActivity,
    DashboardStats,
    RecruiterDashboardData,
    RecruiterDashboardStats,
    RecruiterJobProgress,
    TopJobItem,
)
from app.schemas.note import ActivityLogResponse
from app.schemas.interview import InterviewResponse
from app.routers.interviews import _interview_to_response

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    stats = DashboardStats(
        total_clients=db.query(Client).filter(Client.status == ClientStatus.ACTIVE).count(),
        total_active_jobs=db.query(Job).filter(Job.status == JobStatus.ACTIVE).count(),
        total_candidates=db.query(Candidate).count(),
        total_team_members=db.query(User).filter(User.status == UserStatus.ACTIVE).count(),
    )
    return success_response(data=stats.model_dump(), message="Stats retrieved")


@router.get("/charts")
def get_charts(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    stage_counts = dict(
        db.query(CandidateJobAssignment.status, func.count(CandidateJobAssignment.id))
        .group_by(CandidateJobAssignment.status)
        .all()
    )
    pipeline_stages = [
        ChartDataPoint(
            name=stage.value.replace("_", " ").title(),
            value=stage_counts.get(stage, 0),
        )
        for stage in PIPELINE_STAGES_ORDER
    ]

    status_counts = dict(
        db.query(Job.status, func.count(Job.id)).group_by(Job.status).all()
    )
    jobs_by_status = [
        ChartDataPoint(name=status.value.replace("-", " ").title(), value=status_counts.get(status, 0))
        for status in JobStatus
    ]

    recruiter_counts = dict(
        db.query(User.name, func.count(Candidate.id))
        .join(Candidate, Candidate.created_by == User.id)
        .filter(User.role == UserRole.RECRUITER, User.status == UserStatus.ACTIVE)
        .group_by(User.id, User.name)
        .all()
    )
    recruiters = db.query(User).filter(User.role == UserRole.RECRUITER, User.status == UserStatus.ACTIVE).all()
    recruiter_performance = [
        ChartDataPoint(name=r.name, value=recruiter_counts.get(r.name, 0)) for r in recruiters
    ]

    charts = DashboardCharts(
        pipeline_stages=pipeline_stages,
        jobs_by_status=jobs_by_status,
        recruiter_performance=recruiter_performance,
    )
    return success_response(data=charts.model_dump(), message="Charts retrieved")


@router.get("/recent-activity")
def get_recent_activity(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    logs = (
        db.query(ActivityLog)
        .options(joinedload(ActivityLog.created_by_user))
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent = []
    for log in logs:
        creator = log.created_by_user
        recent.append(
            ActivityLogResponse(
                id=log.id,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                action=log.action,
                description=log.description,
                created_by=log.created_by,
                created_by_name=creator.name if creator else None,
                created_at=log.created_at,
            ).model_dump()
        )

    upcoming = (
        db.query(Interview)
        .filter(Interview.status == InterviewStatus.SCHEDULED, Interview.interview_date >= date.today())
        .order_by(Interview.interview_date.asc())
        .limit(5)
        .all()
    )
    upcoming_items = [_interview_to_response(i, db) for i in upcoming]

    top_jobs_raw = (
        db.query(Job.id, Job.title, Client.company_name, func.count(CandidateJobAssignment.id).label("cnt"))
        .join(Client, Job.client_id == Client.id)
        .outerjoin(CandidateJobAssignment, CandidateJobAssignment.job_id == Job.id)
        .group_by(Job.id, Job.title, Client.company_name)
        .order_by(func.count(CandidateJobAssignment.id).desc())
        .limit(5)
        .all()
    )
    top_jobs = [
        TopJobItem(id=j.id, title=j.title, client_name=j.company_name, candidate_count=j.cnt).model_dump()
        for j in top_jobs_raw
    ]

    data = DashboardRecentActivity(
        recent_activity=recent,
        upcoming_interviews=upcoming_items,
        top_jobs=[TopJobItem(**t) for t in top_jobs],
    )
    return success_response(data=data.model_dump(), message="Recent activity retrieved")


@router.get("/recruiter")
def get_recruiter_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job_ids = [j.id for j in db.query(Job).filter(Job.assigned_recruiter_id == current_user.id).all()]

    stats = RecruiterDashboardStats(
        assigned_jobs=len(job_ids),
        candidates_added=db.query(Candidate).filter(Candidate.created_by == current_user.id).count(),
        interviews_scheduled=db.query(Interview).filter(
            Interview.created_by == current_user.id,
            Interview.status == InterviewStatus.SCHEDULED,
        ).count(),
        hired_candidates=db.query(CandidateJobAssignment).filter(
            CandidateJobAssignment.assigned_recruiter_id == current_user.id,
            CandidateJobAssignment.status == PipelineStage.HIRED,
        ).count(),
    )

    assigned_jobs = []
    for job in db.query(Job).filter(Job.assigned_recruiter_id == current_user.id).all():
        client = db.query(Client).filter(Client.id == job.client_id).first()
        total = db.query(CandidateJobAssignment).filter(CandidateJobAssignment.job_id == job.id).count()
        hired = db.query(CandidateJobAssignment).filter(
            CandidateJobAssignment.job_id == job.id,
            CandidateJobAssignment.status == PipelineStage.HIRED,
        ).count()
        progress = (hired / total * 100) if total > 0 else 0
        assigned_jobs.append(
            RecruiterJobProgress(
                id=job.id,
                title=job.title,
                client_name=client.company_name if client else "",
                status=job.status.value,
                total_candidates=total,
                hired_count=hired,
                progress_percent=round(progress, 1),
            ).model_dump()
        )

    cj_ids = [cj.id for cj in db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.job_id.in_(job_ids)
    ).all()] if job_ids else []

    upcoming = (
        db.query(Interview)
        .filter(
            Interview.candidate_job_id.in_(cj_ids if cj_ids else [-1]),
            Interview.status == InterviewStatus.SCHEDULED,
            Interview.interview_date >= date.today(),
        )
        .order_by(Interview.interview_date.asc())
        .limit(5)
        .all()
    )

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.created_by == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent = []
    for log in logs:
        recent.append(
            ActivityLogResponse(
                id=log.id,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                action=log.action,
                description=log.description,
                created_by=log.created_by,
                created_by_name=current_user.name,
                created_at=log.created_at,
            ).model_dump()
        )

    data = RecruiterDashboardData(
        stats=stats,
        assigned_jobs=[RecruiterJobProgress(**j) for j in assigned_jobs],
        upcoming_interviews=[_interview_to_response(i, db) for i in upcoming],
        recent_activity=recent,
    )
    return success_response(data=data.model_dump(), message="Recruiter dashboard retrieved")
