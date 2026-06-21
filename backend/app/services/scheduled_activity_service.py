from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.scheduled_activity import ScheduledActivityResponse


def scheduled_activity_response(activity, db: Session) -> dict:
    assignee = db.query(User).filter(User.id == activity.assigned_to_id).first() if activity.assigned_to_id else None
    creator = db.query(User).filter(User.id == activity.created_by).first()
    return ScheduledActivityResponse(
        id=activity.id,
        title=activity.title,
        activity_type=activity.activity_type,
        activity_date=activity.activity_date,
        start_time=activity.start_time,
        end_time=activity.end_time,
        duration_minutes=activity.duration_minutes,
        location=activity.location,
        description=activity.description,
        assigned_to_id=activity.assigned_to_id,
        assigned_to_name=assignee.name if assignee else None,
        share_with_guests=activity.share_with_guests,
        created_by=activity.created_by,
        created_by_name=creator.name if creator else None,
        created_at=activity.created_at,
    ).model_dump()
