from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import NotFoundException
from app.core.response import success_response
from app.models.activity_log import ActivityLog
from app.models.enums import ActivityAction, EntityType
from app.models.note import Note
from app.models.user import User
from app.schemas.note import ActivityLogResponse, NoteCreate, NoteResponse, NoteUpdate
from app.services.activity_service import log_activity

router = APIRouter(tags=["notes"])


def _note_response(note: Note, db: Session) -> dict:
    creator = db.query(User).filter(User.id == note.created_by).first()
    return NoteResponse(
        id=note.id,
        entity_type=note.entity_type,
        entity_id=note.entity_id,
        content=note.content,
        is_private=note.is_private,
        category_type=note.category_type,
        category_ref_id=note.category_ref_id,
        shared_with_guest=note.shared_with_guest,
        created_by=note.created_by,
        created_by_name=creator.name if creator else None,
        created_at=note.created_at,
        updated_at=note.updated_at,
    ).model_dump()


@router.get("/notes")
def list_notes(
    entity_type: EntityType,
    entity_id: int,
    category_type: str | None = None,
    category_ref_id: int | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(Note).filter(Note.entity_type == entity_type, Note.entity_id == entity_id)
    if category_type:
        query = query.filter(Note.category_type == category_type)
    if category_ref_id is not None:
        query = query.filter(Note.category_ref_id == category_ref_id)
    notes = query.order_by(Note.created_at.desc()).all()
    items = [_note_response(note, db) for note in notes]
    return success_response(data={"items": items}, message="Notes retrieved")


@router.post("/notes")
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = Note(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        content=payload.content,
        is_private=payload.is_private,
        category_type=payload.category_type,
        category_ref_id=payload.category_ref_id,
        shared_with_guest=payload.shared_with_guest,
        created_by=current_user.id,
    )
    db.add(note)
    db.flush()
    log_activity(
        db, payload.entity_type, payload.entity_id, ActivityAction.NOTE_ADDED,
        f"Note added: {payload.content[:100]}", current_user.id,
    )
    db.commit()
    db.refresh(note)
    return success_response(data=_note_response(note, db), message="Note created")


@router.put("/notes/{note_id}")
def update_note(
    note_id: int,
    payload: NoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise NotFoundException("Note not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    db.commit()
    db.refresh(note)
    return success_response(data=_note_response(note, db), message="Note updated")


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise NotFoundException("Note not found")
    db.delete(note)
    db.commit()
    return success_response(message="Note deleted")


@router.get("/activity")
def list_activity(
    entity_type: EntityType | None = None,
    entity_id: int | None = None,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    query = db.query(ActivityLog)
    if entity_type:
        query = query.filter(ActivityLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(ActivityLog.entity_id == entity_id)

    logs = query.order_by(ActivityLog.created_at.desc()).limit(limit).all()
    items = []
    for log in logs:
        creator = db.query(User).filter(User.id == log.created_by).first()
        items.append(
            ActivityLogResponse(
                id=log.id,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                action=log.action,
                description=log.description,
                created_by=log.created_by,
                created_by_name=creator.name if creator else None,
                created_at=log.created_at,
            ).model_dump()
        )
    return success_response(data={"items": items}, message="Activity retrieved")
