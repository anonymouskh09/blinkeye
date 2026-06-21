from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import JobStatus, JobType


class JobBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    client_id: int
    location: str | None = None
    job_type: JobType = JobType.FULL_TIME
    salary_min: int | None = None
    salary_max: int | None = None
    required_skills: str | None = None
    experience_required: str | None = None
    description: str | None = None
    number_of_positions: int = Field(default=1, ge=1)
    status: JobStatus = JobStatus.ACTIVE
    assigned_recruiter_id: int | None = None

    @model_validator(mode="after")
    def validate_salary(self):
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min cannot be greater than salary_max")
        return self


class JobCreate(JobBase):
    pass


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    client_id: int | None = None
    location: str | None = None
    job_type: JobType | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    required_skills: str | None = None
    experience_required: str | None = None
    description: str | None = None
    number_of_positions: int | None = Field(default=None, ge=1)
    status: JobStatus | None = None
    assigned_recruiter_id: int | None = None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    client_id: int
    client_name: str | None = None
    location: str | None
    job_type: JobType
    salary_min: int | None
    salary_max: int | None
    required_skills: str | None
    experience_required: str | None
    description: str | None
    number_of_positions: int
    status: JobStatus
    assigned_recruiter_id: int | None
    assigned_recruiter_name: str | None = None
    candidate_count: int = 0
    created_at: datetime
    updated_at: datetime


class JobSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: JobStatus
    location: str | None
    candidate_count: int = 0
    created_at: datetime
    salary_min: int | None = None
    salary_max: int | None = None
    number_of_positions: int = 1
    assigned_recruiter_id: int | None = None
    assigned_recruiter_name: str | None = None
