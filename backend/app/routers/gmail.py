from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException
from app.core.response import success_response
from app.models.user import User
from app.services.gmail_service import (
    build_connect_url,
    disconnect_gmail_account,
    exchange_code_for_tokens,
    fetch_gmail_address,
    get_user_gmail_account,
    gmail_status_response,
    parse_oauth_state,
    save_gmail_account,
)
from app.services.outreach_service import count_sent_today

router = APIRouter(prefix="/gmail", tags=["gmail"])


@router.get("/connect")
def connect_gmail(
    current_user: User = Depends(get_current_user),
):
    url = build_connect_url(current_user.id)
    return RedirectResponse(url=url)


@router.get("/callback")
async def gmail_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    redirect_base = f"{settings.FRONTEND_URL}/outreach"
    if error:
        return RedirectResponse(url=f"{redirect_base}?gmail=error&message={error}")
    if not code or not state:
        return RedirectResponse(url=f"{redirect_base}?gmail=error&message=missing_code")

    try:
        user_id = parse_oauth_state(state)
        token_data = await exchange_code_for_tokens(code)
        access_token = token_data.get("access_token")
        if not access_token:
            raise BadRequestException("No access token received")
        email_address = await fetch_gmail_address(access_token)
        save_gmail_account(db, user_id, token_data, email_address)
        return RedirectResponse(url=f"{redirect_base}?gmail=connected")
    except Exception as exc:
        return RedirectResponse(url=f"{redirect_base}?gmail=error&message={str(exc)[:200]}")


@router.get("/status")
def gmail_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = get_user_gmail_account(db, current_user.id)
    data = gmail_status_response(account)
    data["sent_today"] = count_sent_today(db, current_user.id)
    return success_response(data=data, message="Gmail status retrieved")


@router.post("/disconnect")
def gmail_disconnect(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    disconnect_gmail_account(db, current_user.id)
    return success_response(message="Gmail disconnected")
