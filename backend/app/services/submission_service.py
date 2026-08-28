"""Submission + client-feedback domain helpers."""

from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import (
    PIPELINE_INTERVIEW,
    PIPELINE_QUALIFIED,
    PIPELINE_STAGES_ORDER,
    PIPELINE_SUBMITTED,
    ClientFeedbackType,
    PipelineStage,
    SubmissionStatus,
    SUBMISSION_ACTIVE_STATUSES,
)
from app.models.submission import Submission


def assignment_can_submit(assignment: CandidateJobAssignment) -> bool:
    """Qualified (shortlisted) or later, excluding terminal hired/rejected."""
    status = assignment.status
    if status in (PipelineStage.REJECTED, PipelineStage.HIRED):
        return False
    try:
        return PIPELINE_STAGES_ORDER.index(status) >= PIPELINE_STAGES_ORDER.index(PIPELINE_QUALIFIED)
    except ValueError:
        return False


def has_active_submission(db, assignment_id: int) -> Submission | None:
    return (
        db.query(Submission)
        .filter(
            Submission.candidate_job_assignment_id == assignment_id,
            Submission.status.in_(SUBMISSION_ACTIVE_STATUSES),
        )
        .order_by(Submission.created_at.desc())
        .first()
    )


def apply_feedback_sync(
    submission: Submission,
    assignment: CandidateJobAssignment,
    feedback_type: ClientFeedbackType,
) -> tuple[SubmissionStatus | None, PipelineStage | None]:
    """Update submission (+ optionally CandidateJob) from client feedback.

    Returns (new_submission_status, new_pipeline_stage) — None means unchanged.
    Does NOT create Interview records.
    """
    new_sub: SubmissionStatus | None = None
    new_pipe: PipelineStage | None = None

    if feedback_type == ClientFeedbackType.INTERESTED:
        new_sub = SubmissionStatus.CLIENT_INTERESTED
    elif feedback_type == ClientFeedbackType.REJECTED:
        new_sub = SubmissionStatus.REJECTED
        new_pipe = PipelineStage.REJECTED
    elif feedback_type == ClientFeedbackType.INTERVIEW_REQUESTED:
        new_sub = SubmissionStatus.INTERVIEW_REQUESTED
        new_pipe = PIPELINE_INTERVIEW
    elif feedback_type == ClientFeedbackType.MORE_INFORMATION_REQUESTED:
        new_sub = SubmissionStatus.CLIENT_REVIEWING
    elif feedback_type == ClientFeedbackType.GENERAL_FEEDBACK:
        if submission.status == SubmissionStatus.SUBMITTED:
            new_sub = SubmissionStatus.CLIENT_REVIEWING

    if new_sub is not None:
        submission.status = new_sub
    if new_pipe is not None:
        assignment.status = new_pipe

    return new_sub, new_pipe


def mark_assignment_submitted(assignment: CandidateJobAssignment) -> None:
    assignment.status = PIPELINE_SUBMITTED
