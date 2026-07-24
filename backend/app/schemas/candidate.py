from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import CandidateStatus, PipelineStage


class CandidateBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = None
    location: str | None = None
    current_job_title: str | None = None
    current_company: str | None = None
    experience_years: int | None = Field(default=None, ge=0)
    skills: list[str] | None = None
    expected_salary: int | None = Field(default=None, ge=0)
    notice_period: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None


class CandidateCreate(CandidateBase):
    pass


class CandidateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = None
    location: str | None = None
    current_job_title: str | None = None
    current_company: str | None = None
    experience_years: int | None = Field(default=None, ge=0)
    skills: list[str] | None = None
    expected_salary: int | None = Field(default=None, ge=0)
    notice_period: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None
    profile_extras: dict | None = None
    experiences: list[dict] | None = None
    educations: list[dict] | None = None
    skill_levels: list[dict] | None = None
    candidate_status: CandidateStatus | None = None
    candidate_rating: int | None = Field(default=None, ge=1, le=5)
    assigned_job_id: int | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = None
    timezone: str | None = None


class CandidateProfilePatch(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    location: str | None = None
    current_job_title: str | None = None
    current_company: str | None = None
    experience_years: int | None = None
    skills: list[str] | None = None
    expected_salary: int | None = None
    notice_period: str | None = None
    linkedin_url: str | None = None
    notes: str | None = None
    profile_extras: dict | None = None
    experiences: list[dict] | None = None
    educations: list[dict] | None = None
    skill_levels: list[dict] | None = None
    candidate_status: CandidateStatus | None = None
    candidate_rating: int | None = Field(default=None, ge=1, le=5)
    assigned_job_id: int | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    salary_currency: str | None = None
    timezone: str | None = None


class CandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    location: str | None
    current_job_title: str | None
    current_company: str | None
    experience_years: int | None
    skills: list[str] | None
    expected_salary: int | None
    notice_period: str | None
    linkedin_url: str | None
    cv_file_path: str | None
    notes: str | None
    headline: str | None = None
    summary: str | None = None
    profile_image_url: str | None = None
    source: str | None = None
    imported_via: str | None = None
    created_by: int
    created_by_name: str | None = None
    jobs_applied_count: int = 0
    profile_extras: dict | None = None
    experiences: list[dict] | None = None
    educations: list[dict] | None = None
    skill_levels: list[dict] | None = None
    candidate_status: str = CandidateStatus.NEW.value
    candidate_rating: int | None = None
    assigned_job_id: int | None = None
    assigned_job_title: str | None = None
    assigned_job_client: str | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str | None = None
    timezone: str | None = None
    created_at: datetime
    updated_at: datetime


class AssignJobRequest(BaseModel):
    job_id: int
    notes: str | None = None


class CandidateJobAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    job_id: int
    job_title: str | None = None
    client_name: str | None = None
    status: PipelineStage
    assigned_recruiter_id: int
    assigned_recruiter_name: str | None = None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PipelineStatusUpdate(BaseModel):
    status: PipelineStage
