from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import ClientStatus, JobStatus, PipelineStage, UserRole, UserStatus, PIPELINE_STAGES_ORDER
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.core.response import success_response
from app.schemas.reports import ClientReportItem, JobReportItem, PipelineReportItem, RecruiterReportItem

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/clients")
def client_report(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    clients = db.query(Client).filter(Client.status == ClientStatus.ACTIVE).all()
    items = []
    for client in clients:
        jobs = db.query(Job).filter(Job.client_id == client.id).all()
        job_ids = [j.id for j in jobs]
        total_candidates = 0
        hired = 0
        if job_ids:
            total_candidates = db.query(CandidateJobAssignment).filter(
                CandidateJobAssignment.job_id.in_(job_ids)
            ).count()
            hired = db.query(CandidateJobAssignment).filter(
                CandidateJobAssignment.job_id.in_(job_ids),
                CandidateJobAssignment.status == PipelineStage.HIRED,
            ).count()

        items.append(
            ClientReportItem(
                client_name=client.company_name,
                total_jobs=len(jobs),
                active_jobs=len([j for j in jobs if j.status == JobStatus.ACTIVE]),
                closed_jobs=len([j for j in jobs if j.status in (JobStatus.CLOSED, JobStatus.FILLED)]),
                total_candidates=total_candidates,
                hired_count=hired,
            ).model_dump()
        )
    return success_response(data={"items": items}, message="Client report retrieved")


@router.get("/jobs")
def job_report(
    date_from: date | None = None,
    date_to: date | None = None,
    recruiter_id: int | None = None,
    client_id: int | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(Job)
    if date_from:
        query = query.filter(func.date(Job.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(Job.created_at) <= date_to)
    if recruiter_id:
        query = query.filter(Job.assigned_recruiter_id == recruiter_id)
    if client_id:
        query = query.filter(Job.client_id == client_id)

    jobs = query.all()
    items = []
    for job in jobs:
        client = db.query(Client).filter(Client.id == job.client_id).first()
        recruiter = db.query(User).filter(User.id == job.assigned_recruiter_id).first() if job.assigned_recruiter_id else None
        assignments = db.query(CandidateJobAssignment).filter(CandidateJobAssignment.job_id == job.id).all()
        items.append(
            JobReportItem(
                job_title=job.title,
                client_name=client.company_name if client else "",
                recruiter_name=recruiter.name if recruiter else "Unassigned",
                total_candidates=len(assignments),
                shortlisted=len([a for a in assignments if a.status == PipelineStage.SHORTLISTED]),
                interviewed=len([a for a in assignments if a.status in (
                    PipelineStage.INTERVIEW_SCHEDULED, PipelineStage.INTERVIEW_COMPLETED
                )]),
                hired=len([a for a in assignments if a.status == PipelineStage.HIRED]),
                rejected=len([a for a in assignments if a.status == PipelineStage.REJECTED]),
            ).model_dump()
        )
    return success_response(data={"items": items}, message="Job report retrieved")


@router.get("/recruiters")
def recruiter_report(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    recruiters = db.query(User).filter(User.role == UserRole.RECRUITER).all()
    items = []
    for recruiter in recruiters:
        job_ids = [j.id for j in db.query(Job).filter(Job.assigned_recruiter_id == recruiter.id).all()]
        cj_query = db.query(CandidateJobAssignment)
        if job_ids:
            cj_query = cj_query.filter(CandidateJobAssignment.job_id.in_(job_ids))

        cj_ids = [cj.id for cj in cj_query.all()] if job_ids else []
        interviews_count = db.query(Interview).filter(Interview.candidate_job_id.in_(cj_ids)).count() if cj_ids else 0

        items.append(
            RecruiterReportItem(
                recruiter_name=recruiter.name,
                assigned_jobs=len(job_ids),
                candidates_added=db.query(Candidate).filter(Candidate.created_by == recruiter.id).count(),
                shortlisted=cj_query.filter(CandidateJobAssignment.status == PipelineStage.SHORTLISTED).count() if job_ids else 0,
                interviews_scheduled=interviews_count,
                hired=cj_query.filter(CandidateJobAssignment.status == PipelineStage.HIRED).count() if job_ids else 0,
            ).model_dump()
        )
    return success_response(data={"items": items}, message="Recruiter report retrieved")


@router.get("/pipeline")
def pipeline_report(
    job_id: int | None = None,
    client_id: int | None = None,
    recruiter_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(CandidateJobAssignment)
    if job_id:
        query = query.filter(CandidateJobAssignment.job_id == job_id)
    if recruiter_id:
        query = query.filter(CandidateJobAssignment.assigned_recruiter_id == recruiter_id)
    if client_id:
        job_ids = [j.id for j in db.query(Job).filter(Job.client_id == client_id).all()]
        query = query.filter(CandidateJobAssignment.job_id.in_(job_ids if job_ids else [-1]))
    if date_from:
        query = query.filter(func.date(CandidateJobAssignment.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(CandidateJobAssignment.created_at) <= date_to)

    items = []
    for stage in PIPELINE_STAGES_ORDER:
        count = query.filter(CandidateJobAssignment.status == stage).count()
        items.append(PipelineReportItem(stage=stage.value.replace("_", " ").title(), count=count).model_dump())

    return success_response(data={"items": items}, message="Pipeline report retrieved")
