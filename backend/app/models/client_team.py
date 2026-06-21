from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class ClientTeamMember(Base, TimestampMixin):
    __tablename__ = "client_team_members"
    __table_args__ = (UniqueConstraint("client_id", "user_id", name="uq_client_team"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    client = relationship("Client", back_populates="team_members")
    user = relationship("User", foreign_keys=[user_id])
