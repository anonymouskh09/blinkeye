from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.candidate import Candidate
from app.models.enums import UserRole
from app.models.outreach import (
    OutreachEmailLog,
    OutreachEnrollment,
    OutreachSequence,
    OutreachSequenceStep,
    UserEmailAccount,
)
from app.models.user import User
from app.services.gmail_service import get_user_gmail_account, send_gmail_message
from app.services.outreach_template_service import build_template_context, find_missing_variables, render_template


def can_access_sequence(user: User, sequence: OutreachSequence) -> bool:
    return user.role == UserRole.ADMIN or sequence.created_by_user_id == user.id


def get_sequence_or_404(db: Session, sequence_id: int, user: User) -> OutreachSequence:
    sequence = (
        db.query(OutreachSequence)
        .options(
            joinedload(OutreachSequence.steps),
            joinedload(OutreachSequence.enrollments).joinedload(OutreachEnrollment.candidate),
            joinedload(OutreachSequence.sender_account),
        )
        .filter(OutreachSequence.id == sequence_id)
        .first()
    )
    if not sequence:
        raise NotFoundException("Sequence not found")
    if not can_access_sequence(user, sequence):
        raise ForbiddenException("You do not have access to this sequence")
    return sequence


def count_sent_today(db: Session, user_id: int) -> int:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(func.count(OutreachEmailLog.id))
        .filter(
            OutreachEmailLog.sender_user_id == user_id,
            OutreachEmailLog.status == "sent",
            OutreachEmailLog.sent_at >= today_start,
        )
        .scalar()
        or 0
    )


def sequence_stats(db: Session, sequence_id: int) -> dict:
    enrolled = db.query(func.count(OutreachEnrollment.id)).filter(
        OutreachEnrollment.sequence_id == sequence_id
    ).scalar() or 0
    sent = db.query(func.count(OutreachEmailLog.id)).filter(
        OutreachEmailLog.sequence_id == sequence_id,
        OutreachEmailLog.status == "sent",
    ).scalar() or 0
    failed = db.query(func.count(OutreachEmailLog.id)).filter(
        OutreachEmailLog.sequence_id == sequence_id,
        OutreachEmailLog.status == "failed",
    ).scalar() or 0
    return {"enrolled_count": enrolled, "sent_count": sent, "failed_count": failed}


def sequence_to_list_item(db: Session, sequence: OutreachSequence) -> dict:
    creator = db.query(User).filter(User.id == sequence.created_by_user_id).first()
    stats = sequence_stats(db, sequence.id)
    sender_email = sequence.sender_account.email_address if sequence.sender_account else None
    return {
        "id": sequence.id,
        "name": sequence.name,
        "description": sequence.description,
        "status": sequence.status,
        "sender_email": sender_email,
        "created_by_user_id": sequence.created_by_user_id,
        "created_by_name": creator.name if creator else None,
        "created_at": sequence.created_at,
        "updated_at": sequence.updated_at,
        **stats,
    }


def sequence_to_detail(db: Session, sequence: OutreachSequence) -> dict:
    data = sequence_to_list_item(db, sequence)
    data["steps"] = [
        {
            "id": s.id,
            "step_number": s.step_number,
            "step_name": s.step_name,
            "subject": s.subject,
            "body": s.body,
            "delay_days": s.delay_days,
        }
        for s in sorted(sequence.steps, key=lambda x: x.step_number)
    ]
    data["enrollments"] = [
        {
            "id": e.id,
            "candidate_id": e.candidate_id,
            "candidate_name": e.candidate.name if e.candidate else None,
            "candidate_email": e.candidate.email if e.candidate else None,
            "current_title": e.candidate.current_job_title if e.candidate else None,
            "company": e.candidate.current_company if e.candidate else None,
            "status": e.status,
            "current_step": e.current_step,
            "next_send_at": e.next_send_at,
        }
        for e in sequence.enrollments
    ]
    return data


def ensure_sender_account(db: Session, user: User, sequence: OutreachSequence) -> UserEmailAccount:
    account = sequence.sender_account or get_user_gmail_account(db, user.id)
    if not account or account.status != "connected":
        raise BadRequestException("Connect Gmail before activating this sequence")
    if sequence.sender_account_id != account.id:
        sequence.sender_account_id = account.id
        db.commit()
    return account


def activate_sequence(db: Session, sequence: OutreachSequence, user: User) -> None:
    if not sequence.steps:
        raise BadRequestException("Add at least one step before activating")
    ensure_sender_account(db, user, sequence)
    sequence.status = "active"
    now = datetime.now(timezone.utc)
    for enrollment in sequence.enrollments:
        if enrollment.status in ("active", "paused"):
            enrollment.status = "active"
            if not enrollment.next_send_at:
                enrollment.next_send_at = now
    db.commit()


def pause_sequence(db: Session, sequence: OutreachSequence) -> None:
    sequence.status = "paused"
    for enrollment in sequence.enrollments:
        if enrollment.status == "active":
            enrollment.status = "paused"
    db.commit()


