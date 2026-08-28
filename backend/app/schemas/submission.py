from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ClientFeedbackType, SubmissionStatus


class SubmissionCreate(BaseModel):
    candidate_job_assignment_id: int
    candidate_summary: str | None = None
    expected_compensation: str | None = Field(default=None, max_length=255)
    availability: str | None = Field(default=None, max_length=255)
    recruiter_notes: str | None = None
    resume_file_path: str | None = Field(default=None, max_length=500)
    submission_date: date | None = None


class SubmissionUpdate(BaseModel):
    candidate_summary: str | None = None
    expected_compensation: str | None = Field(default=None, max_length=255)
    availability: str | None = Field(default=None, max_length=255)
    recruiter_notes: str | None = None
    resume_file_path: str | None = Field(default=None, max_length=500)
    status: SubmissionStatus | None = None
    submission_date: date | None = None


class SubmissionStatusUpdate(BaseModel):
    status: SubmissionStatus


class ClientFeedbackCreate(BaseModel):
    feedback_type: ClientFeedbackType
    feedback_text: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    rejection_reason: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    feedback_date: datetime | None = None

    @model_validator(mode="after")
    def validate_rejection(self):
        if self.feedback_type == ClientFeedbackType.REJECTED:
            if not self.rejection_reason and not self.feedback_text and not self.notes:
                raise ValueError("rejection_reason, feedback_text, or notes is required when rejecting")
        return self


class ClientFeedbackResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    submission_id: int
    feedback_type: ClientFeedbackType
    feedback_text: str | None = None
    rating: int | None = None
    rejection_reason: str | None = None
    notes: str | None = None
    created_by: int
    created_by_name: str | None = None
    feedback_date: datetime
    created_at: datetime
    updated_at: datetime


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_job_assignment_id: int
    candidate_id: int
    candidate_name: str | None = None
    job_id: int
    job_title: str | None = None
    client_id: int
    client_name: str | None = None
    engagement_id: int | None = None
    engagement_name: str | None = None
    recruiter_id: int
    recruiter_name: str | None = None
    submission_date: date
    resume_file_path: str | None = None
    candidate_summary: str | None = None
    expected_compensation: str | None = None
    availability: str | None = None
    recruiter_notes: str | None = None
    status: SubmissionStatus
    assignment_status: str | None = None
    feedback: list[ClientFeedbackResponse] = []
    created_at: datetime
    updated_at: datetime
