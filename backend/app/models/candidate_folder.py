from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin
from app.core.database import Base


class CandidateFolder(Base, TimestampMixin):
    __tablename__ = "candidate_folders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    owner = relationship("User", foreign_keys=[created_by])
    members = relationship("CandidateFolderMember", back_populates="folder", cascade="all, delete-orphan")


class CandidateFolderMember(Base):
    __tablename__ = "candidate_folder_members"
    __table_args__ = (UniqueConstraint("folder_id", "candidate_id", name="uq_folder_candidate"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    folder_id: Mapped[int] = mapped_column(ForeignKey("candidate_folders.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    added_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    folder = relationship("CandidateFolder", back_populates="members")
    candidate = relationship("Candidate")
    added_by_user = relationship("User", foreign_keys=[added_by])
