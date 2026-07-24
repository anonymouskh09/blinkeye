import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.candidate import Candidate
from app.models.candidate_activity import CandidateActivity
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.enums import ActivityAction, EntityType, PipelineStage, UserRole
from app.models.job import Job
from app.models.user import User
from app.schemas.scheduled_activity import ScheduledActivityCreate, ScheduledActivityUpdate
from app.schemas.candidate import (
    AssignJobRequest,
    CandidateJobAssignmentResponse,
    CandidateProfilePatch,
    CandidateResponse,
    CandidateUpdate,
)
from app.services.activity_service import log_activity
from app.services.file_service import get_cv_full_path, save_cv_file
from app.services.permission_service import get_job_or_404, require_job_access
from app.services.scheduled_activity_service import scheduled_activity_response
from app.services.resume_parser_service import merge_social_links, parse_resume_file

router = APIRouter(prefix="/candidates", tags=["candidates"])


def _candidate_to_response(candidate: Candidate, db: Session) -> dict:
    creator = db.query(User).filter(User.id == candidate.created_by).first()
    jobs_count = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.candidate_id == candidate.id
    ).count()
    assigned_job_title = None
    assigned_job_client = None
    if candidate.assigned_job_id:
        job = db.query(Job).filter(Job.id == candidate.assigned_job_id).first()
        if job:
            assigned_job_title = job.title
            client = db.query(Client).filter(Client.id == job.client_id).first()
            assigned_job_client = client.company_name if client else None
    return CandidateResponse(
        id=candidate.id,
        name=candidate.name,
        email=candidate.email,
        phone=candidate.phone,
        location=candidate.location,
        current_job_title=candidate.current_job_title,
        current_company=candidate.current_company,
        experience_years=candidate.experience_years,
        skills=candidate.skills,
        expected_salary=candidate.expected_salary,
        notice_period=candidate.notice_period,
        linkedin_url=candidate.linkedin_url,
        cv_file_path=candidate.cv_file_path,
        notes=candidate.notes,
        headline=candidate.headline,
        summary=candidate.summary,
        profile_image_url=candidate.profile_image_url,
        source=candidate.source,
        imported_via=candidate.imported_via,
        created_by=candidate.created_by,
        created_by_name=creator.name if creator else None,
        jobs_applied_count=jobs_count,
        profile_extras=candidate.profile_extras or {},
        experiences=candidate.experiences or [],
        educations=candidate.educations or [],
        skill_levels=candidate.skill_levels or [],
        candidate_status=candidate.candidate_status or "new",
        candidate_rating=candidate.candidate_rating,
        assigned_job_id=candidate.assigned_job_id,
        assigned_job_title=assigned_job_title,
        assigned_job_client=assigned_job_client,
        salary_min=candidate.salary_min,
        salary_max=candidate.salary_max,
        salary_currency=candidate.salary_currency,
        timezone=candidate.timezone,
        created_at=candidate.created_at,
        updated_at=candidate.updated_at,
    ).model_dump()


def _apply_parsed_data(candidate: Candidate, parsed: dict, overwrite_empty: bool = True) -> None:
    def set_if(key: str, attr: str):
        val = parsed.get(key)
        if val is None:
            return
        current = getattr(candidate, attr)
        if overwrite_empty or not current:
            setattr(candidate, attr, val)

    set_if("name", "name")
    set_if("email", "email")
    set_if("phone", "phone")
    set_if("location", "location")
    set_if("current_job_title", "current_job_title")
    set_if("current_company", "current_company")
    set_if("experience_years", "experience_years")
    set_if("linkedin_url", "linkedin_url")

    if parsed.get("skills") and (overwrite_empty or not candidate.skills):
        candidate.skills = parsed["skills"]
    if parsed.get("skill_levels") and (overwrite_empty or not candidate.skill_levels):
        candidate.skill_levels = parsed["skill_levels"]
    if parsed.get("experiences") and (overwrite_empty or not candidate.experiences):
        candidate.experiences = parsed["experiences"]
    if parsed.get("educations") and (overwrite_empty or not candidate.educations):
        candidate.educations = parsed["educations"]

    extras = dict(candidate.profile_extras or {})
    parsed_extras = parsed.get("profile_extras") or {}
    for k, v in parsed_extras.items():
        if v and (overwrite_empty or not extras.get(k)):
            extras[k] = v
    if parsed.get("first_name"):
        extras.setdefault("first_name", parsed["first_name"])
    if parsed.get("last_name"):
        extras.setdefault("last_name", parsed["last_name"])
    if parsed.get("social_links"):
        existing_links = extras.get("social_links") or []
        extras["social_links"] = merge_social_links(existing_links, parsed["social_links"], overwrite_empty)
    extras["resume_added_at"] = extras.get("resume_added_at") or datetime.utcnow().isoformat()
    candidate.profile_extras = extras


