from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = ""


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


def success_response(data: Any = None, message: str = "") -> dict:
    return {"success": True, "data": data, "message": message}


def paginate(total: int, page: int, page_size: int) -> PaginationMeta:
    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginationMeta(
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )
