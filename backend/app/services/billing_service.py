"""Billing domain helpers: fee calc, invoice/payment, revenue attribution."""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestException
from app.models.billing import (
    BillableItem,
    Invoice,
    InvoiceLineItem,
    Payment,
    RevenueEntry,
    TimesheetEntry,
)
from app.models.engagement import Engagement
from app.models.enums import (
    BillableItemStatus,
    BillableItemType,
    BillingModel,
    InvoicePaymentStatus,
    InvoiceStatus,
    OfferStatus,
    PipelineStage,
    PlacementStatus,
    RevenueType,
    SubmissionStatus,
    TimesheetStatus,
    UserRole,
)
from app.models.offer import Offer
from app.models.placement import Placement
from app.models.submission import Submission


TWOPLACES = Decimal("0.01")


def money(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return Decimal("0.00")
    return Decimal(str(value)).quantize(TWOPLACES, rounding=ROUND_HALF_UP)


def calculate_success_fee(engagement: Engagement, salary: Decimal) -> tuple[Decimal, Decimal | None, Decimal | None]:
    """Return (placement_fee, fee_percentage_used, flat_fee_used) from Engagement terms.

    Prefers percentage when set; otherwise flat fee. Hybrid/success both supported.
    """
    salary = money(salary)
    pct = engagement.placement_fee_percent
    flat = engagement.flat_placement_fee

    if pct is not None:
        fee = money(salary * (Decimal(str(pct)) / Decimal("100")))
        return fee, Decimal(str(pct)), money(flat) if flat is not None else None
    if flat is not None:
        return money(flat), None, money(flat)
    if engagement.rate is not None and engagement.billing_model in (
        BillingModel.SUCCESS_BASED,
        BillingModel.HYBRID,
        BillingModel.FIXED,
    ):
        return money(engagement.rate), None, money(engagement.rate)
    raise BadRequestException(
        "Engagement has no placement fee configuration (placement_fee_percent or flat_placement_fee)"
    )


def engagement_supports_success_fee(engagement: Engagement) -> bool:
    return engagement.billing_model in (
        BillingModel.SUCCESS_BASED,
        BillingModel.HYBRID,
    )


def engagement_supports_hourly(engagement: Engagement) -> bool:
    return engagement.billing_model in (BillingModel.HOURLY, BillingModel.HYBRID)


def engagement_supports_retainer(engagement: Engagement) -> bool:
    return engagement.billing_model in (BillingModel.MONTHLY_RETAINER, BillingModel.HYBRID)


def engagement_supports_fixed(engagement: Engagement) -> bool:
    return engagement.billing_model in (BillingModel.FIXED, BillingModel.HYBRID)


def billable_type_to_revenue_type(billable_type: BillableItemType, billing_model: BillingModel | None) -> RevenueType:
    if billing_model == BillingModel.HYBRID:
        return RevenueType.HYBRID
    mapping = {
        BillableItemType.HOURLY: RevenueType.HOURLY,
        BillableItemType.RETAINER: RevenueType.RETAINER,
        BillableItemType.SUCCESS_FEE: RevenueType.SUCCESS_FEE,
        BillableItemType.FIXED: RevenueType.FIXED,
        BillableItemType.OTHER: RevenueType.OTHER,
    }
    return mapping.get(billable_type, RevenueType.OTHER)


def next_invoice_number(db: Session) -> str:
    year = date.today().year
    prefix = f"INV-{year}-"
    last = (
        db.query(Invoice)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.invoice_number.desc())
        .first()
    )
    seq = 1
    if last and last.invoice_number.startswith(prefix):
        try:
            seq = int(last.invoice_number.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:05d}"


