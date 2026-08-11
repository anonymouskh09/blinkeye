from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ClientStage, ClientStatus


class ClientBase(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    contact_person: str = Field(default="", max_length=255)
    email: EmailStr | str = Field(default="")
    phone: str | None = None
    industry: str | None = None
    location: str | None = None
    address: str | None = None
    website: str | None = None
    description: str | None = None
    notes: str | None = None
    status: ClientStatus = ClientStatus.ACTIVE
    stage: ClientStage = ClientStage.PROSPECT
    owner_id: int | None = None


class ClientCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=255)
    contact_person: str = Field(default="", max_length=255)
    contact_title: str | None = None
    email: str = Field(default="")
    phone: str | None = None
    industry: str | None = None
    location: str | None = None
    address: str | None = None
    website: str | None = None
    description: str | None = None
    notes: str | None = None
    status: ClientStatus = ClientStatus.ACTIVE
    stage: ClientStage = ClientStage.PROSPECT
    owner_id: int | None = None
    team_user_ids: list[int] = Field(default_factory=list)


class ClientUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1, max_length=255)
    contact_person: str | None = Field(default=None, max_length=255)
    email: str | None = None
    phone: str | None = None
    industry: str | None = None
    location: str | None = None
    address: str | None = None
    website: str | None = None
    description: str | None = None
    notes: str | None = None
    status: ClientStatus | None = None
    stage: ClientStage | None = None
    owner_id: int | None = None
    visibility: str | None = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    company_name: str
    contact_person: str
    email: str
    phone: str | None
    industry: str | None
    location: str | None
    address: str | None
    website: str | None
    description: str | None
    notes: str | None
    status: ClientStatus
    stage: ClientStage
    owner_id: int | None
    owner_name: str | None = None
    team_member_name: str | None = None
    job_count: int = 0
    tags: list[str] = []
    custom_tags: list[dict] = []
    visibility: str = "public"
    created_at: datetime
    updated_at: datetime


class ClientTagsUpdate(BaseModel):
    tags: list[str] = Field(default_factory=list)
    custom_tags: list[dict] | None = None


class ClientActivityUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    activity_type: str | None = None
    activity_date: date | None = None
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int | None = None
    location: str | None = None
    description: str | None = None
    assigned_to_id: int | None = None
    share_with_guests: bool | None = None


class ClientActivityCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    activity_type: str = Field(default="task")
    activity_date: date
    start_time: str | None = None
    end_time: str | None = None
    duration_minutes: int | None = None
    location: str | None = None
    description: str | None = None
    assigned_to_id: int | None = None
    share_with_guests: bool = False


class ClientActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    title: str
    activity_type: str
    activity_date: date
    start_time: str | None
    end_time: str | None
    duration_minutes: int | None
    location: str | None
    description: str | None
    assigned_to_id: int | None
    assigned_to_name: str | None = None
    share_with_guests: bool
    created_by: int
    created_by_name: str | None = None
    created_at: datetime


class ClientContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = None
    title: str | None = None


class ClientContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    email: str | None
    phone: str | None
    title: str | None
    created_at: datetime


class ClientTeamMemberResponse(BaseModel):
    id: int
    user_id: int
    name: str
    email: str
    status: str


class ClientGuestCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str | None = None


class ClientGuestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    name: str
    email: str | None
    created_at: datetime


class ClientAttachmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    filename: str
    file_path: str
    file_size: int | None
    uploaded_by: int
    uploaded_by_name: str | None = None
    created_at: datetime


class ClientDetailResponse(ClientResponse):
    jobs: list["JobSummaryResponse"] = []
    contacts: list[ClientContactResponse] = []
    team: list[ClientTeamMemberResponse] = []
    guests: list[ClientGuestResponse] = []
    attachments: list[ClientAttachmentResponse] = []
    activities: list[ClientActivityResponse] = []


from app.schemas.job import JobSummaryResponse  # noqa: E402

ClientDetailResponse.model_rebuild()
