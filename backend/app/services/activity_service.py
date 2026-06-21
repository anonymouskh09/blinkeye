from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.enums import ActivityAction, EntityType


def log_activity(
    db: Session,
    entity_type: EntityType,
    entity_id: int,
    action: ActivityAction,
    description: str,
    user_id: int,
) -> ActivityLog:
    activity = ActivityLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        description=description,
        created_by=user_id,
    )
    db.add(activity)
    db.flush()
    return activity