def create_success_fee_billable(
    db: Session,
    placement: Placement,
    engagement: Engagement,
) -> BillableItem:
    existing = (
        db.query(BillableItem)
        .filter(
            BillableItem.placement_id == placement.id,
            BillableItem.billable_type == BillableItemType.SUCCESS_FEE,
            BillableItem.status != BillableItemStatus.VOID,
        )
        .first()
    )
    if existing:
        return existing

    item = BillableItem(
        client_id=placement.client_id,
        engagement_id=placement.engagement_id,
        job_id=placement.job_id,
        recruiter_id=placement.recruiter_id,
        placement_id=placement.id,
        billable_type=BillableItemType.SUCCESS_FEE,
        description=f"Success fee — placement #{placement.id}",
        quantity=Decimal("1"),
        unit_rate=money(placement.placement_fee),
        amount=money(placement.placement_fee),
        currency=placement.currency or engagement.currency or "USD",
        source_type="placement",
        status=BillableItemStatus.APPROVED,
    )
    db.add(item)
    db.flush()
    return item


def create_fixed_billable(
    db: Session,
    engagement: Engagement,
    *,
    amount: Decimal | None = None,
    description: str | None = None,
    job_id: int | None = None,
    recruiter_id: int | None = None,
) -> BillableItem:
    fee = money(amount if amount is not None else (engagement.rate or engagement.flat_placement_fee or 0))
    if fee <= 0:
        raise BadRequestException("Fixed fee amount must be greater than zero")
    item = BillableItem(
        client_id=engagement.client_id,
        engagement_id=engagement.id,
        job_id=job_id,
        recruiter_id=recruiter_id or engagement.assigned_recruiter_id,
        billable_type=BillableItemType.FIXED,
        description=description or f"Fixed fee — {engagement.engagement_name}",
        quantity=Decimal("1"),
        unit_rate=fee,
        amount=fee,
        currency=engagement.currency or "USD",
        source_type="fixed",
        status=BillableItemStatus.APPROVED,
    )
    db.add(item)
    db.flush()
    return item


def create_retainer_billable(
    db: Session,
    engagement: Engagement,
    period_start: date,
    period_end: date,
    *,
    amount: Decimal | None = None,
) -> BillableItem:
    fee = money(amount if amount is not None else (engagement.monthly_fee or engagement.rate or 0))
    if fee <= 0:
        raise BadRequestException("Retainer amount must be greater than zero")
    item = BillableItem(
        client_id=engagement.client_id,
        engagement_id=engagement.id,
        recruiter_id=engagement.assigned_recruiter_id,
        billable_type=BillableItemType.RETAINER,
        description=f"Monthly retainer {period_start.isoformat()} → {period_end.isoformat()}",
        quantity=Decimal("1"),
        unit_rate=fee,
        amount=fee,
        currency=engagement.currency or "USD",
        billing_period_start=period_start,
        billing_period_end=period_end,
        source_type="retainer",
        status=BillableItemStatus.APPROVED,
    )
    db.add(item)
    db.flush()
    return item


def create_hourly_billable(
    db: Session,
    engagement: Engagement,
    hours: Decimal,
    *,
    hourly_rate: Decimal | None = None,
    job_id: int | None = None,
    recruiter_id: int | None = None,
    period_start: date | None = None,
    period_end: date | None = None,
    description: str | None = None,
) -> BillableItem:
    hours = money(hours)
    rate = money(hourly_rate if hourly_rate is not None else (engagement.hourly_rate or engagement.rate or 0))
    if hours <= 0 or rate <= 0:
        raise BadRequestException("Hours and hourly rate must be greater than zero")
    amount = money(hours * rate)
    item = BillableItem(
        client_id=engagement.client_id,
        engagement_id=engagement.id,
        job_id=job_id,
        recruiter_id=recruiter_id or engagement.assigned_recruiter_id,
        billable_type=BillableItemType.HOURLY,
        description=description or f"Hourly recruiting — {hours}h @ {rate}",
        quantity=hours,
        unit_rate=rate,
        amount=amount,
        currency=engagement.currency or "USD",
        billing_period_start=period_start,
        billing_period_end=period_end,
        source_type="timesheet",
        status=BillableItemStatus.APPROVED,
    )
    db.add(item)
    db.flush()
    return item


