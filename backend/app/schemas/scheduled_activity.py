from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ScheduledActivityCreate(BaseModel):
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


class ScheduledActivityUpdate(BaseModel):
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


class ScheduledActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
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
