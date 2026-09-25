"""Write side of the Matches feature: shortlist, dismiss, undo.

Every action is permission-checked per pair, audit-logged on both the
candidate and the job, and reported back as added/skipped so bulk actions
never fail as a whole because of one bad row.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import ActivityAction, EntityType, JobStatus, PipelineStage
from app.models.job import Job
from app.models.match import MatchDismissal, MatchScore
from app.models.user import User
from app.services.activity_service import log_activity
from app.services.permission_service import apply_hidden_candidates_filter, can_access_job, is_admin

DISMISS_REASONS = {
    "not_a_fit": "Not a fit",
    "overqualified": "Overqualified",
    "underqualified": "Underqualified",
    "salary_mismatch": "Salary mismatch",
    "location": "Location",
    "not_interested": "Candidate not interested",
    "already_contacted": "Already contacted",
    "other": "Other",
}


class _Access:
    """Caches per-request job/candidate lookups and permission checks."""

    def __init__(self, db: Session, user: User, pairs: list[tuple[int, int]]):
        job_ids = {j for j, _ in pairs}
        cand_ids = {c for _, c in pairs}
        self.jobs = {j.id: j for j in db.query(Job).filter(Job.id.in_(job_ids)).all()} if job_ids else {}
        self.candidates = (
            {c.id: c for c in db.query(Candidate).filter(Candidate.id.in_(cand_ids)).all()} if cand_ids else {}
        )
        self.job_ok = {jid: can_access_job(user, job, db) for jid, job in self.jobs.items()}
        if is_admin(user) or not cand_ids:
            self.visible_candidates = set(self.candidates)
        else:
            q = db.query(Candidate.id).filter(Candidate.id.in_(cand_ids))
            self.visible_candidates = {r[0] for r in apply_hidden_candidates_filter(q, db, user).all()}

    def check(self, job_id: int, candidate_id: int) -> str | None:
        """Return a skip reason, or None when the pair can be acted on."""
        job = self.jobs.get(job_id)
        cand = self.candidates.get(candidate_id)
        if job is None or cand is None or cand.is_archived:
            return "not_found"
        if not self.job_ok.get(job_id) or candidate_id not in self.visible_candidates:
            return "no_access"
        return None


def _score_label(db: Session, job_id: int, candidate_id: int) -> str:
    score = (
        db.query(MatchScore.overall_score)
        .filter(MatchScore.job_id == job_id, MatchScore.candidate_id == candidate_id)
        .scalar()
    )
    return f" (match {score}%)" if score is not None else ""


def shortlist(db: Session, user: User, pairs: list[tuple[int, int]]) -> dict:
    access = _Access(db, user, pairs)
    added, skipped = [], []
    for job_id, cand_id in dict.fromkeys(pairs):
        reason = access.check(job_id, cand_id)
        job, cand = access.jobs.get(job_id), access.candidates.get(cand_id)
        if reason is None and job.status != JobStatus.ACTIVE:
            reason = "job_not_active"
        if reason is None:
            exists = (
                db.query(CandidateJobAssignment.id)
                .filter(CandidateJobAssignment.job_id == job_id, CandidateJobAssignment.candidate_id == cand_id)
                .first()
            )
            if exists:
                reason = "already_in_pipeline"
        if reason:
            skipped.append({"job_id": job_id, "candidate_id": cand_id, "reason": reason})
            continue

        score_label = _score_label(db, job_id, cand_id)
        try:
            # Savepoint: a concurrent shortlist of the same pair hits
            # uq_candidate_job and is reported as a skip, not a 500.
            with db.begin_nested():
                db.add(CandidateJobAssignment(
                    candidate_id=cand_id,
                    job_id=job_id,
                    status=PipelineStage.APPLIED,
                    assigned_recruiter_id=job.assigned_recruiter_id or user.id,
                ))
                db.flush()
        except IntegrityError:
            skipped.append({"job_id": job_id, "candidate_id": cand_id, "reason": "already_in_pipeline"})
            continue

        if not cand.assigned_job_id:
            cand.assigned_job_id = job_id
        log_activity(
            db, EntityType.CANDIDATE, cand_id, ActivityAction.ASSIGNED,
            f"Shortlisted from Matches to job '{job.title}'{score_label}", user.id,
        )
        log_activity(
            db, EntityType.JOB, job_id, ActivityAction.ASSIGNED,
            f"Candidate '{cand.name}' shortlisted from Matches{score_label}", user.id,
        )
        added.append({"job_id": job_id, "candidate_id": cand_id, "candidate_name": cand.name, "job_title": job.title})

    db.commit()
    return {"added": added, "skipped": skipped}


def dismiss(db: Session, user: User, pairs: list[tuple[int, int]], reason: str, note: str | None) -> dict:
    access = _Access(db, user, pairs)
    label = DISMISS_REASONS[reason]
    dismissed, skipped = [], []
    for job_id, cand_id in dict.fromkeys(pairs):
        skip = access.check(job_id, cand_id)
        if skip:
            skipped.append({"job_id": job_id, "candidate_id": cand_id, "reason": skip})
            continue
        job, cand = access.jobs[job_id], access.candidates[cand_id]
        try:
            with db.begin_nested():
                row = MatchDismissal(
                    job_id=job_id, candidate_id=cand_id, reason=reason, note=note, dismissed_by=user.id,
                )
                db.add(row)
                db.flush()
        except IntegrityError:
            skipped.append({"job_id": job_id, "candidate_id": cand_id, "reason": "already_dismissed"})
            continue
        suffix = f": {label}" + (f" — {note}" if note else "")
        log_activity(
            db, EntityType.CANDIDATE, cand_id, ActivityAction.UPDATED,
            f"Match with job '{job.title}' dismissed{suffix}", user.id,
        )
        log_activity(
            db, EntityType.JOB, job_id, ActivityAction.UPDATED,
            f"Match with candidate '{cand.name}' dismissed{suffix}", user.id,
        )
        dismissed.append({"id": row.id, "job_id": job_id, "candidate_id": cand_id})
    db.commit()
    return {"dismissed": dismissed, "skipped": skipped}


def undo_dismissals(db: Session, user: User, dismissal_ids: list[int]) -> dict:
    rows = db.query(MatchDismissal).filter(MatchDismissal.id.in_(dismissal_ids)).all() if dismissal_ids else []
    by_id = {r.id: r for r in rows}
    access = _Access(db, user, [(r.job_id, r.candidate_id) for r in rows])
    restored, skipped = [], []
    now = datetime.now(timezone.utc)
    for did in dict.fromkeys(dismissal_ids):
        row = by_id.get(did)
        if row is None:
            skipped.append({"id": did, "reason": "not_found"})
            continue
        if row.undone_at is not None:
            skipped.append({"id": did, "reason": "already_restored"})
            continue
        reason = access.check(row.job_id, row.candidate_id)
        if reason:
            skipped.append({"id": did, "reason": reason})
            continue
        row.undone_at = now
        row.undone_by = user.id
        job, cand = access.jobs[row.job_id], access.candidates[row.candidate_id]
        log_activity(
            db, EntityType.CANDIDATE, cand.id, ActivityAction.UPDATED,
            f"Dismissed match with job '{job.title}' restored", user.id,
        )
        log_activity(
            db, EntityType.JOB, job.id, ActivityAction.UPDATED,
            f"Dismissed match with candidate '{cand.name}' restored", user.id,
        )
        restored.append({"id": did, "job_id": row.job_id, "candidate_id": row.candidate_id})
    db.commit()
    return {"restored": restored, "skipped": skipped}


def shortlisted_this_week(db: Session, user: User) -> int:
    """Shortlists made from Matches in the last 7 days (the user's own unless admin)."""
    from datetime import timedelta

    from app.models.activity_log import ActivityLog

    q = db.query(ActivityLog.id).filter(
        ActivityLog.entity_type == EntityType.CANDIDATE,
        ActivityLog.action == ActivityAction.ASSIGNED,
        ActivityLog.description.like("Shortlisted from Matches%"),
        ActivityLog.created_at >= datetime.now(timezone.utc) - timedelta(days=7),
    )
    if not is_admin(user):
        q = q.filter(ActivityLog.created_by == user.id)
    return q.count()
