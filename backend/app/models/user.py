from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import UserRole, UserStatus


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        pg_enum(UserRole, name="user_role"), nullable=False, default=UserRole.RECRUITER
    )
    status: Mapped[UserStatus] = mapped_column(
        pg_enum(UserStatus, name="user_status"), nullable=False, default=UserStatus.ACTIVE
    )

    assigned_jobs = relationship("Job", back_populates="assigned_recruiter", foreign_keys="Job.assigned_recruiter_id")
    created_candidates = relationship("Candidate", back_populates="created_by_user")
    activity_logs = relationship("ActivityLog", back_populates="created_by_user")
    notes = relationship("Note", back_populates="created_by_user")
    email_accounts = relationship("UserEmailAccount", back_populates="user")
