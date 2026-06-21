from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import InterviewStatus, InterviewType


class InterviewBase(BaseModel):
    candidate_job_id: int
    interview_date: date
    interview_time: time
    interview_type: InterviewType
    interviewer_name: str = Field(min_length=1, max_length=255)
    meeting_link: str | None = None
    location: str | None = None
    status: InterviewStatus = InterviewStatus.SCHEDULED
    notes: str | None = None


class InterviewCreate(InterviewBase):
    pass


class InterviewUpdate(BaseModel):
    interview_date: date | None = None
    interview_time: time | None = None
    interview_type: InterviewType | None = None
    interviewer_name: str | None = Field(default=None, min_length=1, max_length=255)
    meeting_link: str | None = None
    location: str | None = None
    status: InterviewStatus | None = None
    notes: str | None = None


class InterviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_job_id: int
    candidate_name: str | None = None
    job_title: str | None = None
    client_name: str | None = None
    interview_date: date
    interview_time: time
    interview_type: InterviewType
    interviewer_name: str
    meeting_link: str | None
    location: str | None
    status: InterviewStatus
    notes: str | None
    created_by: int
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