def _assignment_to_response(assignment: CandidateJobAssignment, db: Session) -> dict:
    job = db.query(Job).filter(Job.id == assignment.job_id).first()
    client = db.query(Client).filter(Client.id == job.client_id).first() if job else None
    recruiter = db.query(User).filter(User.id == assignment.assigned_recruiter_id).first()
    return CandidateJobAssignmentResponse(
        id=assignment.id,
        candidate_id=assignment.candidate_id,
        job_id=assignment.job_id,
        job_title=job.title if job else None,
        client_name=client.company_name if client else None,
        status=assignment.status,
        assigned_recruiter_id=assignment.assigned_recruiter_id,
        assigned_recruiter_name=recruiter.name if recruiter else None,
        notes=assignment.notes,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    ).model_dump()


def _get_candidate_or_404(db: Session, candidate_id: int, current_user: User) -> Candidate:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")
    return candidate


def _list_candidate_activities(db: Session, candidate_id: int) -> list[dict]:
    activities = (
        db.query(CandidateActivity)
        .filter(CandidateActivity.candidate_id == candidate_id)
        .order_by(CandidateActivity.activity_date.desc(), CandidateActivity.created_at.desc())
        .all()
    )
    return [scheduled_activity_response(a, db) for a in activities]


@router.get("")
def list_candidates(
    search: str | None = None,
    skill: str | None = None,
    location: str | None = None,
    created_by: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Candidate)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Candidate.created_by == current_user.id)
    elif created_by:
        query = query.filter(Candidate.created_by == created_by)

    if date_from:
        query = query.filter(func.date(Candidate.created_at) >= date_from)
    if date_to:
        query = query.filter(func.date(Candidate.created_at) <= date_to)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(Candidate.name.ilike(term), Candidate.email.ilike(term), Candidate.current_job_title.ilike(term))
        )
    if location:
        query = query.filter(Candidate.location.ilike(f"%{location}%"))
    if skill:
        query = query.filter(Candidate.skills.any(skill))

    total = query.count()
    candidates = query.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_candidate_to_response(c, db) for c in candidates]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Candidates retrieved",
    )


@router.post("/parse-resume")
async def parse_resume(
    cv_file: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
):
    parsed = await parse_resume_file(cv_file)
    return success_response(data=parsed, message="Resume parsed")