def enroll_candidate(db: Session, sequence: OutreachSequence, candidate_id: int, user: User) -> OutreachEnrollment:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if not candidate.email or not candidate.email.strip():
        raise BadRequestException("Candidate must have an email address")

    existing = db.query(OutreachEnrollment).filter(
        OutreachEnrollment.sequence_id == sequence.id,
        OutreachEnrollment.candidate_id == candidate_id,
    ).first()
    if existing:
        raise BadRequestException("Candidate is already enrolled in this sequence")

    enrollment = OutreachEnrollment(
        sequence_id=sequence.id,
        candidate_id=candidate_id,
        enrolled_by_user_id=user.id,
        status="active" if sequence.status == "active" else "paused",
        current_step=1,
        next_send_at=datetime.now(timezone.utc) if sequence.status == "active" else None,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def preview_email(
    db: Session,
    sequence: OutreachSequence,
    candidate_id: int,
    step_number: int,
    user: User,
) -> dict:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    step = next((s for s in sequence.steps if s.step_number == step_number), None)
    if not step:
        raise NotFoundException("Step not found")

    context = build_template_context(candidate, user)
    subject = render_template(step.subject, context)
    body = render_template(step.body, context)
    warnings = find_missing_variables(step.subject + step.body, context)
    return {
        "subject": subject,
        "body": body,
        "warnings": warnings,
        "recipient_email": candidate.email,
    }


async def process_due_enrollments(db: Session) -> None:
    now = datetime.now(timezone.utc)
    due = (
        db.query(OutreachEnrollment)
        .options(
            joinedload(OutreachEnrollment.sequence).joinedload(OutreachSequence.steps),
            joinedload(OutreachEnrollment.sequence).joinedload(OutreachSequence.sender_account),
            joinedload(OutreachEnrollment.candidate),
        )
        .filter(
            OutreachEnrollment.status == "active",
            OutreachEnrollment.next_send_at.isnot(None),
            OutreachEnrollment.next_send_at <= now,
        )
        .all()
    )

    for enrollment in due:
        sequence = enrollment.sequence
        if not sequence or sequence.status != "active":
            continue

        sender_user = db.query(User).filter(User.id == sequence.created_by_user_id).first()
        if not sender_user:
            continue

        if count_sent_today(db, sender_user.id) >= settings.OUTREACH_DAILY_EMAIL_LIMIT:
            continue

        account = sequence.sender_account
        if not account or account.status != "connected":
            enrollment.status = "failed"
            db.commit()
            continue

        step = next((s for s in sequence.steps if s.step_number == enrollment.current_step), None)
        if not step:
            enrollment.status = "completed"
            enrollment.next_send_at = None
            db.commit()
            continue

        candidate = enrollment.candidate
        if not candidate or not candidate.email:
            enrollment.status = "failed"
            db.commit()
            continue

        context = build_template_context(candidate, sender_user)
        subject = render_template(step.subject, context)
        body = render_template(step.body, context)

        log = OutreachEmailLog(
            sequence_id=sequence.id,
            step_id=step.id,
            candidate_id=candidate.id,
            sender_user_id=sender_user.id,
            sender_email=account.email_address,
            recipient_email=candidate.email,
            rendered_subject=subject,
            rendered_body=body,
            status="scheduled",
        )
        db.add(log)
        db.flush()

        try:
            await send_gmail_message(db, account, candidate.email, subject, body)
            log.status = "sent"
            log.sent_at = datetime.now(timezone.utc)
        except Exception as exc:
            log.status = "failed"
            log.error_message = str(exc)[:1000]
            enrollment.status = "failed"
            db.commit()
            continue

        next_step = next((s for s in sequence.steps if s.step_number == enrollment.current_step + 1), None)
        if next_step:
            enrollment.current_step = next_step.step_number
            enrollment.next_send_at = now + timedelta(days=next_step.delay_days)
        else:
            enrollment.status = "completed"
            enrollment.next_send_at = None

        db.commit()


INBOX_MARKER_PREFIX = "candidate_inbox:"

DEFAULT_INBOX_STEPS = [
    {
        "step_name": "Intro",
        "subject": "Hey {{first_name}}, quick note about {{company}}",
        "body": (
            "Hi {{first_name}},\n\n"
            "I came across your profile and was impressed by your work as a {{current_title}} "
            "at {{company}}. I'd love to connect when you have a moment."
        ),
        "delay_days": 0,
    },
]


def _inbox_marker(candidate_id: int) -> str:
    return f"{INBOX_MARKER_PREFIX}{candidate_id}"


def ensure_candidate_enrolled(
    db: Session, sequence: OutreachSequence, candidate_id: int, user: User
) -> OutreachEnrollment:
    existing = db.query(OutreachEnrollment).filter(
        OutreachEnrollment.sequence_id == sequence.id,
        OutreachEnrollment.candidate_id == candidate_id,
    ).first()
    if existing:
        return existing
    return enroll_candidate(db, sequence, candidate_id, user)


def get_or_create_candidate_inbox(db: Session, candidate_id: int, user: User) -> OutreachSequence:
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")
    if user.role != UserRole.ADMIN and candidate.created_by != user.id:
        raise ForbiddenException("You do not have access to this candidate")

    marker = _inbox_marker(candidate_id)
    sequence = (
        db.query(OutreachSequence)
        .filter(
            OutreachSequence.created_by_user_id == user.id,
            OutreachSequence.description == marker,
        )
        .first()
    )

    account = get_user_gmail_account(db, user.id)

    if not sequence:
        sequence = OutreachSequence(
            name=f"Inbox — {candidate.name}",
            description=marker,
            created_by_user_id=user.id,
            sender_account_id=account.id if account and account.status == "connected" else None,
            status="draft",
        )
        db.add(sequence)
        db.flush()
        for i, step_data in enumerate(DEFAULT_INBOX_STEPS, start=1):
            db.add(
                OutreachSequenceStep(
                    sequence_id=sequence.id,
                    step_number=i,
                    **step_data,
                )
            )
        db.commit()
        db.refresh(sequence)

    ensure_candidate_enrolled(db, get_sequence_or_404(db, sequence.id, user), candidate_id, user)
    return get_sequence_or_404(db, sequence.id, user)
