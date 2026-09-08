from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import UserRole, UserStatus


class UserPermissions(BaseModel):
    can_view_clients: bool = True
    can_add_clients: bool = True
    can_edit_clients: bool = True
    can_view_jobs: bool = True
    can_add_jobs: bool = True
    can_edit_jobs: bool = True
    can_view_candidates: bool = True
    can_add_candidates: bool = True
    can_edit_candidates: bool = True


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = None
    role: UserRole = UserRole.RECRUITER


class UserCreate(UserBase):
    password: str = Field(min_length=6)
    can_view_clients: bool = True
    can_add_clients: bool = True
    can_edit_clients: bool = True
    can_view_jobs: bool = True
    can_add_jobs: bool = True
    can_edit_jobs: bool = True
    can_view_candidates: bool = True
    can_add_candidates: bool = True
    can_edit_candidates: bool = True


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = None
    role: UserRole | None = None
    status: UserStatus | None = None
    password: str | None = Field(default=None, min_length=6)
    can_view_clients: bool | None = None
    can_add_clients: bool | None = None
    can_edit_clients: bool | None = None
    can_view_jobs: bool | None = None
    can_add_jobs: bool | None = None
    can_edit_jobs: bool | None = None
    can_view_candidates: bool | None = None
    can_add_candidates: bool | None = None
    can_edit_candidates: bool | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None
    role: UserRole
    status: UserStatus
    can_view_clients: bool = True
    can_add_clients: bool = True
    can_edit_clients: bool = True
    can_view_jobs: bool = True
    can_add_jobs: bool = True
    can_edit_jobs: bool = True
    can_view_candidates: bool = True
    can_add_candidates: bool = True
    can_edit_candidates: bool = True
    created_at: datetime
    updated_at: datetime
    assigned_jobs_count: int = 0


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class AuthUserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: UserRole
    can_view_clients: bool = True
    can_add_clients: bool = True
    can_edit_clients: bool = True
    can_view_jobs: bool = True
    can_add_jobs: bool = True
    can_edit_jobs: bool = True
    can_view_candidates: bool = True
    can_add_candidates: bool = True
    can_edit_candidates: bool = True