def create_invoice_from_billables(
    db: Session,
    *,
    client_id: int,
    billable_ids: list[int],
    engagement_id: int | None = None,
    issue_date: date | None = None,
    due_date: date | None = None,
    notes: str | None = None,
    created_by: int | None = None,
    mark_sent: bool = True,
) -> Invoice:
    if not billable_ids:
        raise BadRequestException("At least one billable item is required")

    items = (
        db.query(BillableItem)
        .filter(BillableItem.id.in_(billable_ids), BillableItem.client_id == client_id)
        .all()
    )
    if len(items) != len(set(billable_ids)):
        raise BadRequestException("One or more billable items not found for this client")

    for item in items:
        if item.status == BillableItemStatus.VOID:
            raise BadRequestException(f"Billable item #{item.id} is void")
        if item.status == BillableItemStatus.INVOICED:
            raise BadRequestException(f"Billable item #{item.id} is already invoiced")
        if engagement_id is None:
            engagement_id = item.engagement_id

    currency = items[0].currency
    issue = issue_date or date.today()
    subtotal = money(sum((item.amount for item in items), Decimal("0")))
    invoice = Invoice(
        invoice_number=next_invoice_number(db),
        client_id=client_id,
        engagement_id=engagement_id,
        issue_date=issue,
        due_date=due_date,
        currency=currency,
        subtotal=subtotal,
        tax=Decimal("0.00"),
        total=subtotal,
        amount_paid=Decimal("0.00"),
        amount_outstanding=subtotal,
        status=InvoiceStatus.SENT if mark_sent else InvoiceStatus.DRAFT,
        payment_status=InvoicePaymentStatus.PENDING,
        notes=notes,
        created_by=created_by,
    )
    db.add(invoice)
    db.flush()

    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first() if engagement_id else None

    for item in items:
        line = InvoiceLineItem(
            invoice_id=invoice.id,
            billable_item_id=item.id,
            description=item.description,
            quantity=item.quantity,
            unit_rate=item.unit_rate,
            amount=item.amount,
            billable_type=item.billable_type,
            job_id=item.job_id,
            recruiter_id=item.recruiter_id,
            placement_id=item.placement_id,
        )
        db.add(line)
        db.flush()
        item.status = BillableItemStatus.INVOICED

        revenue = RevenueEntry(
            client_id=client_id,
            engagement_id=item.engagement_id,
            job_id=item.job_id,
            recruiter_id=item.recruiter_id,
            placement_id=item.placement_id,
            invoice_id=invoice.id,
            invoice_line_item_id=line.id,
            billable_item_id=item.id,
            billing_model=engagement.billing_model.value if engagement else None,
            revenue_type=billable_type_to_revenue_type(
                item.billable_type, engagement.billing_model if engagement else None
            ),
            expected_amount=item.amount,
            invoiced_amount=item.amount,
            paid_amount=Decimal("0.00"),
            currency=currency,
            period_date=issue,
        )
        db.add(revenue)

        if item.placement_id:
            placement = db.query(Placement).filter(Placement.id == item.placement_id).first()
            if placement and placement.payment_status == InvoicePaymentStatus.PENDING:
                pass  # stays pending until payment

    db.flush()
    return invoice


