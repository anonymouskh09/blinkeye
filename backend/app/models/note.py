from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import EntityType


class Note(Base, TimestampMixin):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    entity_type: Mapped[EntityType] = mapped_column(pg_enum(EntityType, name="note_entity_type"), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category_type: Mapped[str] = mapped_column(String(20), nullable=False, default="general")
    category_ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shared_with_guest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    created_by_user = relationship("User", back_populates="notes")
