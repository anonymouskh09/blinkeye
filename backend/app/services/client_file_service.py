import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import BadRequestException

MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".txt"}


def get_client_upload_dir(client_id: int) -> Path:
    path = Path(settings.UPLOAD_DIR) / "clients" / str(client_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_client_attachment(file: UploadFile, client_id: int) -> tuple[str, str, int]:
    if not file.filename:
        raise BadRequestException("No file provided")
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestException("File type not allowed")
    content = await file.read()
    if len(content) > MAX_ATTACHMENT_SIZE:
        raise BadRequestException("File exceeds 10MB limit")
    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"
    full_path = get_client_upload_dir(client_id) / safe_name
    with open(full_path, "wb") as f:
        f.write(content)
    relative = str(Path("clients") / str(client_id) / safe_name)
    return relative, file.filename, len(content)


def get_attachment_full_path(relative_path: str) -> Path:
    return Path(settings.UPLOAD_DIR) / relative_path


def delete_attachment_file(relative_path: str) -> None:
    full = get_attachment_full_path(relative_path)
    if full.exists():
        os.remove(full)