def refresh_invoice_payment_state(db: Session, invoice: Invoice) -> None:
    paid = money(
        sum((p.amount for p in invoice.payments), Decimal("0"))
        if invoice.payments is not None
        else Decimal("0")
    )
    # reload payments if needed
    payments = db.query(Payment).filter(Payment.invoice_id == invoice.id).all()
    paid = money(sum((p.amount for p in payments), Decimal("0")))
    invoice.amount_paid = paid
    invoice.amount_outstanding = money(invoice.total - paid)

    if invoice.status == InvoiceStatus.VOID:
        return

    if paid <= 0:
        invoice.payment_status = InvoicePaymentStatus.PENDING
        if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.OVERDUE):
            invoice.status = InvoiceStatus.SENT
    elif paid < invoice.total:
        invoice.payment_status = InvoicePaymentStatus.PARTIAL
        invoice.status = InvoiceStatus.PARTIALLY_PAID
    else:
        invoice.payment_status = InvoicePaymentStatus.PAID
        invoice.status = InvoiceStatus.PAID

    # Allocate paid amounts across revenue entries proportionally
    lines = db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice.id).all()
    total = money(invoice.total) or Decimal("0.01")
    remaining = paid
    for i, line in enumerate(lines):
        entry = (
            db.query(RevenueEntry)
            .filter(RevenueEntry.invoice_line_item_id == line.id)
            .first()
        )
        if not entry:
            continue
        if i == len(lines) - 1:
            share = remaining
        else:
            share = money(paid * (line.amount / total))
            remaining = money(remaining - share)
        entry.paid_amount = min(share, entry.invoiced_amount)
        if invoice.payment_status == InvoicePaymentStatus.PAID:
            entry.recognized_at = datetime.now(timezone.utc)
            if entry.placement_id:
                placement = db.query(Placement).filter(Placement.id == entry.placement_id).first()
                if placement:
                    placement.payment_status = InvoicePaymentStatus.PAID
        elif invoice.payment_status == InvoicePaymentStatus.PARTIAL and entry.placement_id:
            placement = db.query(Placement).filter(Placement.id == entry.placement_id).first()
            if placement:
                placement.payment_status = InvoicePaymentStatus.PARTIAL


def record_payment(
    db: Session,
    invoice: Invoice,
    *,
    amount: Decimal,
    payment_date: date,
    payment_method,
    reference: str | None = None,
    notes: str | None = None,
    recorded_by: int | None = None,
) -> Payment:
    amount = money(amount)
    if amount <= 0:
        raise BadRequestException("Payment amount must be greater than zero")
    if invoice.status == InvoiceStatus.VOID:
        raise BadRequestException("Cannot record payment on a void invoice")

    payment = Payment(
        invoice_id=invoice.id,
        amount=amount,
        currency=invoice.currency,
        payment_date=payment_date,
        payment_method=payment_method,
        reference=reference,
        notes=notes,
        recorded_by=recorded_by,
    )
    db.add(payment)
    db.flush()
    refresh_invoice_payment_state(db, invoice)
    return payment


