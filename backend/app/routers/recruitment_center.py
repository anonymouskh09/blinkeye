import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.response import paginate, success_response
from app.models.activity_log import ActivityLog
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.client_activity import ClientActivity
from app.models.client_contact import ClientContact
from app.models.client_guest import ClientGuest
from app.models.enums import EntityType, JobStatus, PipelineStage, UserRole
from app.models.job import Job
from app.models.note import Note
from app.models.user import User
router = APIRouter(prefix="/recruitment", tags=["recruitment"])


def _parse_skills(text: str | None) -> set[str]:
    if not text:
        return set()
    parts = re.split(r"[,;|\n]+", text.lower())
    return {p.strip() for p in parts if p.strip()}


def _skill_match_score(job_skills: set[str], candidate_skills: set[str]) -> int:
    if not job_skills or not candidate_skills:
        return 0
    overlap = job_skills & candidate_skills
    return round(len(overlap) / len(job_skills) * 100)


@router.get("/matches")
def list_matches(
    min_score: int = Query(30, ge=0, le=100),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs_query = db.query(Job).options(joinedload(Job.client)).filter(Job.status == JobStatus.ACTIVE)
    if current_user.role != UserRole.ADMIN:
        jobs_query = jobs_query.filter(Job.assigned_recruiter_id == current_user.id)
    jobs = jobs_query.all()

    candidates = db.query(Candidate).all()
    assigned_pairs = {
        (a.candidate_id, a.job_id)
        for a in db.query(CandidateJobAssignment.candidate_id, CandidateJobAssignment.job_id).all()
    }

    matches = []
    for job in jobs:
        job_skills = _parse_skills(job.required_skills)
        if not job_skills:
            continue
        for candidate in candidates:
            if (candidate.id, job.id) in assigned_pairs:
                continue
            cand_skills = {s.lower().strip() for s in (candidate.skills or []) if s}
            score = _skill_match_score(job_skills, cand_skills)
            if score >= min_score:
                matches.append({
                    "candidate_id": candidate.id,
                    "candidate_name": candidate.name,
                    "candidate_title": candidate.current_job_title,
                    "job_id": job.id,
                    "job_title": job.title,
                    "client_name": job.client.company_name if job.client else None,
                    "match_score": score,
                    "matched_skills": sorted(job_skills & cand_skills),
                })

    matches.sort(key=lambda m: m["match_score"], reverse=True)
    return success_response(data={"items": matches[:limit]}, message="Matches retrieved")


@router.get("/placements")
def list_placements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(CandidateJobAssignment)
        .options(
            joinedload(CandidateJobAssignment.candidate),
            joinedload(CandidateJobAssignment.job).joinedload(Job.client),
        )
        .filter(CandidateJobAssignment.status == PipelineStage.HIRED)
    )
    if current_user.role != UserRole.ADMIN:
        query = query.join(Job).filter(Job.assigned_recruiter_id == current_user.id)

    total = query.count()
    assignments = (
        query.order_by(CandidateJobAssignment.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for a in assignments:
        recruiter = db.query(User).filter(User.id == a.assigned_recruiter_id).first()
        items.append({
            "assignment_id": a.id,
            "candidate_id": a.candidate.id,
            "candidate_name": a.candidate.name,
            "job_id": a.job.id,
            "job_title": a.job.title,
            "client_name": a.job.client.company_name if a.job.client else None,
            "recruiter_name": recruiter.name if recruiter else None,
            "placed_at": a.updated_at.isoformat() if a.updated_at else None,
        })

    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Placements retrieved",
    )


@router.get("/contacts-guests")
def list_contacts_guests(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ADMIN:
        return success_response(data={"contacts": [], "guests": []}, message="Contacts retrieved")

    clients = {c.id: c.company_name for c in db.query(Client).all()}

    contacts_query = db.query(ClientContact)
    guests_query = db.query(ClientGuest)
    if search:
        term = f"%{search}%"
        contacts_query = contacts_query.filter(
            ClientContact.name.ilike(term) | ClientContact.email.ilike(term)
        )
        guests_query = guests_query.filter(
            ClientGuest.name.ilike(term) | ClientGuest.email.ilike(term)
        )

    contacts = [
        {
            "id": c.id,
            "client_id": c.client_id,
            "client_name": clients.get(c.client_id),
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "title": c.title,
        }
        for c in contacts_query.order_by(ClientContact.name).all()
    ]
    guests = [
        {
            "id": g.id,
            "client_id": g.client_id,
            "client_name": clients.get(g.client_id),
            "name": g.name,
            "email": g.email,
        }
        for g in guests_query.order_by(ClientGuest.name).all()
    ]
    return success_response(data={"contacts": contacts, "guests": guests}, message="Contacts retrieved")


@router.get("/activities")
def list_activities(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = []

    logs = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    for log in logs:
        creator = db.query(User).filter(User.id == log.created_by).first()
        items.append({
            "id": f"log-{log.id}",
            "type": "system",
            "title": log.action.replace("_", " ").title(),
            "description": log.description,
            "entity_type": log.entity_type.value,
            "entity_id": log.entity_id,
            "date": log.created_at.date().isoformat() if log.created_at else None,
            "created_by_name": creator.name if creator else None,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    client_activities = (
        db.query(ClientActivity)
        .options(joinedload(ClientActivity.client))
        .order_by(ClientActivity.activity_date.desc(), ClientActivity.created_at.desc())
        .limit(limit)
        .all()
    )
    for act in client_activities:
        if current_user.role != UserRole.ADMIN:
            continue
        assignee = db.query(User).filter(User.id == act.assigned_to_id).first() if act.assigned_to_id else None
        items.append({
            "id": f"client-{act.id}",
            "type": "client_activity",
            "title": act.title,
            "description": act.description or act.activity_type,
            "entity_type": "client",
            "entity_id": act.client_id,
            "client_name": act.client.company_name if act.client else None,
            "date": act.activity_date.isoformat() if act.activity_date else None,
            "assigned_to_name": assignee.name if assignee else None,
            "created_at": act.created_at.isoformat() if act.created_at else None,
        })

    items.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return success_response(data={"items": items[:limit]}, message="Activities retrieved")


@router.get("/inbox")
def list_inbox(
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Note).filter(Note.is_private == False)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Note.created_by == current_user.id)

    notes = query.order_by(Note.updated_at.desc()).limit(limit).all()
    items = []
    for note in notes:
        creator = db.query(User).filter(User.id == note.created_by).first()
        entity_label = f"{note.entity_type.value} #{note.entity_id}"
        if note.entity_type == EntityType.CLIENT:
            client = db.query(Client).filter(Client.id == note.entity_id).first()
            entity_label = client.company_name if client else entity_label
        elif note.entity_type == EntityType.CANDIDATE:
            cand = db.query(Candidate).filter(Candidate.id == note.entity_id).first()
            entity_label = cand.name if cand else entity_label
        elif note.entity_type == EntityType.JOB:
            job = db.query(Job).filter(Job.id == note.entity_id).first()
            entity_label = job.title if job else entity_label

        items.append({
            "id": note.id,
            "content": note.content,
            "entity_type": note.entity_type.value,
            "entity_id": note.entity_id,
            "entity_label": entity_label,
            "shared_with_guest": note.shared_with_guest,
            "created_by_name": creator.name if creator else None,
            "created_at": note.created_at.isoformat() if note.created_at else None,
            "updated_at": note.updated_at.isoformat() if note.updated_at else None,
        })

    return success_response(data={"items": items}, message="Inbox retrieved")
