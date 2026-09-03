from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.billing import BillableItem, Invoice, InvoiceLineItem, Payment, RevenueEntry
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import (
    BillableItemStatus,
    BillableItemType,
    PaymentMethod,
    UserRole,
)
from app.models.job import Job
from app.models.user import User
from app.schemas.billing import (
    BillableItemCreate,
    BillableItemResponse,
    InvoiceCreate,
    InvoiceLineItemResponse,
    InvoiceResponse,
    PaymentCreate,
    PaymentResponse,
    RevenueBreakdownItem,
    RevenueReportResponse,
    RevenueSummary,
)
from app.services.billing_service import (
    create_fixed_billable,
    create_hourly_billable,
    create_invoice_from_billables,
    create_retainer_billable,
    money,
    record_payment,
)

router = APIRouter(tags=["billing"])


def _billable_response(item: BillableItem, db: Session) -> BillableItemResponse:
    client = db.query(Client).filter(Client.id == item.client_id).first()
    engagement = db.query(Engagement).filter(Engagement.id == item.engagement_id).first()
    job = db.query(Job).filter(Job.id == item.job_id).first() if item.job_id else None
    recruiter = db.query(User).filter(User.id == item.recruiter_id).first() if item.recruiter_id else None
    line = (
        db.query(InvoiceLineItem)
        .filter(InvoiceLineItem.billable_item_id == item.id)
        .first()
    )
    return BillableItemResponse(
        id=item.id,
        client_id=item.client_id,
        client_name=client.company_name if client else None,
        engagement_id=item.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        job_id=item.job_id,
        job_title=job.title if job else None,
        recruiter_id=item.recruiter_id,
        recruiter_name=recruiter.name if recruiter else None,
        placement_id=item.placement_id,
        billable_type=item.billable_type.value,
        description=item.description,
        quantity=item.quantity,
        unit_rate=item.unit_rate,
        amount=item.amount,
        currency=item.currency,
        billing_period_start=item.billing_period_start,
        billing_period_end=item.billing_period_end,
        source_type=item.source_type,
        status=item.status.value,
        notes=item.notes,
        invoice_line_item_id=line.id if line else None,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _invoice_response(invoice: Invoice, db: Session) -> InvoiceResponse:
    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    engagement = (
        db.query(Engagement).filter(Engagement.id == invoice.engagement_id).first()
        if invoice.engagement_id
        else None
    )
    lines = db.query(InvoiceLineItem).filter(InvoiceLineItem.invoice_id == invoice.id).all()
    payments = db.query(Payment).filter(Payment.invoice_id == invoice.id).order_by(Payment.payment_date).all()
    return InvoiceResponse(
        id=invoice.id,
        invoice_number=invoice.invoice_number,
        client_id=invoice.client_id,
        client_name=client.company_name if client else None,
        engagement_id=invoice.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        currency=invoice.currency,
        subtotal=invoice.subtotal,
        tax=invoice.tax,
        total=invoice.total,
        amount_paid=invoice.amount_paid,
        amount_outstanding=invoice.amount_outstanding,
        status=invoice.status.value,
        payment_status=invoice.payment_status.value,
        notes=invoice.notes,
        line_items=[
            InvoiceLineItemResponse(
                id=l.id,
                billable_item_id=l.billable_item_id,
                description=l.description,
                quantity=l.quantity,
                unit_rate=l.unit_rate,
                amount=l.amount,
                billable_type=l.billable_type.value,
                job_id=l.job_id,
                recruiter_id=l.recruiter_id,
                placement_id=l.placement_id,
            )
            for l in lines
        ],
        payments=[
            PaymentResponse(
                id=p.id,
                invoice_id=p.invoice_id,
                amount=p.amount,
                currency=p.currency,
                payment_date=p.payment_date,
                payment_method=p.payment_method.value,
                reference=p.reference,
                notes=p.notes,
                recorded_by=p.recorded_by,
                created_at=p.created_at,
            )
            for p in payments
        ],
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
    )


@router.get("/billable-items")
def list_billable_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: int | None = None,
    engagement_id: int | None = None,
    status: str | None = None,
    billable_type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(BillableItem)
    if client_id:
        q = q.filter(BillableItem.client_id == client_id)
    if engagement_id:
        q = q.filter(BillableItem.engagement_id == engagement_id)
    if status:
        q = q.filter(BillableItem.status == status)
    if billable_type:
        q = q.filter(BillableItem.billable_type == billable_type)
    total = q.count()
    items = q.order_by(BillableItem.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return success_response(
        data={
            "items": [_billable_response(i, db) for i in items],
            **paginate(total, page, page_size).model_dump(),
        }
    )


@router.post("/billable-items")
def create_billable_item(
    body: BillableItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement = db.query(Engagement).filter(Engagement.id == body.engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")

    btype = BillableItemType(body.billable_type)
    if btype == BillableItemType.HOURLY:
        item = create_hourly_billable(
            db,
            engagement,
            body.quantity,
            hourly_rate=body.unit_rate,
            job_id=body.job_id,
            recruiter_id=body.recruiter_id or current_user.id,
            period_start=body.billing_period_start,
            period_end=body.billing_period_end,
            description=body.description,
        )
    elif btype == BillableItemType.RETAINER:
        if not body.billing_period_start or not body.billing_period_end:
            raise BadRequestException("Retainer billable requires billing_period_start and billing_period_end")
        item = create_retainer_billable(
            db,
            engagement,
            body.billing_period_start,
            body.billing_period_end,
            amount=body.amount or body.unit_rate,
        )
        item.description = body.description
    elif btype == BillableItemType.FIXED:
        item = create_fixed_billable(
            db,
            engagement,
            amount=body.amount or body.unit_rate,
            description=body.description,
            job_id=body.job_id,
            recruiter_id=body.recruiter_id,
        )
    else:
        qty = money(body.quantity)
        rate = money(body.unit_rate if body.unit_rate is not None else body.amount or 0)
        amount = money(body.amount if body.amount is not None else qty * rate)
        item = BillableItem(
            client_id=engagement.client_id,
            engagement_id=engagement.id,
            job_id=body.job_id,
            recruiter_id=body.recruiter_id or current_user.id,
            placement_id=body.placement_id,
            billable_type=btype,
            description=body.description,
            quantity=qty,
            unit_rate=rate,
            amount=amount,
            currency=body.currency or engagement.currency or "USD",
            billing_period_start=body.billing_period_start,
            billing_period_end=body.billing_period_end,
            source_type="manual",
            status=BillableItemStatus.APPROVED,
            notes=body.notes,
        )
        db.add(item)

    if body.notes and not item.notes:
        item.notes = body.notes
    db.commit()
    db.refresh(item)
    return success_response(data=_billable_response(item, db), message="Billable item created")


@router.get("/invoices")
def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: int | None = None,
    engagement_id: int | None = None,
    status: str | None = None,
    payment_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Invoice)
    if client_id:
        q = q.filter(Invoice.client_id == client_id)
    if engagement_id:
        q = q.filter(Invoice.engagement_id == engagement_id)
    if status:
        q = q.filter(Invoice.status == status)
    if payment_status:
        q = q.filter(Invoice.payment_status == payment_status)
    total = q.count()
    items = q.order_by(Invoice.issue_date.desc(), Invoice.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return success_response(
        data={
            "items": [_invoice_response(i, db) for i in items],
            **paginate(total, page, page_size).model_dump(),
        }
    )


@router.get("/invoices/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise NotFoundException("Invoice not found")
    return success_response(data=_invoice_response(invoice, db))


@router.post("/invoices")
def create_invoice(
    body: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = create_invoice_from_billables(
        db,
        client_id=body.client_id,
        billable_ids=body.billable_item_ids,
        engagement_id=body.engagement_id,
        issue_date=body.issue_date,
        due_date=body.due_date,
        notes=body.notes,
        created_by=current_user.id,
        mark_sent=body.mark_sent,
    )
    db.commit()
    db.refresh(invoice)
    return success_response(data=_invoice_response(invoice, db), message="Invoice created")


@router.post("/invoices/{invoice_id}/payments")
def add_payment(
    invoice_id: int,
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise NotFoundException("Invoice not found")
    try:
        method = PaymentMethod(body.payment_method)
    except ValueError as exc:
        raise BadRequestException(f"Invalid payment_method: {body.payment_method}") from exc

    payment = record_payment(
        db,
        invoice,
        amount=body.amount,
        payment_date=body.payment_date or date.today(),
        payment_method=method,
        reference=body.reference,
        notes=body.notes,
        recorded_by=current_user.id,
    )
    db.commit()
    db.refresh(invoice)
    return success_response(
        data={
            "payment": PaymentResponse(
                id=payment.id,
                invoice_id=payment.invoice_id,
                amount=payment.amount,
                currency=payment.currency,
                payment_date=payment.payment_date,
                payment_method=payment.payment_method.value,
                reference=payment.reference,
                notes=payment.notes,
                recorded_by=payment.recorded_by,
                created_at=payment.created_at,
            ),
            "invoice": _invoice_response(invoice, db),
        },
        message="Payment recorded",
    )


@router.get("/revenue")
def revenue_report(
    client_id: int | None = None,
    engagement_id: int | None = None,
    job_id: int | None = None,
    recruiter_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Expected = approved+invoiced billables; Invoiced/Paid from revenue_entries (no double-count)."""
    billable_q = db.query(BillableItem).filter(BillableItem.status != BillableItemStatus.VOID)
    revenue_q = db.query(RevenueEntry)

    if client_id:
        billable_q = billable_q.filter(BillableItem.client_id == client_id)
        revenue_q = revenue_q.filter(RevenueEntry.client_id == client_id)
    if engagement_id:
        billable_q = billable_q.filter(BillableItem.engagement_id == engagement_id)
        revenue_q = revenue_q.filter(RevenueEntry.engagement_id == engagement_id)
    if job_id:
        billable_q = billable_q.filter(BillableItem.job_id == job_id)
        revenue_q = revenue_q.filter(RevenueEntry.job_id == job_id)
    if recruiter_id:
        billable_q = billable_q.filter(BillableItem.recruiter_id == recruiter_id)
        revenue_q = revenue_q.filter(RevenueEntry.recruiter_id == recruiter_id)
    if current_user.role == UserRole.RECRUITER:
        billable_q = billable_q.filter(BillableItem.recruiter_id == current_user.id)
        revenue_q = revenue_q.filter(RevenueEntry.recruiter_id == current_user.id)

    expected = money(billable_q.with_entities(func.coalesce(func.sum(BillableItem.amount), 0)).scalar() or 0)
    invoiced = money(revenue_q.with_entities(func.coalesce(func.sum(RevenueEntry.invoiced_amount), 0)).scalar() or 0)
    paid = money(revenue_q.with_entities(func.coalesce(func.sum(RevenueEntry.paid_amount), 0)).scalar() or 0)

    def breakdown(group_col, label_fn):
        rows = (
            revenue_q.with_entities(
                group_col,
                func.coalesce(func.sum(RevenueEntry.expected_amount), 0),
                func.coalesce(func.sum(RevenueEntry.invoiced_amount), 0),
                func.coalesce(func.sum(RevenueEntry.paid_amount), 0),
            )
            .group_by(group_col)
            .all()
        )
        items = []
        for key, exp, inv, pd in rows:
            if key is None:
                continue
            k = key.value if hasattr(key, "value") else str(key)
            items.append(
                RevenueBreakdownItem(
                    key=k,
                    label=label_fn(key),
                    expected=money(exp),
                    invoiced=money(inv),
                    paid=money(pd),
                    outstanding=money(Decimal(str(inv)) - Decimal(str(pd))),
                )
            )
        return items

    clients = {c.id: c.company_name for c in db.query(Client).all()}
    engagements = {e.id: e.engagement_name for e in db.query(Engagement).all()}
    jobs = {j.id: j.title for j in db.query(Job).all()}
    users = {u.id: u.name for u in db.query(User).all()}

    report = RevenueReportResponse(
        summary=RevenueSummary(
            expected=expected,
            invoiced=invoiced,
            paid=paid,
            outstanding=money(invoiced - paid),
        ),
        by_client=breakdown(RevenueEntry.client_id, lambda k: clients.get(int(k), str(k))),
        by_engagement=breakdown(RevenueEntry.engagement_id, lambda k: engagements.get(int(k), str(k))),
        by_job=breakdown(RevenueEntry.job_id, lambda k: jobs.get(int(k), str(k))),
        by_recruiter=breakdown(RevenueEntry.recruiter_id, lambda k: users.get(int(k), str(k))),
        by_revenue_type=breakdown(
            RevenueEntry.revenue_type,
            lambda k: k.value.replace("_", " ").title() if hasattr(k, "value") else str(k),
        ),
        by_billing_model=breakdown(
            RevenueEntry.billing_model,
            lambda k: str(k).replace("_", " ").title(),
        ),
    )
    return success_response(data=report)