def create_placement_from_accepted_offer(
    db: Session,
    offer: Offer,
    engagement: Engagement,
    *,
    placement_date: date | None = None,
    recruiter_id: int | None = None,
    auto_invoice: bool = False,
    created_by: int | None = None,
) -> tuple[Placement, BillableItem | None, Invoice | None]:
    if offer.status != OfferStatus.ACCEPTED:
        raise BadRequestException("Offer must be accepted before creating a placement")

    existing = db.query(Placement).filter(Placement.offer_id == offer.id).first()
    if existing:
        billable = (
            db.query(BillableItem)
            .filter(
                BillableItem.placement_id == existing.id,
                BillableItem.billable_type == BillableItemType.SUCCESS_FEE,
                BillableItem.status != BillableItemStatus.VOID,
            )
            .first()
        )
        return existing, billable, None

    fee, pct, flat = calculate_success_fee(engagement, offer.salary)
    place_date = placement_date or offer.acceptance_date or date.today()
    guarantee_days = engagement.guarantee_period_days
    guarantee_end = None
    start = offer.start_date
    if guarantee_days and start:
        guarantee_end = start + timedelta(days=guarantee_days)

    placement = Placement(
        candidate_id=offer.candidate_id,
        client_id=offer.client_id,
        engagement_id=engagement.id,
        job_id=offer.job_id,
        recruiter_id=recruiter_id or offer.recruiter_id,
        offer_id=offer.id,
        submission_id=offer.submission_id,
        candidate_job_assignment_id=offer.candidate_job_assignment_id,
        placement_date=place_date,
        start_date=start,
        salary=money(offer.salary),
        currency=offer.currency or engagement.currency or "USD",
        fee_percentage=pct,
        flat_fee=flat,
        placement_fee=fee,
        guarantee_period_days=guarantee_days,
        guarantee_end_date=guarantee_end,
        payment_status=InvoicePaymentStatus.PENDING,
        status=PlacementStatus.ACTIVE,
    )
    db.add(placement)
    db.flush()

    if offer.candidate_job_assignment_id:
        from app.models.candidate_job import CandidateJobAssignment

        assignment = (
            db.query(CandidateJobAssignment)
            .filter(CandidateJobAssignment.id == offer.candidate_job_assignment_id)
            .first()
        )
        if assignment:
            assignment.status = PipelineStage.HIRED

    if offer.submission_id:
        submission = db.query(Submission).filter(Submission.id == offer.submission_id).first()
        if submission:
            submission.status = SubmissionStatus.PLACED

    billable = None
    invoice = None
    if engagement_supports_success_fee(engagement):
        billable = create_success_fee_billable(db, placement, engagement)
        if auto_invoice and billable:
            invoice = create_invoice_from_billables(
                db,
                client_id=placement.client_id,
                billable_ids=[billable.id],
                engagement_id=engagement.id,
                created_by=created_by,
            )

    return placement, billable, invoice


def engagement_hourly_rate(engagement: Engagement) -> Decimal:
    rate = money(engagement.hourly_rate or engagement.rate or 0)
    if rate <= 0:
        raise BadRequestException(
            "Engagement has no hourly rate configured (hourly_rate or rate)"
        )
    return rate


def create_timesheet_entry(
    db: Session,
    engagement: Engagement,
    *,
    recruiter_id: int,
    work_date: date,
    hours: Decimal,
    job_id: int | None = None,
    description: str | None = None,
    status: TimesheetStatus = TimesheetStatus.PENDING,
) -> TimesheetEntry:
    if not engagement_supports_hourly(engagement):
        raise BadRequestException(
            f"Engagement billing model '{engagement.billing_model.value}' does not support hourly timesheets"
        )
    hours = money(hours)
    if hours <= 0:
        raise BadRequestException("Hours must be greater than zero")
    if hours > Decimal("24"):
        raise BadRequestException("Hours for a single day cannot exceed 24")

    rate = engagement_hourly_rate(engagement)
    entry = TimesheetEntry(
        client_id=engagement.client_id,
        engagement_id=engagement.id,
        job_id=job_id,
        recruiter_id=recruiter_id,
        work_date=work_date,
        hours=hours,
        hourly_rate=rate,
        description=description,
        status=status.value,
    )
    db.add(entry)
    db.flush()
    return entry


def submit_timesheet_entries(
    db: Session,
    entries: list[TimesheetEntry],
    *,
    actor_id: int,
    actor_role: UserRole | str,
) -> list[TimesheetEntry]:
    if not entries:
        raise BadRequestException("No timesheet entries to submit")
    role = actor_role.value if hasattr(actor_role, "value") else str(actor_role)
    for entry in entries:
        if role == UserRole.RECRUITER.value and entry.recruiter_id != actor_id:
            raise BadRequestException(f"Cannot submit timesheet #{entry.id} owned by another recruiter")
        if entry.billable_item_id is not None:
            raise BadRequestException(f"Timesheet #{entry.id} is already billed")
        if entry.status not in (TimesheetStatus.PENDING.value, TimesheetStatus.REJECTED.value):
            raise BadRequestException(
                f"Timesheet #{entry.id} cannot be submitted from status '{entry.status}'"
            )
        entry.status = TimesheetStatus.SUBMITTED.value
        entry.approved_at = None
        entry.approved_by = None
    db.flush()
    return entries


