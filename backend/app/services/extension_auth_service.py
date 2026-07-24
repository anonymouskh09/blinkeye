import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import UnauthorizedException
from app.core.security import create_access_token
from app.models.extension_auth import ExtensionAuthCode, ExtensionToken
from app.models.user import User


def _hash(raw: str) -> str:
    """SHA-256 is appropriate here: codes/refresh tokens are high-entropy random
    strings, so we only need a fast one-way digest (not a password KDF)."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_auth_code(db: Session, user: User) -> str:
    """Generate a single-use authorization code for the given user and persist
    its hash. Returns the plaintext code (shown once in the web app)."""
    raw = secrets.token_urlsafe(32)
    code = ExtensionAuthCode(
        code_hash=_hash(raw),
        user_id=user.id,
        expires_at=_now() + timedelta(seconds=settings.EXTENSION_CODE_EXPIRE_SECONDS),
    )
    db.add(code)
    db.flush()
    return raw


def consume_auth_code(db: Session, raw: str) -> User:
    code = (
        db.query(ExtensionAuthCode)
        .filter(ExtensionAuthCode.code_hash == _hash(raw))
        .first()
    )
    if not code or code.used_at is not None:
        raise UnauthorizedException("Invalid or already-used code")
    expires_at = code.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        raise UnauthorizedException("Code has expired")
    code.used_at = _now()
    db.flush()
    return db.query(User).filter(User.id == code.user_id).first()


def issue_tokens(db: Session, user: User) -> dict:
    """Create a stateless access JWT plus a persisted, rotating refresh token."""
    access_token = create_access_token(
        {"sub": str(user.id), "typ": "ext"},
        expires_delta=timedelta(minutes=settings.EXTENSION_ACCESS_EXPIRE_MINUTES),
    )
    raw_refresh = secrets.token_urlsafe(48)
    record = ExtensionToken(
        token_hash=_hash(raw_refresh),
        user_id=user.id,
        expires_at=_now() + timedelta(days=settings.EXTENSION_REFRESH_EXPIRE_DAYS),
    )
    db.add(record)
    db.flush()
    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "expires_in": settings.EXTENSION_ACCESS_EXPIRE_MINUTES * 60,
    }


def _active_refresh(db: Session, raw: str) -> ExtensionToken:
    record = (
        db.query(ExtensionToken)
        .filter(ExtensionToken.token_hash == _hash(raw))
        .first()
    )
    if not record or record.revoked_at is not None:
        raise UnauthorizedException("Invalid refresh token")
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < _now():
        raise UnauthorizedException("Refresh token expired")
    return record


def rotate_refresh(db: Session, raw: str) -> dict:
    record = _active_refresh(db, raw)
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        raise UnauthorizedException("User not found")
    # Revoke the presented token and issue a fresh pair.
    record.revoked_at = _now()
    record.last_used_at = _now()
    db.flush()
    tokens = issue_tokens(db, user)
    return {"tokens": tokens, "user": user}


def revoke_refresh(db: Session, raw: str) -> None:
    record = (
        db.query(ExtensionToken)
        .filter(ExtensionToken.token_hash == _hash(raw))
        .first()
    )
    if record and record.revoked_at is None:
        record.revoked_at = _now()
        db.flush()


def revoke_all_for_user(db: Session, user_id: int) -> int:
    """Revoke every active refresh token for a user (used by 'disconnect all')."""
    tokens = (
        db.query(ExtensionToken)
        .filter(ExtensionToken.user_id == user_id, ExtensionToken.revoked_at.is_(None))
        .all()
    )
    for token in tokens:
        token.revoked_at = _now()
    db.flush()
    return len(tokens)


def has_active_token(db: Session, user_id: int) -> bool:
    return (
        db.query(ExtensionToken)
        .filter(
            ExtensionToken.user_id == user_id,
            ExtensionToken.revoked_at.is_(None),
            ExtensionToken.expires_at > _now(),
        )
        .first()
        is not None
    )
