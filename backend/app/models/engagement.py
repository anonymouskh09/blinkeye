from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, pg_enum
from app.models.enums import BillingModel, EngagementStatus, ServiceModel


class Engagement(Base, TimestampMixin):
    __tablename__ = "engagements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    engagement_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[EngagementStatus] = mapped_column(
        pg_enum(EngagementStatus, name="engagement_status"),
        nullable=False,
        default=EngagementStatus.ACTIVE,
        index=True,
    )
    service_model: Mapped[ServiceModel] = mapped_column(
        pg_enum(ServiceModel, name="service_model"),
        nullable=False,
        default=ServiceModel.FULL_CYCLE,
    )
    billing_model: Mapped[BillingModel] = mapped_column(
        pg_enum(BillingModel, name="billing_model"),
        nullable=False,
        default=BillingModel.SUCCESS_BASED,
    )
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="USD")
    rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    billing_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    monthly_fee: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    included_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    additional_hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    placement_fee_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    flat_placement_fee: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    guarantee_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contract_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sla: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_kpis: Mapped[str | None] = mapped_column(Text, nullable=True)
    custom_responsibilities: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    assigned_recruiter_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )

    client = relationship("Client", back_populates="engagements")
    assigned_recruiter = relationship("User", foreign_keys=[assigned_recruiter_id])
    jobs = relationship("Job", back_populates="engagement")
