from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.candidate import Candidate
from app.models.candidate_folder import CandidateFolder, CandidateFolderMember
from app.models.enums import UserRole
from app.models.user import User
from app.routers.candidates import _candidate_to_response
from app.schemas.folder import AddCandidatesToFolderRequest, FolderCreate, FolderResponse, FolderUpdate

router = APIRouter(prefix="/folders", tags=["folders"])


def _folder_query(db: Session, current_user: User):
    q = db.query(CandidateFolder)
    if current_user.role != UserRole.ADMIN:
        q = q.filter(CandidateFolder.created_by == current_user.id)
    return q


def _folder_to_response(folder: CandidateFolder, db: Session) -> dict:
    count = db.query(func.count(CandidateFolderMember.id)).filter(
        CandidateFolderMember.folder_id == folder.id
    ).scalar() or 0
    owner = db.query(User).filter(User.id == folder.created_by).first()
    return FolderResponse(
        id=folder.id,
        name=folder.name,
        description=folder.description,
        is_favorite=folder.is_favorite,
        candidate_count=count,
        created_by=folder.created_by,
        owner_name=owner.name if owner else None,
        shared_to_name=owner.name if owner else None,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
    ).model_dump()


def _get_folder_or_404(db: Session, folder_id: int, current_user: User) -> CandidateFolder:
    folder = _folder_query(db, current_user).filter(CandidateFolder.id == folder_id).first()
    if not folder:
        raise NotFoundException("Folder not found")
    return folder


@router.get("")
def list_folders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _folder_query(db, current_user)
    if search:
        q = q.filter(or_(
            CandidateFolder.name.ilike(f"%{search}%"),
            CandidateFolder.description.ilike(f"%{search}%"),
        ))
    total = q.count()
    folders = q.order_by(CandidateFolder.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_folder_to_response(f, db) for f in folders]
    meta = paginate(total, page, page_size)
    return success_response(data={"items": items, **meta.model_dump()}, message="Folders retrieved")


@router.post("")
def create_folder(
    payload: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = CandidateFolder(
        name=payload.name.strip(),
        description=payload.description,
        created_by=current_user.id,
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return success_response(data=_folder_to_response(folder, db), message="Folder created")


@router.get("/{folder_id}")
def get_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = _get_folder_or_404(db, folder_id, current_user)
    return success_response(data=_folder_to_response(folder, db), message="Folder retrieved")


@router.put("/{folder_id}")
def update_folder(
    folder_id: int,
    payload: FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = _get_folder_or_404(db, folder_id, current_user)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(folder, key, value)
    db.commit()
    db.refresh(folder)
    return success_response(data=_folder_to_response(folder, db), message="Folder updated")


@router.delete("/{folder_id}")
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = _get_folder_or_404(db, folder_id, current_user)
    db.delete(folder)
    db.commit()
    return success_response(message="Folder deleted")


@router.get("/{folder_id}/candidates")
def list_folder_candidates(
    folder_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_folder_or_404(db, folder_id, current_user)
    q = (
        db.query(Candidate)
        .join(CandidateFolderMember, CandidateFolderMember.candidate_id == Candidate.id)
        .filter(CandidateFolderMember.folder_id == folder_id)
    )
    if current_user.role != UserRole.ADMIN:
        q = q.filter(Candidate.created_by == current_user.id)
    if search:
        q = q.filter(or_(
            Candidate.name.ilike(f"%{search}%"),
            Candidate.email.ilike(f"%{search}%"),
            Candidate.current_job_title.ilike(f"%{search}%"),
        ))
    total = q.count()
    candidates = q.order_by(Candidate.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_candidate_to_response(c, db) for c in candidates]
    meta = paginate(total, page, page_size)
    return success_response(data={"items": items, **meta.model_dump()}, message="Folder candidates retrieved")


@router.post("/{folder_id}/candidates")
def add_candidates_to_folder(
    folder_id: int,
    payload: AddCandidatesToFolderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    folder = _get_folder_or_404(db, folder_id, current_user)
    added = 0
    for cid in payload.candidate_ids:
        candidate = db.query(Candidate).filter(Candidate.id == cid).first()
        if not candidate:
            continue
        if current_user.role != UserRole.ADMIN and candidate.created_by != current_user.id:
            continue
        exists = db.query(CandidateFolderMember).filter(
            CandidateFolderMember.folder_id == folder.id,
            CandidateFolderMember.candidate_id == cid,
        ).first()
        if exists:
            continue
        db.add(CandidateFolderMember(folder_id=folder.id, candidate_id=cid, added_by=current_user.id))
        added += 1
    if not added:
        raise BadRequestException("No candidates were added")
    db.commit()
    return success_response(data={"added": added}, message=f"{added} candidate(s) added to folder")


@router.delete("/{folder_id}/candidates/{candidate_id}")
def remove_candidate_from_folder(
    folder_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_folder_or_404(db, folder_id, current_user)
    member = db.query(CandidateFolderMember).filter(
        CandidateFolderMember.folder_id == folder_id,
        CandidateFolderMember.candidate_id == candidate_id,
    ).first()
    if not member:
        raise NotFoundException("Candidate not in folder")
    db.delete(member)
    db.commit()
    return success_response(message="Candidate removed from folder")