@router.patch("/{candidate_id}/profile")
def patch_candidate_profile(
    candidate_id: int,
    payload: CandidateProfilePatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")

    data = payload.model_dump(exclude_unset=True)

    if "profile_extras" in data and data["profile_extras"] is not None:
        merged = dict(candidate.profile_extras or {})
        merged.update(data["profile_extras"])
        data["profile_extras"] = merged

    if "assigned_job_id" in data:
        assigned_job_id = data.pop("assigned_job_id")
        if assigned_job_id:
            job = get_job_or_404(db, assigned_job_id)
            require_job_access(current_user, job)
            existing = db.query(CandidateJobAssignment).filter(
                CandidateJobAssignment.candidate_id == candidate_id,
                CandidateJobAssignment.job_id == assigned_job_id,
            ).first()
            if not existing:
                assignment = CandidateJobAssignment(
                    candidate_id=candidate_id,
                    job_id=assigned_job_id,
                    status=PipelineStage.APPLIED,
                    assigned_recruiter_id=job.assigned_recruiter_id or current_user.id,
                )
                db.add(assignment)
                log_activity(
                    db, EntityType.CANDIDATE, candidate.id, ActivityAction.ASSIGNED,
                    f"Candidate '{candidate.name}' assigned to job '{job.title}'", current_user.id,
                )
            candidate.assigned_job_id = assigned_job_id
        else:
            candidate.assigned_job_id = None

    if "candidate_status" in data and data["candidate_status"] is not None:
        status_val = data["candidate_status"]
        data["candidate_status"] = status_val.value if hasattr(status_val, "value") else status_val

    for key, value in data.items():
        setattr(candidate, key, value)

    log_activity(
        db, EntityType.CANDIDATE, candidate.id, ActivityAction.UPDATED,
        f"Candidate '{candidate.name}' profile was updated", current_user.id,
    )
    db.commit()
    db.refresh(candidate)
    return success_response(data=_candidate_to_response(candidate, db), message="Profile updated")


@router.post("")
async def create_candidate(
    name: str = Form(...),
    email: str = Form(...),
    phone: str | None = Form(None),
    location: str | None = Form(None),
    current_job_title: str | None = Form(None),
    current_company: str | None = Form(None),
    experience_years: int | None = Form(None),
    skills: str | None = Form(None),
    expected_salary: int | None = Form(None),
    notice_period: str | None = Form(None),
    linkedin_url: str | None = Form(None),
    notes: str | None = Form(None),
    cv_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    skills_list = None
    if skills:
        try:
            skills_list = json.loads(skills) if skills.startswith("[") else [s.strip() for s in skills.split(",") if s.strip()]
        except json.JSONDecodeError:
            skills_list = [s.strip() for s in skills.split(",") if s.strip()]

    candidate = Candidate(
        name=name,
        email=email,
        phone=phone,
        location=location,
        current_job_title=current_job_title,
        current_company=current_company,
        experience_years=experience_years,
        skills=skills_list,
        expected_salary=expected_salary,
        notice_period=notice_period,
        linkedin_url=linkedin_url,
        notes=notes,
        created_by=current_user.id,
    )
    db.add(candidate)
    db.flush()

    if cv_file and cv_file.filename:
        try:
            parsed = await parse_resume_file(cv_file)
            _apply_parsed_data(candidate, parsed, overwrite_empty=True)
        except BadRequestException:
            pass
        await cv_file.seek(0)
        cv_path = await save_cv_file(cv_file, candidate.id)
        candidate.cv_file_path = cv_path
        log_activity(
            db, EntityType.CANDIDATE, candidate.id, ActivityAction.CV_UPLOADED,
            f"CV uploaded for candidate '{candidate.name}'", current_user.id,
        )

    log_activity(
        db, EntityType.CANDIDATE, candidate.id, ActivityAction.CREATED,
        f"Candidate '{candidate.name}' was created", current_user.id,
    )
    db.commit()
    db.refresh(candidate)
    return success_response(data=_candidate_to_response(candidate, db), message="Candidate created")


@router.get("/{candidate_id}")
def get_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = _get_candidate_or_404(db, candidate_id, current_user)

    assignments = (
        db.query(CandidateJobAssignment)
        .options(joinedload(CandidateJobAssignment.job))
        .filter(CandidateJobAssignment.candidate_id == candidate_id)
        .all()
    )
    data = _candidate_to_response(candidate, db)
    data["assignments"] = [_assignment_to_response(a, db) for a in assignments]
    data["activities"] = _list_candidate_activities(db, candidate_id)
    return success_response(data=data, message="Candidate retrieved")


@router.put("/{candidate_id}")
async def update_candidate(
    candidate_id: int,
    name: str | None = Form(None),
    email: str | None = Form(None),
    phone: str | None = Form(None),
    location: str | None = Form(None),
    current_job_title: str | None = Form(None),
    current_company: str | None = Form(None),
    experience_years: int | None = Form(None),
    skills: str | None = Form(None),
    expected_salary: int | None = Form(None),
    notice_period: str | None = Form(None),
    linkedin_url: str | None = Form(None),
    notes: str | None = Form(None),
    cv_file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")

    field_map = {
        "name": name, "email": email, "phone": phone, "location": location,
        "current_job_title": current_job_title, "current_company": current_company,
        "experience_years": experience_years, "expected_salary": expected_salary,
        "notice_period": notice_period, "linkedin_url": linkedin_url, "notes": notes,
    }
    for key, value in field_map.items():
        if value is not None:
            setattr(candidate, key, value)

    if skills is not None:
        if skills.startswith("["):
            candidate.skills = json.loads(skills)
        else:
            candidate.skills = [s.strip() for s in skills.split(",") if s.strip()]

    if cv_file and cv_file.filename:
        try:
            parsed = await parse_resume_file(cv_file)
            _apply_parsed_data(candidate, parsed, overwrite_empty=True)
        except BadRequestException:
            pass
        await cv_file.seek(0)
        cv_path = await save_cv_file(cv_file, candidate.id)
        candidate.cv_file_path = cv_path
        log_activity(
            db, EntityType.CANDIDATE, candidate.id, ActivityAction.CV_UPLOADED,
            f"CV updated for candidate '{candidate.name}'", current_user.id,
        )

    log_activity(
        db, EntityType.CANDIDATE, candidate.id, ActivityAction.UPDATED,
        f"Candidate '{candidate.name}' was updated", current_user.id,
    )
    db.commit()
    db.refresh(candidate)
    return success_response(data=_candidate_to_response(candidate, db), message="Candidate updated")


@router.delete("/{candidate_id}")
def delete_candidate(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")

    log_activity(
        db, EntityType.CANDIDATE, candidate.id, ActivityAction.DELETED,
        f"Candidate '{candidate.name}' was deleted", current_user.id,
    )
    db.delete(candidate)
    db.commit()
    return success_response(message="Candidate deleted")


@router.post("/{candidate_id}/assign-job")
def assign_job(
    candidate_id: int,
    payload: AssignJobRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")

    job = get_job_or_404(db, payload.job_id)
    require_job_access(current_user, job)

    existing = db.query(CandidateJobAssignment).filter(
        CandidateJobAssignment.candidate_id == candidate_id,
        CandidateJobAssignment.job_id == payload.job_id,
    ).first()
    if existing:
        raise BadRequestException("Candidate already assigned to this job")

    recruiter_id = job.assigned_recruiter_id or current_user.id
    assignment = CandidateJobAssignment(
        candidate_id=candidate_id,
        job_id=payload.job_id,
        status=PipelineStage.APPLIED,
        assigned_recruiter_id=recruiter_id,
        notes=payload.notes,
    )
    db.add(assignment)
    db.flush()
    log_activity(
        db, EntityType.CANDIDATE, candidate.id, ActivityAction.ASSIGNED,
        f"Candidate '{candidate.name}' assigned to job '{job.title}'", current_user.id,
    )
    db.commit()
    db.refresh(assignment)
    return success_response(data=_assignment_to_response(assignment, db), message="Candidate assigned to job")


@router.get("/{candidate_id}/cv")
def download_cv(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")
    if not candidate.cv_file_path:
        raise NotFoundException("No CV file found")

    full_path = get_cv_full_path(candidate.cv_file_path)
    if not full_path.exists():
        raise NotFoundException("CV file not found on server")

    ext = full_path.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    disposition = "inline" if ext == ".pdf" else "attachment"

    return FileResponse(
        path=str(full_path),
        filename=full_path.name,
        media_type=media_type,
        headers={"Content-Disposition": f'{disposition}; filename="{full_path.name}"'},
    )


@router.post("/{candidate_id}/activities")
def create_candidate_activity(
    candidate_id: int,
    payload: ScheduledActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_candidate_or_404(db, candidate_id, current_user)
    activity = CandidateActivity(
        candidate_id=candidate_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(activity)
    log_activity(
        db, EntityType.CANDIDATE, candidate_id, ActivityAction.UPDATED,
        f"Activity '{payload.title}' was created", current_user.id,
    )
    db.commit()
    db.refresh(activity)
    return success_response(
        data=scheduled_activity_response(activity, db),
        message="Activity created",
    )


@router.put("/{candidate_id}/activities/{activity_id}")
def update_candidate_activity(
    candidate_id: int,
    activity_id: int,
    payload: ScheduledActivityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_candidate_or_404(db, candidate_id, current_user)
    activity = db.query(CandidateActivity).filter(
        CandidateActivity.id == activity_id,
        CandidateActivity.candidate_id == candidate_id,
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    log_activity(
        db, EntityType.CANDIDATE, candidate_id, ActivityAction.UPDATED,
        f"Activity '{activity.title}' was updated", current_user.id,
    )
    db.commit()
    db.refresh(activity)
    return success_response(
        data=scheduled_activity_response(activity, db),
        message="Activity updated",
    )


@router.delete("/{candidate_id}/activities/{activity_id}")
def delete_candidate_activity(
    candidate_id: int,
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_candidate_or_404(db, candidate_id, current_user)
    activity = db.query(CandidateActivity).filter(
        CandidateActivity.id == activity_id,
        CandidateActivity.candidate_id == candidate_id,
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    title = activity.title
    db.delete(activity)
    log_activity(
        db, EntityType.CANDIDATE, candidate_id, ActivityAction.UPDATED,
        f"Activity '{title}' was deleted", current_user.id,
    )
    db.commit()
    return success_response(message="Activity deleted")
