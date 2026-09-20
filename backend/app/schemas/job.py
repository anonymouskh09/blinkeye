from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import BillingModel, JobStatus, JobType, ServiceModel


def _clean_string_list(value: list[str] | None) -> list[str] | None:
    """Trim, drop blanks, and de-duplicate case-insensitively while keeping order."""
    if value is None:
        return None
    seen: set[str] = set()
    cleaned: list[str] = []
    for raw in value:
        item = (raw or "").strip()
        if not item or item.lower() in seen:
            continue
        seen.add(item.lower())
        cleaned.append(item)
    return cleaned


class JobBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    engagement_id: int | None = None
    location: str | None = None
    job_type: JobType = JobType.FULL_TIME
    salary_min: int | None = None
    salary_max: int | None = None
    required_skills: str | None = None
    must_have_skills: list[str] | None = None
    nice_to_have_skills: list[str] | None = None
    experience_required: str | None = None
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    max_experience_years: int | None = Field(default=None, ge=0, le=60)
    description: str | None = None
    screening_questions: list[str] | None = None
    number_of_positions: int = Field(default=1, ge=1)
    status: JobStatus = JobStatus.ACTIVE
    assigned_recruiter_id: int | None = None

    _normalize_skills = field_validator("must_have_skills", "nice_to_have_skills")(_clean_string_list)
    _normalize_questions = field_validator("screening_questions")(_clean_string_list)

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.salary_min is not None and self.salary_max is not None:
            if self.salary_min > self.salary_max:
                raise ValueError("salary_min cannot be greater than salary_max")
        if self.min_experience_years is not None and self.max_experience_years is not None:
            if self.min_experience_years > self.max_experience_years:
                raise ValueError("min_experience_years cannot be greater than max_experience_years")
        return self


class JobCreate(JobBase):
    # Required when engagement is omitted; otherwise derived from engagement.
    client_id: int | None = None

    @model_validator(mode="after")
    def require_client_or_engagement(self):
        if self.engagement_id is None and self.client_id is None:
            raise ValueError("client_id is required when engagement_id is not provided")
        return self

    @model_validator(mode="after")
    def require_matching_fields(self):
        """New jobs must carry enough structure for candidate matching."""
        if not self.must_have_skills:
            raise ValueError("At least one must-have skill is required")
        if not (self.description or "").strip():
            raise ValueError("Job description is required")
        if not self.screening_questions:
            raise ValueError("At least one screening question is required")
        return self


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    client_id: int | None = None
    engagement_id: int | None = None
    location: str | None = None
    job_type: JobType | None = None
    salary_min: int | None = None
    salary_max: int | None = None
    required_skills: str | None = None
    must_have_skills: list[str] | None = None
    nice_to_have_skills: list[str] | None = None
    experience_required: str | None = None
    min_experience_years: int | None = Field(default=None, ge=0, le=60)
    max_experience_years: int | None = Field(default=None, ge=0, le=60)
    description: str | None = None
    screening_questions: list[str] | None = None
    number_of_positions: int | None = Field(default=None, ge=1)
    status: JobStatus | None = None
    assigned_recruiter_id: int | None = None

    _normalize_skills = field_validator("must_have_skills", "nice_to_have_skills")(_clean_string_list)
    _normalize_questions = field_validator("screening_questions")(_clean_string_list)


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    client_id: int
    client_name: str | None = None
    engagement_id: int | None = None
    engagement_name: str | None = None
    service_model: ServiceModel | None = None
    billing_model: BillingModel | None = None
    location: str | None
    job_type: JobType
    salary_min: int | None
    salary_max: int | None
    required_skills: str | None
    must_have_skills: list[str] | None = None
    nice_to_have_skills: list[str] | None = None
    experience_required: str | None
    min_experience_years: int | None = None
    max_experience_years: int | None = None
    description: str | None
    screening_questions: list[str] | None = None
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
    engagement_id: int | None = None
    engagement_name: str | None = None
