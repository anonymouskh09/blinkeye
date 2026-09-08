from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class ClientHiddenMember(Base, TimestampMixin):
    """Client made private/hidden from a specific team member."""

    __tablename__ = "client_hidden_members"
    __table_args__ = (UniqueConstraint("client_id", "user_id", name="uq_client_hidden_member"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    client = relationship("Client", back_populates="hidden_members")
    user = relationship("User", foreign_keys=[user_id])
