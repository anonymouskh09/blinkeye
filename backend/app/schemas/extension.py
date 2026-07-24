from pydantic import BaseModel, Field


class ExchangeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=512)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=512)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=1, max_length=512)


class DevTokenRequest(BaseModel):
    """Dev-only: connect using a pasted JWT access token."""

    token: str = Field(..., min_length=1, max_length=2048)


class ImportCandidateRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)
    headline: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=255)
    summary: str | None = Field(default=None, max_length=20000)
    linkedin_url: str | None = Field(default=None, max_length=1000)
    profile_image_url: str | None = Field(default=None, max_length=2000)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    source: str = Field(default="linkedin_extension", max_length=50)
    imported_via: str | None = Field(default=None, max_length=50)
    job_id: int | None = None
    owner_id: int | None = None
    stage: str | None = Field(default=None, max_length=50)
    tags: list[str] | None = None
    experiences: list[dict] | None = None
    educations: list[dict] | None = None
    skills: list[str] | None = None
    certifications: list[dict] | None = None
    languages: list[dict] | None = None
    current_job_title: str | None = Field(default=None, max_length=255)
    current_company: str | None = Field(default=None, max_length=255)


class UpdateMissingFieldsRequest(BaseModel):
    """Only fills empty candidate fields; never overwrites non-empty values."""

    name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    location: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(default=None, max_length=500)
    summary: str | None = Field(default=None, max_length=20000)
    current_job_title: str | None = Field(default=None, max_length=255)
    current_company: str | None = Field(default=None, max_length=255)
    skills: list[str] | None = None
    experiences: list[dict] | None = None
    educations: list[dict] | None = None
    certifications: list[dict] | None = None
    languages: list[dict] | None = None
    job_id: int | None = None
    stage: str | None = Field(default=None, max_length=50)
