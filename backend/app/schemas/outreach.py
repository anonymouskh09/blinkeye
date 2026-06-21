from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SequenceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class SequenceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class StepCreate(BaseModel):
    step_name: str = Field(min_length=1, max_length=255)
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    delay_days: int = Field(default=0, ge=0)


class StepUpdate(BaseModel):
    step_name: str | None = Field(default=None, min_length=1, max_length=255)
    subject: str | None = Field(default=None, min_length=1, max_length=500)
    body: str | None = None
    delay_days: int | None = Field(default=None, ge=0)


class EnrollCandidateRequest(BaseModel):
    candidate_id: int


class PreviewEmailRequest(BaseModel):
    candidate_id: int
    step_number: int = 1


class GmailStatusResponse(BaseModel):
    connected: bool
    status: str
    email_address: str | None
    last_connected_at: str | None
    last_error: str | None
    sent_today: int
    daily_limit: int


class SequenceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    status: str
    sender_email: str | None
    created_by_user_id: int
    created_by_name: str | None
    enrolled_count: int
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime
