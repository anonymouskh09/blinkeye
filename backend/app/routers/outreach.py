from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.enums import UserRole
from app.models.outreach import OutreachEmailLog, OutreachEnrollment, OutreachSequence, OutreachSequenceStep
from app.models.user import User
from app.schemas.outreach import (
    EnrollCandidateRequest,
    PreviewEmailRequest,
    SequenceCreate,
    SequenceUpdate,
    StepCreate,
    StepUpdate,
)
from app.services.gmail_service import get_user_gmail_account
from app.services.outreach_service import (
    activate_sequence,
    can_access_sequence,
    enroll_candidate,
    get_or_create_candidate_inbox,
    get_sequence_or_404,
    pause_sequence,
    preview_email,
    sequence_to_detail,
    sequence_to_list_item,
)

router = APIRouter(prefix="/outreach", tags=["outreach"])


def _sequences_query(db: Session, user: User):
    query = db.query(OutreachSequence)
    if user.role != UserRole.ADMIN:
        query = query.filter(OutreachSequence.created_by_user_id == user.id)
    return query


@router.get("/sequences")
def list_sequences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequences = _sequences_query(db, current_user).order_by(OutreachSequence.created_at.desc()).all()
    items = [sequence_to_list_item(db, s) for s in sequences]
    return success_response(data={"items": items}, message="Sequences retrieved")


