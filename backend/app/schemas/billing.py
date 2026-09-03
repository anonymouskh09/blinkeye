from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class OfferCreate(BaseModel):
    candidate_id: int
    job_id: int
    submission_id: int | None = None
    candidate_job_assignment_id: int | None = None
    salary: Decimal = Field(gt=0)
    currency: str = "USD"
    start_date: date | None = None
    bonus: Decimal | None = None
    equity: str | None = None
    offer_date: date | None = None
    notes: str | None = None
    status: str = "sent"


class OfferUpdate(BaseModel):
    salary: Decimal | None = Field(default=None, gt=0)
    currency: str | None = None
    start_date: date | None = None
    bonus: Decimal | None = None
    equity: str | None = None
    offer_date: date | None = None
    notes: str | None = None
    status: str | None = None


class OfferAcceptRequest(BaseModel):
    acceptance_date: date | None = None
    create_placement: bool = True
    auto_invoice: bool = True


class OfferRejectRequest(BaseModel):
    rejection_date: date | None = None
    notes: str | None = None


class OfferResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    candidate_name: str | None = None
    job_id: int
    job_title: str | None = None
    client_id: int
    client_name: str | None = None
    engagement_id: int | None = None
    engagement_name: str | None = None
    submission_id: int | None = None
    candidate_job_assignment_id: int | None = None
    recruiter_id: int
    recruiter_name: str | None = None
    salary: Decimal
    currency: str
    start_date: date | None = None
    bonus: Decimal | None = None
    equity: str | None = None
    offer_date: date
    acceptance_date: date | None = None
    rejection_date: date | None = None
    status: str
    notes: str | None = None
    placement_id: int | None = None
    created_at: datetime
    updated_at: datetime


class PlacementCreate(BaseModel):
    offer_id: int | None = None
    candidate_id: int | None = None
    job_id: int | None = None
    engagement_id: int | None = None
    salary: Decimal | None = Field(default=None, gt=0)
    placement_date: date | None = None
    start_date: date | None = None
    auto_invoice: bool = True
    notes: str | None = None


class PlacementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    candidate_id: int
    candidate_name: str | None = None
    client_id: int
    client_name: str | None = None
    engagement_id: int
    engagement_name: str | None = None
    billing_model: str | None = None
    job_id: int
    job_title: str | None = None
    recruiter_id: int
    recruiter_name: str | None = None
    offer_id: int | None = None
    submission_id: int | None = None
    placement_date: date
    start_date: date | None = None
    salary: Decimal
    currency: str
    fee_percentage: Decimal | None = None
    flat_fee: Decimal | None = None
    placement_fee: Decimal
    guarantee_period_days: int | None = None
    guarantee_end_date: date | None = None
    payment_status: str
    status: str
    notes: str | None = None
    billable_item_id: int | None = None
    invoice_id: int | None = None
    created_at: datetime
    updated_at: datetime


class BillableItemCreate(BaseModel):
    engagement_id: int
    billable_type: str
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit_rate: Decimal | None = None
    amount: Decimal | None = None
    currency: str | None = None
    job_id: int | None = None
    recruiter_id: int | None = None
    placement_id: int | None = None
    billing_period_start: date | None = None
    billing_period_end: date | None = None
    notes: str | None = None


class BillableItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: str | None = None
    engagement_id: int
    engagement_name: str | None = None
    job_id: int | None = None
    job_title: str | None = None
    recruiter_id: int | None = None
    recruiter_name: str | None = None
    placement_id: int | None = None
    billable_type: str
    description: str
    quantity: Decimal
    unit_rate: Decimal
    amount: Decimal
    currency: str
    billing_period_start: date | None = None
    billing_period_end: date | None = None
    source_type: str
    status: str
    notes: str | None = None
    invoice_line_item_id: int | None = None
    created_at: datetime
    updated_at: datetime


class InvoiceCreate(BaseModel):
    client_id: int
    billable_item_ids: list[int] = Field(min_length=1)
    engagement_id: int | None = None
    issue_date: date | None = None
    due_date: date | None = None
    notes: str | None = None
    mark_sent: bool = True


class InvoiceLineItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    billable_item_id: int | None = None
    description: str
    quantity: Decimal
    unit_rate: Decimal
    amount: Decimal
    billable_type: str
    job_id: int | None = None
    recruiter_id: int | None = None
    placement_id: int | None = None


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    amount: Decimal
    currency: str
    payment_date: date
    payment_method: str
    reference: str | None = None
    notes: str | None = None
    recorded_by: int | None = None
    created_at: datetime


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_number: str
    client_id: int
    client_name: str | None = None
    engagement_id: int | None = None
    engagement_name: str | None = None
    issue_date: date
    due_date: date | None = None
    currency: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_outstanding: Decimal
    status: str
    payment_status: str
    notes: str | None = None
    line_items: list[InvoiceLineItemResponse] = []
    payments: list[PaymentResponse] = []
    created_at: datetime
    updated_at: datetime


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    payment_date: date | None = None
    payment_method: str = "bank_transfer"
    reference: str | None = None
    notes: str | None = None


class TimesheetEntryCreate(BaseModel):
    engagement_id: int
    work_date: date
    hours: Decimal = Field(gt=0, le=24)
    job_id: int | None = None
    description: str | None = Field(default=None, max_length=500)
    submit: bool = False


class TimesheetEntryUpdate(BaseModel):
    work_date: date | None = None
    hours: Decimal | None = Field(default=None, gt=0, le=24)
    job_id: int | None = None
    description: str | None = Field(default=None, max_length=500)


class TimesheetBulkAction(BaseModel):
    entry_ids: list[int] = Field(min_length=1)
    description: str | None = Field(default=None, max_length=500)


class TimesheetEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    client_name: str | None = None
    engagement_id: int
    engagement_name: str | None = None
    job_id: int | None = None
    job_title: str | None = None
    recruiter_id: int
    recruiter_name: str | None = None
    work_date: date
    hours: Decimal
    hourly_rate: Decimal | None = None
    description: str | None = None
    status: str
    billable_item_id: int | None = None
    approved_at: datetime | None = None
    approved_by: int | None = None
    created_at: datetime
    updated_at: datetime


class TimesheetApproveResponse(BaseModel):
    entries: list[TimesheetEntryResponse]
    billable_item: BillableItemResponse


class RevenueSummary(BaseModel):
    expected: Decimal
    invoiced: Decimal
    paid: Decimal
    outstanding: Decimal
    currency: str = "USD"


class RevenueBreakdownItem(BaseModel):
    key: str
    label: str
    expected: Decimal
    invoiced: Decimal
    paid: Decimal
    outstanding: Decimal


class RevenueReportResponse(BaseModel):
    summary: RevenueSummary
    by_client: list[RevenueBreakdownItem] = []
    by_engagement: list[RevenueBreakdownItem] = []
    by_job: list[RevenueBreakdownItem] = []
    by_recruiter: list[RevenueBreakdownItem] = []
    by_revenue_type: list[RevenueBreakdownItem] = []
    by_billing_model: list[RevenueBreakdownItem] = []
