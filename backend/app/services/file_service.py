import os
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import BadRequestException

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 10 * 1024 * 1024


def get_upload_base_path() -> Path:
    path = Path(settings.UPLOAD_DIR) / "cvs"
    path.mkdir(parents=True, exist_ok=True)
    return path


async def save_cv_file(file: UploadFile, candidate_id: int) -> str:
    if not file.filename:
        raise BadRequestException("No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise BadRequestException("Only PDF, DOC, and DOCX files are allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise BadRequestException("File size exceeds 10MB limit")

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise BadRequestException("Invalid file type")

    candidate_dir = get_upload_base_path() / str(candidate_id)
    candidate_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"
    file_path = candidate_dir / safe_name

    with open(file_path, "wb") as f:
        f.write(content)

    return str(Path("cvs") / str(candidate_id) / safe_name)


def get_cv_full_path(relative_path: str) -> Path:
    return Path(settings.UPLOAD_DIR) / relative_path


def delete_cv_file(relative_path: str) -> None:
    full_path = get_cv_full_path(relative_path)
    if full_path.exists():
        os.remove(full_path)
