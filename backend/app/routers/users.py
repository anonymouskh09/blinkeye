from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.core.security import hash_password
from app.models.enums import UserRole, UserStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _user_to_response(user: User, db: Session) -> dict:
    assigned_count = db.query(func.count(Job.id)).filter(
        Job.assigned_recruiter_id == user.id
    ).scalar() or 0
    data = UserResponse.model_validate(user).model_dump()
    data["assigned_jobs_count"] = assigned_count
    return data


@router.get("")
def list_users(
    search: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (User.name.ilike(term)) | (User.email.ilike(term))
        )
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_user_to_response(u, db) for u in users]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Users retrieved",
    )


@router.post("")
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise BadRequestException("Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        role=payload.role,
        password_hash=hash_password(payload.password),
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return success_response(data=_user_to_response(user, db), message="User created")


@router.get("/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    jobs = db.query(Job).filter(Job.assigned_recruiter_id == user_id).all()
    data = _user_to_response(user, db)
    data["assigned_jobs"] = [
        {"id": j.id, "title": j.title, "status": j.status.value, "created_at": j.created_at.isoformat()}
        for j in jobs
    ]
    return success_response(data=data, message="User retrieved")


@router.put("/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "password" in update_data:
        password = update_data.pop("password")
        if password:
            user.password_hash = hash_password(password)

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return success_response(data=_user_to_response(user, db), message="User updated")


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    if user.id == admin.id:
        raise BadRequestException("Cannot deactivate your own account")

    user.status = UserStatus.INACTIVE
    db.commit()
    return success_response(message="User deactivated")
