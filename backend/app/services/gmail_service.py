import base64
from email.mime.text import MIMEText
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from jose import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import BadRequestException
from app.models.outreach import UserEmailAccount
from app.services.token_encryption_service import decrypt_token, encrypt_token

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def _oauth_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def create_oauth_state(user_id: int) -> str:
    return jwt.encode(
        {"sub": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(minutes=10)},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )


def parse_oauth_state(state: str) -> int:
    payload = jwt.decode(state, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    return int(payload["sub"])


def build_connect_url(user_id: int) -> str:
    if not _oauth_configured():
        raise BadRequestException("Gmail OAuth is not configured on the server")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": settings.GOOGLE_OAUTH_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": create_oauth_state(user_id),
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code_for_tokens(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        if response.status_code != 200:
            raise BadRequestException(f"Google token exchange failed: {response.text}")
        return response.json()


async def fetch_gmail_address(access_token: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if response.status_code == 200:
            email = response.json().get("email", "")
            if email:
                return email
        raise BadRequestException(
            f"Failed to fetch Gmail address. Add userinfo.email scope and reconnect. ({response.text[:150]})"
        )


def save_gmail_account(db: Session, user_id: int, token_data: dict, email_address: str) -> UserEmailAccount:
    existing = (
        db.query(UserEmailAccount)
        .filter(UserEmailAccount.user_id == user_id, UserEmailAccount.provider == "gmail")
        .first()
    )
    expires_in = token_data.get("expires_in", 3600)
    token_expiry = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
    access_token = token_data.get("access_token", "")
    refresh_token = token_data.get("refresh_token")

    if existing:
        account = existing
    else:
        account = UserEmailAccount(user_id=user_id, provider="gmail", email_address=email_address)
        db.add(account)

    account.email_address = email_address or account.email_address
    account.access_token_encrypted = encrypt_token(access_token) if access_token else account.access_token_encrypted
    if refresh_token:
        account.refresh_token_encrypted = encrypt_token(refresh_token)
    account.token_expiry = token_expiry
    account.scopes = settings.GOOGLE_OAUTH_SCOPES
    account.status = "connected"
    account.last_error = None
    db.commit()
    db.refresh(account)
    return account


def get_user_gmail_account(db: Session, user_id: int) -> UserEmailAccount | None:
    return (
        db.query(UserEmailAccount)
        .filter(UserEmailAccount.user_id == user_id, UserEmailAccount.provider == "gmail")
        .first()
    )


def disconnect_gmail_account(db: Session, user_id: int) -> None:
    account = get_user_gmail_account(db, user_id)
    if not account:
        return
    account.status = "disconnected"
    account.access_token_encrypted = None
    account.refresh_token_encrypted = None
    account.token_expiry = None
    account.last_error = None
    db.commit()


def mark_account_invalid(db: Session, account: UserEmailAccount, error: str) -> None:
    account.status = "invalid"
    account.last_error = error[:1000]
    db.commit()


async def refresh_access_token(db: Session, account: UserEmailAccount) -> str:
    if not account.refresh_token_encrypted:
        mark_account_invalid(db, account, "Missing refresh token. Please reconnect Gmail.")
        raise BadRequestException("Gmail connection invalid. Please reconnect.")

    refresh_token = decrypt_token(account.refresh_token_encrypted)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
        if response.status_code != 200:
            mark_account_invalid(db, account, response.text)
            raise BadRequestException("Gmail token refresh failed. Please reconnect.")

        data = response.json()
        access_token = data["access_token"]
        account.access_token_encrypted = encrypt_token(access_token)
        expires_in = data.get("expires_in", 3600)
        account.token_expiry = datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))
        account.status = "connected"
        account.last_error = None
        db.commit()
        db.refresh(account)
        return access_token


async def get_valid_access_token(db: Session, account: UserEmailAccount) -> str:
    if account.status != "connected":
        raise BadRequestException("Gmail is not connected")

    if account.access_token_encrypted and account.token_expiry:
        if account.token_expiry > datetime.now(timezone.utc) + timedelta(minutes=2):
            return decrypt_token(account.access_token_encrypted)

    return await refresh_access_token(db, account)


def _build_mime_message(sender: str, recipient: str, subject: str, body: str) -> str:
    message = MIMEText(body, "plain", "utf-8")
    message["to"] = recipient
    message["from"] = sender
    message["subject"] = subject
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    return raw


async def send_gmail_message(
    db: Session,
    account: UserEmailAccount,
    recipient: str,
    subject: str,
    body: str,
) -> None:
    access_token = await get_valid_access_token(db, account)
    raw = _build_mime_message(account.email_address, recipient, subject, body)
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            GMAIL_SEND_URL,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json={"raw": raw},
        )
        if response.status_code not in (200, 202):
            error = response.text
            mark_account_invalid(db, account, error)
            raise BadRequestException(f"Gmail send failed: {error}")


def gmail_status_response(account: UserEmailAccount | None) -> dict:
    if not account or account.status == "disconnected":
        return {
            "connected": False,
            "status": "not_connected",
            "email_address": None,
            "last_connected_at": None,
            "last_error": None,
            "sent_today": 0,
            "daily_limit": settings.OUTREACH_DAILY_EMAIL_LIMIT,
        }

    status = account.status
    if status == "connected":
        display_status = "connected"
    elif status == "invalid":
        display_status = "needs_reconnect"
    else:
        display_status = "not_connected"

    return {
        "connected": status == "connected",
        "status": display_status,
        "email_address": account.email_address,
        "last_connected_at": account.updated_at.isoformat() if account.updated_at else None,
        "last_error": account.last_error,
        "sent_today": 0,
        "daily_limit": settings.OUTREACH_DAILY_EMAIL_LIMIT,
    }
