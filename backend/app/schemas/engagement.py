from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import BillingModel, EngagementStatus, ServiceModel


class EngagementBase(BaseModel):
    engagement_name: str = Field(min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: EngagementStatus = EngagementStatus.ACTIVE
    service_model: ServiceModel = ServiceModel.FULL_CYCLE
    billing_model: BillingModel = BillingModel.SUCCESS_BASED
    currency: str = Field(default="USD", min_length=1, max_length=10)
    rate: Decimal | None = None
    hourly_rate: Decimal | None = None
    billing_period: str | None = Field(default=None, max_length=50)
    monthly_fee: Decimal | None = None
    included_hours: int | None = Field(default=None, ge=0)
    additional_hourly_rate: Decimal | None = None
    placement_fee_percent: Decimal | None = None
    flat_placement_fee: Decimal | None = None
    guarantee_period_days: int | None = Field(default=None, ge=0)
    payment_terms: str | None = Field(default=None, max_length=255)
    contract_reference: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    sla: str | None = None
    target_kpis: str | None = None
    custom_responsibilities: list[str] | None = None
    assigned_recruiter_id: int | None = None

    @model_validator(mode="after")
    def validate_dates_and_billing(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        if self.service_model == ServiceModel.CUSTOM:
            if self.custom_responsibilities is None:
                self.custom_responsibilities = []
        if self.billing_model == BillingModel.HOURLY and self.hourly_rate is None and self.rate is not None:
            self.hourly_rate = self.rate
        if self.billing_model == BillingModel.MONTHLY_RETAINER and self.monthly_fee is None and self.rate is not None:
            self.monthly_fee = self.rate
        if self.billing_model == BillingModel.SUCCESS_BASED:
            if self.placement_fee_percent is None and self.flat_placement_fee is None and self.rate is not None:
                self.flat_placement_fee = self.rate
        if self.billing_model == BillingModel.FIXED and self.rate is None and self.flat_placement_fee is not None:
            self.rate = self.flat_placement_fee
        return self


class EngagementCreate(EngagementBase):
    client_id: int


class EngagementUpdate(BaseModel):
    engagement_name: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    status: EngagementStatus | None = None
    service_model: ServiceModel | None = None
    billing_model: BillingModel | None = None
    currency: str | None = Field(default=None, min_length=1, max_length=10)
    rate: Decimal | None = None
    hourly_rate: Decimal | None = None
    billing_period: str | None = None
    monthly_fee: Decimal | None = None
    included_hours: int | None = Field(default=None, ge=0)
    additional_hourly_rate: Decimal | None = None
    placement_fee_percent: Decimal | None = None
    flat_placement_fee: Decimal | None = None
    guarantee_period_days: int | None = Field(default=None, ge=0)
    payment_terms: str | None = None
    contract_reference: str | None = None
    notes: str | None = None
    sla: str | None = None
    target_kpis: str | None = None
    custom_responsibilities: list[str] | None = None
    assigned_recruiter_id: int | None = None


class EngagementJobSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    status: str
    location: str | None = None
    candidate_count: int = 0
    assigned_recruiter_name: str | None = None
    created_at: datetime


class EngagementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: str | None = None
    engagement_name: str
    start_date: date | None = None
    end_date: date | None = None
    status: EngagementStatus
    service_model: ServiceModel
    billing_model: BillingModel
    currency: str
    rate: Decimal | None = None
    hourly_rate: Decimal | None = None
    billing_period: str | None = None
    monthly_fee: Decimal | None = None
    included_hours: int | None = None
    additional_hourly_rate: Decimal | None = None
    placement_fee_percent: Decimal | None = None
    flat_placement_fee: Decimal | None = None
    guarantee_period_days: int | None = None
    payment_terms: str | None = None
    contract_reference: str | None = None
    notes: str | None = None
    sla: str | None = None
    target_kpis: str | None = None
    custom_responsibilities: list[str] | None = None
    assigned_recruiter_id: int | None = None
    assigned_recruiter_name: str | None = None
    job_count: int = 0
    jobs: list[EngagementJobSummary] = []
    created_at: datetime
    updated_at: datetime
