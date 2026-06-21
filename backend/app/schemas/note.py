from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ActivityAction, EntityType


class NoteCreate(BaseModel):
    entity_type: EntityType
    entity_id: int
    content: str
    is_private: bool = False
    category_type: str = "general"
    category_ref_id: int | None = None
    shared_with_guest: bool = False


class NoteUpdate(BaseModel):
    content: str | None = None
    is_private: bool | None = None
    shared_with_guest: bool | None = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: EntityType
    entity_id: int
    content: str
    is_private: bool = False
    category_type: str = "general"
    category_ref_id: int | None = None
    shared_with_guest: bool = False
    created_by: int
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    entity_type: EntityType
    entity_id: int
    action: ActivityAction
    description: str
    created_by: int
    created_by_name: str | None = None
    created_at: datetime
