from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_extension_user
from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.core.response import success_response
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import (
    PIPELINE_STAGES_ORDER,
    ActivityAction,
    EntityType,
    JobStatus,
    PipelineStage,
    UserRole,
    UserStatus,
)
from app.models.job import Job
from app.models.user import User
from app.schemas.extension import (
    ExchangeRequest,
    ImportCandidateRequest,
    LogoutRequest,
    RefreshRequest,
    UpdateMissingFieldsRequest,
)
from app.services import candidate_import_service as importer
from app.services import extension_auth_service as auth_service
from app.services.activity_service import log_activity
from app.services.file_service import save_cv_file
from app.services.resume_parser_service import parse_resume_file

router = APIRouter(prefix="/api/v1/extension", tags=["extension"])

_ALLOWED_IMPORTED_VIA = {
    "chrome_extension",
    "chrome_extension_cv",
    "linkedin_profile_pdf",
}


def _user_public(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
    }


# ---- Auth -----------------------------------------------------------------


@router.post("/auth/exchange")
def exchange_code(payload: ExchangeRequest, db: Session = Depends(get_db)):
    user = auth_service.consume_auth_code(db, payload.code)
    if not user or user.status != UserStatus.ACTIVE:
        raise BadRequestException("Invalid or expired code")
    tokens = auth_service.issue_tokens(db, user)
    db.commit()
    return success_response(
        data={**tokens, "user": _user_public(user)},
        message="Connected",
    )


@router.post("/auth/refresh")
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    result = auth_service.rotate_refresh(db, payload.refresh_token)
    db.commit()
    return success_response(
        data={**result["tokens"], "user": _user_public(result["user"])},
        message="Refreshed",
    )


@router.post("/auth/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    auth_service.revoke_refresh(db, payload.refresh_token)
    db.commit()
    return success_response(message="Disconnected")


@router.get("/auth/me")
def me(current_user: User = Depends(get_extension_user)):
    return success_response(data=_user_public(current_user), message="OK")


# ---- Dropdowns ------------------------------------------------------------


@router.get("/jobs")
def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
):
    query = db.query(Job).filter(Job.status != JobStatus.CLOSED)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Job.assigned_recruiter_id == current_user.id)
    jobs = query.order_by(Job.created_at.desc()).limit(200).all()
    client_ids = {j.client_id for j in jobs if j.client_id}
    client_map = {}
    if client_ids:
        client_map = {
            c.id: c.company_name
            for c in db.query(Client).filter(Client.id.in_(client_ids)).all()
        }
    data = [
        {"id": j.id, "title": j.title, "clientName": client_map.get(j.client_id)}
        for j in jobs
    ]
    return success_response(data=data, message="Jobs retrieved")


@router.get("/team")
def list_team(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
):
    # Recruiters can only assign candidates to themselves; admins and managers
    # can assign to any active team member.
    if current_user.role == UserRole.RECRUITER:
        members = [current_user]
    else:
        members = (
            db.query(User)
            .filter(User.status == UserStatus.ACTIVE)
            .order_by(User.name.asc())
            .all()
        )
    data = [
        {"id": m.id, "name": m.name, "role": m.role.value if hasattr(m.role, "value") else m.role}
        for m in members
    ]
    return success_response(data=data, message="Team retrieved")


@router.get("/stages")
def list_stages(_current_user: User = Depends(get_extension_user)):
    data = [
        {"id": stage.value, "name": stage.value.replace("_", " ").title(), "order": idx}
        for idx, stage in enumerate(PIPELINE_STAGES_ORDER)
    ]
    return success_response(data=data, message="Stages retrieved")


@router.get("/tags")
def list_tags(_current_user: User = Depends(get_extension_user)):
    # Candidate tags are not a first-class field in this app yet; return an empty
    # (but well-formed) list so the popup renders without a tag picker.
    return success_response(data=[], message="Tags retrieved")


# ---- Candidates -----------------------------------------------------------


@router.get("/candidates/check-duplicate")
def check_duplicate(
    linkedin_url: str | None = Query(default=None),
    email: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_extension_user),
):
    normalized = importer.normalize_linkedin_url(linkedin_url)
    cleaned_email = importer.clean_text(email)
    existing = importer.find_duplicate(db, normalized, cleaned_email)
    return success_response(
        data={
            "duplicate": existing is not None,
            "existing": importer.duplicate_info(existing) if existing else None,
        },
        message="OK",
    )


def _resolve_owner(db: Session, current_user: User, owner_id: int | None) -> int:
    """Server-derived ownership. Recruiters always own their imports; admins and
    managers may assign ownership to another active user."""
    if owner_id is None or current_user.role == UserRole.RECRUITER:
        return current_user.id
    owner = db.query(User).filter(User.id == owner_id, User.status == UserStatus.ACTIVE).first()
    if not owner:
        raise BadRequestException("Selected owner not found")
    return owner.id


def _validate_stage(stage: str | None) -> PipelineStage:
    if not stage:
        return PipelineStage.APPLIED
    valid = {s.value: s for s in PipelineStage}
    if stage not in valid:
        raise BadRequestException("Invalid pipeline stage")
    return valid[stage]


