from datetime import timedelta

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import UnauthorizedException
from app.core.response import success_response
from app.core.security import create_access_token, get_cookie_settings, verify_password
from app.models.enums import UserStatus
from app.models.user import User
from app.schemas.auth import AuthUserResponse, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password")
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("Account is inactive")

    expire_minutes = settings.JWT_EXPIRE_MINUTES
    if payload.remember_me:
        expire_minutes = settings.JWT_EXPIRE_MINUTES * 7

    token = create_access_token(
        data={"sub": str(user.id), "role": user.role.value},
        expires_delta=timedelta(minutes=expire_minutes),
    )

    cookie_settings = get_cookie_settings()
    response.set_cookie(
        value=token,
        max_age=expire_minutes * 60,
        **{k: v for k, v in cookie_settings.items() if k != "max_age"},
    )

    user_data = AuthUserResponse(id=user.id, name=user.name, email=user.email, role=user.role)
    redirect_to = "/dashboard" if user.role.value == "admin" else "/my-jobs"
    return success_response(
        data={"user": user_data.model_dump(), "redirect_to": redirect_to},
        message="Login successful",
    )


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    user_data = AuthUserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
    )
    return success_response(data=user_data.model_dump(), message="User retrieved")


@router.post("/logout")
def logout(response: Response):
    cookie_settings = get_cookie_settings()
    response.delete_cookie(
        key=cookie_settings["key"],
        httponly=True,
        samesite="lax",
        secure=cookie_settings["secure"],
        path="/",
    )
    return success_response(message="Logged out successfully")