def reject_timesheet_entries(
    db: Session,
    entries: list[TimesheetEntry],
    *,
    actor_id: int,
) -> list[TimesheetEntry]:
    if not entries:
        raise BadRequestException("No timesheet entries to reject")
    for entry in entries:
        if entry.billable_item_id is not None:
            raise BadRequestException(f"Timesheet #{entry.id} is already billed and cannot be rejected")
        if entry.status != TimesheetStatus.SUBMITTED.value:
            raise BadRequestException(
                f"Timesheet #{entry.id} must be submitted before it can be rejected"
            )
        entry.status = TimesheetStatus.REJECTED.value
        entry.approved_at = datetime.now(timezone.utc)
        entry.approved_by = actor_id
    db.flush()
    return entries


def approve_timesheet_entries(
    db: Session,
    entries: list[TimesheetEntry],
    *,
    actor_id: int,
    description: str | None = None,
) -> tuple[list[TimesheetEntry], BillableItem]:
    """Approve submitted hours and create one Hourly BillableItem (idempotent)."""
    if not entries:
        raise BadRequestException("No timesheet entries to approve")

    # Idempotent: if all already approved and share the same billable, return it
    billed_ids = {e.billable_item_id for e in entries if e.billable_item_id}
    if len(billed_ids) == 1 and all(e.status == TimesheetStatus.APPROVED.value for e in entries):
        billable = db.query(BillableItem).filter(BillableItem.id == next(iter(billed_ids))).first()
        if billable and billable.status != BillableItemStatus.VOID:
            return entries, billable
    if any(e.billable_item_id is not None for e in entries):
        raise BadRequestException("One or more timesheet entries are already billed")

    engagement_ids = {e.engagement_id for e in entries}
    if len(engagement_ids) != 1:
        raise BadRequestException("All timesheet entries must belong to the same engagement")
    client_ids = {e.client_id for e in entries}
    if len(client_ids) != 1:
        raise BadRequestException("All timesheet entries must belong to the same client")

    for entry in entries:
        if entry.status != TimesheetStatus.SUBMITTED.value:
            raise BadRequestException(
                f"Timesheet #{entry.id} must be submitted before approval (got '{entry.status}')"
            )

    engagement = db.query(Engagement).filter(Engagement.id == next(iter(engagement_ids))).first()
    if not engagement:
        raise BadRequestException("Engagement not found")
    if not engagement_supports_hourly(engagement):
        raise BadRequestException("Engagement does not support hourly billing")

    rate = engagement_hourly_rate(engagement)
    total_hours = money(sum((money(e.hours) for e in entries), Decimal("0")))
    if total_hours <= 0:
        raise BadRequestException("Approved hours must be greater than zero")

    work_dates = [e.work_date for e in entries]
    period_start = min(work_dates)
    period_end = max(work_dates)
    job_ids = {e.job_id for e in entries if e.job_id}
    job_id = next(iter(job_ids)) if len(job_ids) == 1 else None
    recruiter_ids = {e.recruiter_id for e in entries}
    recruiter_id = next(iter(recruiter_ids)) if len(recruiter_ids) == 1 else None

    # Snapshot rate onto entries for audit
    for entry in entries:
        entry.hourly_rate = rate

    billable = create_hourly_billable(
        db,
        engagement,
        total_hours,
        hourly_rate=rate,
        job_id=job_id,
        recruiter_id=recruiter_id,
        period_start=period_start,
        period_end=period_end,
        description=description
        or f"Approved timesheet — {total_hours}h @ {rate} ({period_start.isoformat()} → {period_end.isoformat()})",
    )

    now = datetime.now(timezone.utc)
    for entry in entries:
        entry.status = TimesheetStatus.APPROVED.value
        entry.billable_item_id = billable.id
        entry.approved_at = now
        entry.approved_by = actor_id

    db.flush()
    return entries, billable

