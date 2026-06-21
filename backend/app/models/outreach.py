from datetime import date, datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class UserEmailAccount(Base, TimestampMixin):
    __tablename__ = "user_email_accounts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(20), nullable=False, default="gmail")
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="connected")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    user = relationship("User", back_populates="email_accounts")


class OutreachSequence(Base, TimestampMixin):
    __tablename__ = "outreach_sequences"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    sender_account_id: Mapped[int | None] = mapped_column(ForeignKey("user_email_accounts.id"), nullable=True)

    created_by = relationship("User", foreign_keys=[created_by_user_id])
    sender_account = relationship("UserEmailAccount")
    steps = relationship(
        "OutreachSequenceStep",
        back_populates="sequence",
        cascade="all, delete-orphan",
        order_by="OutreachSequenceStep.step_number",
    )
    enrollments = relationship("OutreachEnrollment", back_populates="sequence", cascade="all, delete-orphan")


class OutreachSequenceStep(Base, TimestampMixin):
    __tablename__ = "outreach_sequence_steps"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sequence_id: Mapped[int] = mapped_column(ForeignKey("outreach_sequences.id"), nullable=False, index=True)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    step_name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    delay_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    sequence = relationship("OutreachSequence", back_populates="steps")


class OutreachEnrollment(Base, TimestampMixin):
    __tablename__ = "outreach_enrollments"
    __table_args__ = (UniqueConstraint("sequence_id", "candidate_id", name="uq_outreach_enrollment_candidate"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sequence_id: Mapped[int] = mapped_column(ForeignKey("outreach_sequences.id"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    sequence = relationship("OutreachSequence", back_populates="enrollments")
    candidate = relationship("Candidate")


class OutreachEmailLog(Base, TimestampMixin):
    __tablename__ = "outreach_email_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sequence_id: Mapped[int] = mapped_column(ForeignKey("outreach_sequences.id"), nullable=False, index=True)
    step_id: Mapped[int | None] = mapped_column(ForeignKey("outreach_sequence_steps.id"), nullable=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False, index=True)
    sender_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    sender_email: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_email: Mapped[str] = mapped_column(String(255), nullable=False)
    rendered_subject: Mapped[str] = mapped_column(String(500), nullable=False)
    rendered_body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
