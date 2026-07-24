from fastapi import Cookie, Depends, Header
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_access_token
from app.models.enums import UserRole, UserStatus
from app.models.user import User


def get_current_user(
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=settings.COOKIE_NAME),
) -> User:
    if not access_token:
        raise UnauthorizedException("Not authenticated")
    payload = decode_access_token(access_token)
    if not payload or "sub" not in payload:
        raise UnauthorizedException("Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("User not found or inactive")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise ForbiddenException("Admin access required")
    return current_user


def get_extension_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    """Authenticate the Chrome extension via `Authorization: Bearer <jwt>`.

    Cookie-based auth is left untouched; the extension always uses a Bearer
    access token issued by the /extension/auth/exchange|refresh endpoints.
    """
    if not authorization:
        raise UnauthorizedException("Not authenticated")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedException("Invalid authorization header")
    payload = decode_access_token(token.strip())
    if not payload or "sub" not in payload:
        raise UnauthorizedException("Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user or user.status != UserStatus.ACTIVE:
        raise UnauthorizedException("User not found or inactive")
    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=settings.COOKIE_NAME),
) -> User | None:
    if not access_token:
        return None
    payload = decode_access_token(access_token)
    if not payload or "sub" not in payload:
        return None
    return db.query(User).filter(User.id == int(payload["sub"])).first()
