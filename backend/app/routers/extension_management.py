from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.response import success_response
from app.models.user import User
from app.services import extension_auth_service as auth_service

# Cookie-authenticated endpoints used by the RecruitPro web app (Settings page)
# to manage the Chrome extension connection. Reachable via the frontend's
# /api rewrite as /api/extension/*.
router = APIRouter(prefix="/extension", tags=["extension-management"])


@router.get("/status")
def extension_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return success_response(
        data={"connected": auth_service.has_active_token(db, current_user.id)},
        message="OK",
    )


@router.post("/connect-code")
def generate_connect_code(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = auth_service.create_auth_code(db, current_user)
    db.commit()
    return success_response(
        data={"code": code, "expires_in": settings.EXTENSION_CODE_EXPIRE_SECONDS},
        message="Connection code generated",
    )


@router.post("/revoke")
def revoke_extension(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = auth_service.revoke_all_for_user(db, current_user.id)
    db.commit()
    return success_response(data={"revoked": count}, message="Extension disconnected")
