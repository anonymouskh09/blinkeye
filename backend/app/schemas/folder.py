from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_favorite: bool | None = None


class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    is_favorite: bool
    candidate_count: int = 0
    created_by: int
    owner_name: str | None = None
    shared_to_name: str | None = None
    created_at: datetime
    updated_at: datetime


class AddCandidatesToFolderRequest(BaseModel):
    candidate_ids: list[int] = Field(min_length=1)