@router.post("/sequences")
def create_sequence(
    payload: SequenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = get_user_gmail_account(db, current_user.id)
    sequence = OutreachSequence(
        name=payload.name,
        description=payload.description,
        created_by_user_id=current_user.id,
        sender_account_id=account.id if account and account.status == "connected" else None,
        status="draft",
    )
    db.add(sequence)
    db.commit()
    db.refresh(sequence)
    return success_response(data=sequence_to_detail(db, sequence), message="Sequence created")


@router.get("/sequences/{sequence_id}")
def get_sequence(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    return success_response(data=sequence_to_detail(db, sequence), message="Sequence retrieved")


@router.put("/sequences/{sequence_id}")
def update_sequence(
    sequence_id: int,
    payload: SequenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(sequence, key, value)
    db.commit()
    db.refresh(sequence)
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Sequence updated")


@router.delete("/sequences/{sequence_id}")
def delete_sequence(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    db.delete(sequence)
    db.commit()
    return success_response(message="Sequence deleted")


@router.post("/sequences/{sequence_id}/activate")
def activate_sequence_endpoint(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    activate_sequence(db, sequence, current_user)
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Sequence activated")


@router.post("/sequences/{sequence_id}/pause")
def pause_sequence_endpoint(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    pause_sequence(db, sequence)
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Sequence paused")


@router.post("/sequences/{sequence_id}/steps")
def add_step(
    sequence_id: int,
    payload: StepCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    max_step = max((s.step_number for s in sequence.steps), default=0)
    step = OutreachSequenceStep(
        sequence_id=sequence.id,
        step_number=max_step + 1,
        step_name=payload.step_name,
        subject=payload.subject,
        body=payload.body,
        delay_days=payload.delay_days,
    )
    db.add(step)
    db.commit()
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Step added")


@router.put("/sequences/{sequence_id}/steps/{step_id}")
def update_step(
    sequence_id: int,
    step_id: int,
    payload: StepUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_sequence_or_404(db, sequence_id, current_user)
    step = db.query(OutreachSequenceStep).filter(
        OutreachSequenceStep.id == step_id,
        OutreachSequenceStep.sequence_id == sequence_id,
    ).first()
    if not step:
        raise NotFoundException("Step not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(step, key, value)
    db.commit()
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Step updated")


@router.delete("/sequences/{sequence_id}/steps/{step_id}")
def delete_step(
    sequence_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    step = db.query(OutreachSequenceStep).filter(
        OutreachSequenceStep.id == step_id,
        OutreachSequenceStep.sequence_id == sequence_id,
    ).first()
    if not step:
        raise NotFoundException("Step not found")
    removed_number = step.step_number
    db.delete(step)
    db.flush()
    for remaining in sequence.steps:
        if remaining.step_number > removed_number:
            remaining.step_number -= 1
    db.commit()
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Step deleted")


@router.post("/sequences/{sequence_id}/enrollments")
def add_enrollment(
    sequence_id: int,
    payload: EnrollCandidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    enroll_candidate(db, sequence, payload.candidate_id, current_user)
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Candidate enrolled")


@router.delete("/sequences/{sequence_id}/enrollments/{enrollment_id}")
def remove_enrollment(
    sequence_id: int,
    enrollment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_sequence_or_404(db, sequence_id, current_user)
    enrollment = db.query(OutreachEnrollment).filter(
        OutreachEnrollment.id == enrollment_id,
        OutreachEnrollment.sequence_id == sequence_id,
    ).first()
    if not enrollment:
        raise NotFoundException("Enrollment not found")
    db.delete(enrollment)
    db.commit()
    return success_response(data=sequence_to_detail(db, get_sequence_or_404(db, sequence_id, current_user)), message="Candidate removed")


@router.get("/sequences/{sequence_id}/logs")
def get_sequence_logs(
    sequence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_sequence_or_404(db, sequence_id, current_user)
    logs = (
        db.query(OutreachEmailLog)
        .filter(OutreachEmailLog.sequence_id == sequence_id)
        .order_by(OutreachEmailLog.created_at.desc())
        .all()
    )
    items = [
        {
            "id": log.id,
            "candidate_id": log.candidate_id,
            "sender_email": log.sender_email,
            "recipient_email": log.recipient_email,
            "rendered_subject": log.rendered_subject,
            "status": log.status,
            "error_message": log.error_message,
            "sent_at": log.sent_at,
            "created_at": log.created_at,
            "step_id": log.step_id,
        }
        for log in logs
    ]
    return success_response(data={"items": items}, message="Logs retrieved")


@router.post("/sequences/{sequence_id}/preview")
async def preview_sequence_email(
    sequence_id: int,
    payload: PreviewEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_sequence_or_404(db, sequence_id, current_user)
    data = preview_email(db, sequence, payload.candidate_id, payload.step_number, current_user)
    return success_response(data=data, message="Preview generated")


@router.get("/candidates/{candidate_id}/enrollments")
def list_candidate_enrollments(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.candidate import Candidate

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")

    enrollments = (
        db.query(OutreachEnrollment)
        .options(joinedload(OutreachEnrollment.sequence).joinedload(OutreachSequence.steps))
        .filter(OutreachEnrollment.candidate_id == candidate_id)
        .order_by(OutreachEnrollment.created_at.desc())
        .all()
    )
    items = []
    for en in enrollments:
        sequence = en.sequence
        if not sequence or not can_access_sequence(current_user, sequence):
            continue
        steps = sequence.steps or []
        total_steps = len(steps)
        current_step = next((s for s in steps if s.step_number == en.current_step), None)
        items.append({
            "id": en.id,
            "sequence_id": sequence.id,
            "sequence_name": sequence.name,
            "sequence_status": sequence.status,
            "enrollment_status": en.status,
            "current_step": en.current_step,
            "total_steps": total_steps,
            "current_step_name": current_step.step_name if current_step else None,
            "next_send_at": en.next_send_at.isoformat() if en.next_send_at else None,
            "progress_percent": round((en.current_step / total_steps) * 100) if total_steps else 0,
        })
    return success_response(data={"items": items}, message="Enrollments retrieved")


@router.get("/candidates/{candidate_id}/inbox")
def get_candidate_inbox(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sequence = get_or_create_candidate_inbox(db, candidate_id, current_user)
    return success_response(data=sequence_to_detail(db, sequence), message="Candidate inbox loaded")


@router.get("/candidates")
def list_candidates_for_outreach(
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.candidate import Candidate
    from app.core.response import paginate

    query = db.query(Candidate)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(Candidate.created_by == current_user.id)
    if search:
        query = query.filter(Candidate.name.ilike(f"%{search}%"))
    total = query.count()
    candidates = query.order_by(Candidate.name.asc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "current_job_title": c.current_job_title,
            "current_company": c.current_company,
            "location": c.location,
        }
        for c in candidates
    ]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Candidates retrieved",
    )
