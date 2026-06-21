from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import ClientStage, ClientStatus


class Client(Base, TimestampMixin):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_person: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ClientStatus] = mapped_column(
        pg_enum(ClientStatus, name="client_status"), nullable=False, default=ClientStatus.ACTIVE
    )
    stage: Mapped[ClientStage] = mapped_column(
        pg_enum(ClientStage, name="client_stage"), nullable=False, default=ClientStage.PROSPECT, index=True
    )
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    custom_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="public")

    owner = relationship("User", foreign_keys=[owner_id])
    jobs = relationship("Job", back_populates="client")
    contacts = relationship("ClientContact", back_populates="client", cascade="all, delete-orphan")
    team_members = relationship("ClientTeamMember", back_populates="client", cascade="all, delete-orphan")
    guests = relationship("ClientGuest", back_populates="client", cascade="all, delete-orphan")
    attachments = relationship("ClientAttachment", back_populates="client", cascade="all, delete-orphan")
    activities = relationship("ClientActivity", back_populates="client", cascade="all, delete-orphan")