@router.post("/candidates")
def import_candidate(
    payload: ImportCandidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
):
    full_name = importer.clean_text(payload.full_name, max_length=255)
    if not full_name:
        raise BadRequestException("Full name is required")

    normalized_url = importer.normalize_linkedin_url(payload.linkedin_url)
    email = importer.clean_text(payload.email, max_length=255)
    if email:
        email = email.lower()

    # Application-level duplicate check (the partial unique index is the
    # authoritative race-safe guard below).
    existing = importer.find_duplicate(db, normalized_url, email)
    if existing:
        raise ConflictException(
            "Candidate already exists",
            data={"existing": importer.duplicate_info(existing)},
        )

    owner_id = _resolve_owner(db, current_user, payload.owner_id)
    stage = _validate_stage(payload.stage)

    job = None
    if payload.job_id is not None:
        job = db.query(Job).filter(Job.id == payload.job_id).first()
        if not job:
            raise NotFoundException("Job not found")
        if current_user.role != UserRole.ADMIN and job.assigned_recruiter_id != current_user.id:
            raise ForbiddenException("You do not have access to this job")

    experiences = payload.experiences or []
    educations = payload.educations or []
    skills = [s for s in (payload.skills or []) if isinstance(s, str) and s.strip()]
    skill_levels = [{"name": s.strip(), "level": 3} for s in skills]
    certifications = [c for c in (payload.certifications or []) if isinstance(c, dict) and c.get("name")]
    languages = [l for l in (payload.languages or []) if isinstance(l, dict) and (l.get("language") or l.get("name"))]

    current_title = importer.clean_text(payload.current_job_title, max_length=255)
    current_company = importer.clean_text(payload.current_company, max_length=255)
    if not current_title and experiences:
        current_title = importer.clean_text(str(experiences[0].get("title") or ""), max_length=255)
    if not current_company and experiences:
        current_company = importer.clean_text(str(experiences[0].get("company") or ""), max_length=255)

    name_parts = full_name.split(None, 1)
    first_edu = educations[0] if educations else {}
    summary_text = importer.clean_multiline(payload.summary, max_length=20000)
    extras = {
        "source": "LinkedIn Extension",
        "first_name": name_parts[0] if name_parts else None,
        "last_name": name_parts[1] if len(name_parts) > 1 else None,
        "summary": summary_text,
        "university": importer.clean_text(str(first_edu.get("school") or ""), max_length=255) if first_edu else None,
        "diploma": importer.clean_text(str(first_edu.get("degree") or ""), max_length=255) if first_edu else None,
    }
    if certifications:
        extras["certifications"] = certifications
    if languages:
        extras["languages"] = languages
    extras = {k: v for k, v in extras.items() if v}

    imported_via = (payload.imported_via or "chrome_extension").strip()
    if imported_via not in _ALLOWED_IMPORTED_VIA:
        imported_via = "chrome_extension"

    # Prefer an explicit profile photo URL; reject cover/banner and data URLs.
    photo = (payload.profile_image_url or "").strip() or None
    if photo and (
        photo.startswith("data:")
        or "profile-displaybackgroundimage" in photo
        or "backgroundimage" in photo.lower()
    ):
        photo = None
    if photo and len(photo) > 1000:
        photo = photo[:1000]

    candidate = Candidate(
        name=full_name,
        email=email or "",
        phone=importer.clean_text(payload.phone, max_length=50),
        location=importer.clean_text(payload.location, max_length=255),
        headline=importer.clean_text(payload.headline, max_length=500),
        summary=summary_text,
        profile_image_url=photo,
        linkedin_url=normalized_url,
        source=(payload.source or "linkedin_extension")[:50],
        imported_via=imported_via,
        created_by=owner_id,
        assigned_job_id=job.id if job else None,
        current_job_title=current_title,
        current_company=current_company,
        skills=skills or None,
        skill_levels=skill_levels or None,
        experiences=experiences or None,
        educations=educations or None,
        profile_extras=extras,
    )
    db.add(candidate)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = importer.find_duplicate(db, normalized_url, email)
        raise ConflictException(
            "Candidate already exists",
            data={"existing": importer.duplicate_info(existing) if existing else None},
        )

    if job:
        assignment = CandidateJobAssignment(
            candidate_id=candidate.id,
            job_id=job.id,
            status=stage,
            assigned_recruiter_id=owner_id,
        )
        db.add(assignment)

    # Audit entry — metadata only, never secrets/tokens.
    description = f"Candidate '{candidate.name}' imported via Chrome extension"
    if imported_via == "chrome_extension_cv":
        description += " (with CV)"
    elif imported_via == "linkedin_profile_pdf":
        description += " (with LinkedIn Profile PDF)"
    if job:
        description += f" and assigned to job '{job.title}'"
    log_activity(
        db,
        EntityType.CANDIDATE,
        candidate.id,
        ActivityAction.CANDIDATE_IMPORTED,
        description,
        current_user.id,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = importer.find_duplicate(db, normalized_url, email)
        raise ConflictException(
            "Candidate already exists",
            data={"existing": importer.duplicate_info(existing) if existing else None},
        )
    db.refresh(candidate)

    return success_response(
        data={"id": candidate.id, "name": candidate.name, "detailUrl": f"/candidates/{candidate.id}"},
        message="Candidate imported",
    )


def _get_extension_candidate(db: Session, candidate_id: int, current_user: User) -> Candidate:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
        raise NotFoundException("Candidate not found")
    return candidate


@router.post("/resumes/parse")
async def parse_resume_for_extension(
    cv_file: UploadFile = File(...),
    _current_user: User = Depends(get_extension_user),
):
    """Thin Bearer wrapper around the existing resume parser (no DB write)."""
    parsed = await parse_resume_file(cv_file)
    return success_response(data=parsed, message="Resume parsed")


@router.post("/candidates/{candidate_id}/attach-file")
async def attach_file_to_candidate(
    candidate_id: int,
    cv_file: UploadFile = File(...),
    apply_parsed: bool = Query(default=True),
    file_kind: str | None = Query(default=None, max_length=40),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
):
    """Attach a CV / LinkedIn Profile PDF to an existing candidate and optionally fill missing fields."""
    candidate = _get_extension_candidate(db, candidate_id, current_user)

    parsed = None
    parse_error = None
    if apply_parsed:
        try:
            parsed = await parse_resume_file(cv_file)
            await cv_file.seek(0)
            updated = importer.apply_parsed_fill_missing(candidate, parsed)
            if updated:
                log_activity(
                    db,
                    EntityType.CANDIDATE,
                    candidate.id,
                    ActivityAction.UPDATED,
                    f"Missing fields updated from uploaded file for candidate '{candidate.name}': {', '.join(updated)}",
                    current_user.id,
                )
        except BadRequestException as exc:
            parse_error = exc.message
            await cv_file.seek(0)

    cv_path = await save_cv_file(cv_file, candidate.id)
    candidate.cv_file_path = cv_path

    kind = (file_kind or "").strip().lower()
    if kind == "linkedin_profile_pdf":
        candidate.imported_via = "linkedin_profile_pdf"
        label = "LinkedIn Profile PDF"
    else:
        if candidate.imported_via == "chrome_extension":
            candidate.imported_via = "chrome_extension_cv"
        label = "CV"

    extras = dict(candidate.profile_extras or {})
    extras["resume_added_at"] = extras.get("resume_added_at") or datetime.utcnow().isoformat()
    extras["extension_file_kind"] = kind or "cv"
    candidate.profile_extras = extras

    log_activity(
        db,
        EntityType.CANDIDATE,
        candidate.id,
        ActivityAction.CV_UPLOADED,
        f"{label} uploaded via Chrome extension for candidate '{candidate.name}'",
        current_user.id,
    )
    db.commit()
    db.refresh(candidate)

    return success_response(
        data={
            "id": candidate.id,
            "cvFilePath": candidate.cv_file_path,
            "parsed": parsed is not None,
            "parseError": parse_error,
            "detailUrl": f"/candidates/{candidate.id}",
        },
        message="File attached",
    )


@router.patch("/candidates/{candidate_id}/update-missing-fields")
def update_missing_fields(
    candidate_id: int,
    payload: UpdateMissingFieldsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_extension_user),
):
    candidate = _get_extension_candidate(db, candidate_id, current_user)
    data = payload.model_dump(exclude_unset=True)
    job_id = data.pop("job_id", None)
    stage_raw = data.pop("stage", None)

    updated = importer.fill_missing_fields(candidate, data)

    if job_id is not None:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            raise NotFoundException("Job not found")
        if current_user.role != UserRole.ADMIN and job.assigned_recruiter_id != current_user.id:
            raise ForbiddenException("You do not have access to this job")
        existing = (
            db.query(CandidateJobAssignment)
            .filter(
                CandidateJobAssignment.candidate_id == candidate.id,
                CandidateJobAssignment.job_id == job_id,
            )
            .first()
        )
        if not existing:
            assignment = CandidateJobAssignment(
                candidate_id=candidate.id,
                job_id=job.id,
                status=_validate_stage(stage_raw),
                assigned_recruiter_id=job.assigned_recruiter_id or current_user.id,
            )
            db.add(assignment)
            log_activity(
                db,
                EntityType.CANDIDATE,
                candidate.id,
                ActivityAction.ASSIGNED,
                f"Candidate '{candidate.name}' associated with job '{job.title}' via Chrome extension",
                current_user.id,
            )
        if not candidate.assigned_job_id:
            candidate.assigned_job_id = job.id
            updated.append("assigned_job_id")

    if updated:
        log_activity(
            db,
            EntityType.CANDIDATE,
            candidate.id,
            ActivityAction.UPDATED,
            f"Missing fields updated via Chrome extension for candidate '{candidate.name}': {', '.join(updated)}",
            current_user.id,
        )

    db.commit()
    db.refresh(candidate)
    return success_response(
        data={
            "id": candidate.id,
            "updatedFields": updated,
            "detailUrl": f"/candidates/{candidate.id}",
        },
        message="Missing fields updated",
    )
