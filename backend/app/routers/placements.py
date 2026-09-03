from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.billing import BillableItem, Invoice
from app.models.candidate import Candidate
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import BillableItemType, UserRole
from app.models.job import Job
from app.models.offer import Offer
from app.models.placement import Placement
from app.models.user import User
from app.schemas.billing import PlacementCreate, PlacementResponse
from app.services.billing_service import (
    calculate_success_fee,
    create_invoice_from_billables,
    create_placement_from_accepted_offer,
    create_success_fee_billable,
    engagement_supports_success_fee,
    money,
)
from app.models.enums import InvoicePaymentStatus, OfferStatus, PlacementStatus

router = APIRouter(prefix="/placements", tags=["placements"])


def _placement_response(placement: Placement, db: Session) -> PlacementResponse:
    candidate = db.query(Candidate).filter(Candidate.id == placement.candidate_id).first()
    client = db.query(Client).filter(Client.id == placement.client_id).first()
    engagement = db.query(Engagement).filter(Engagement.id == placement.engagement_id).first()
    job = db.query(Job).filter(Job.id == placement.job_id).first()
    recruiter = db.query(User).filter(User.id == placement.recruiter_id).first()
    billable = (
        db.query(BillableItem)
        .filter(
            BillableItem.placement_id == placement.id,
            BillableItem.billable_type == BillableItemType.SUCCESS_FEE,
        )
        .first()
    )
    invoice_id = None
    if billable:
        from app.models.billing import InvoiceLineItem

        line = (
            db.query(InvoiceLineItem)
            .filter(InvoiceLineItem.billable_item_id == billable.id)
            .first()
        )
        invoice_id = line.invoice_id if line else None

    return PlacementResponse(
        id=placement.id,
        candidate_id=placement.candidate_id,
        candidate_name=candidate.name if candidate else None,
        client_id=placement.client_id,
        client_name=client.company_name if client else None,
        engagement_id=placement.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        billing_model=engagement.billing_model.value if engagement else None,
        job_id=placement.job_id,
        job_title=job.title if job else None,
        recruiter_id=placement.recruiter_id,
        recruiter_name=recruiter.name if recruiter else None,
        offer_id=placement.offer_id,
        submission_id=placement.submission_id,
        placement_date=placement.placement_date,
        start_date=placement.start_date,
        salary=placement.salary,
        currency=placement.currency,
        fee_percentage=placement.fee_percentage,
        flat_fee=placement.flat_fee,
        placement_fee=placement.placement_fee,
        guarantee_period_days=placement.guarantee_period_days,
        guarantee_end_date=placement.guarantee_end_date,
        payment_status=placement.payment_status.value,
        status=placement.status.value,
        notes=placement.notes,
        billable_item_id=billable.id if billable else None,
        invoice_id=invoice_id,
        created_at=placement.created_at,
        updated_at=placement.updated_at,
    )


@router.get("")
def list_placements(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: int | None = None,
    engagement_id: int | None = None,
    payment_status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Placement)
    if current_user.role == UserRole.RECRUITER:
        q = q.filter(Placement.recruiter_id == current_user.id)
    if client_id:
        q = q.filter(Placement.client_id == client_id)
    if engagement_id:
        q = q.filter(Placement.engagement_id == engagement_id)
    if payment_status:
        q = q.filter(Placement.payment_status == payment_status)
    total = q.count()
    items = (
        q.order_by(Placement.placement_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return success_response(
        data={
            "items": [_placement_response(p, db) for p in items],
            **paginate(total, page, page_size).model_dump(),
        }
    )


@router.get("/{placement_id}")
def get_placement(
    placement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    placement = db.query(Placement).filter(Placement.id == placement_id).first()
    if not placement:
        raise NotFoundException("Placement not found")
    return success_response(data=_placement_response(placement, db))


@router.post("")
def create_placement(
    body: PlacementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.offer_id:
        offer = db.query(Offer).filter(Offer.id == body.offer_id).first()
        if not offer:
            raise NotFoundException("Offer not found")
        if offer.status != OfferStatus.ACCEPTED:
            offer.status = OfferStatus.ACCEPTED
            offer.acceptance_date = body.placement_date or date.today()
        if not offer.engagement_id:
            raise BadRequestException("Offer missing engagement")
        engagement = db.query(Engagement).filter(Engagement.id == offer.engagement_id).first()
        if not engagement:
            raise NotFoundException("Engagement not found")
        placement, _, invoice = create_placement_from_accepted_offer(
            db,
            offer,
            engagement,
            placement_date=body.placement_date,
            recruiter_id=current_user.id,
            auto_invoice=body.auto_invoice,
            created_by=current_user.id,
        )
        if body.notes:
            placement.notes = body.notes
        db.commit()
        db.refresh(placement)
        return success_response(
            data=_placement_response(placement, db),
            message="Placement created" + (" and invoiced" if invoice else ""),
        )

    if not body.candidate_id or not body.job_id or not body.engagement_id or not body.salary:
        raise BadRequestException("offer_id or (candidate_id, job_id, engagement_id, salary) required")

    job = db.query(Job).filter(Job.id == body.job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    engagement = db.query(Engagement).filter(Engagement.id == body.engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")

    fee, pct, flat = calculate_success_fee(engagement, body.salary)
    placement = Placement(
        candidate_id=body.candidate_id,
        client_id=job.client_id,
        engagement_id=engagement.id,
        job_id=job.id,
        recruiter_id=current_user.id,
        placement_date=body.placement_date or date.today(),
        start_date=body.start_date,
        salary=money(body.salary),
        currency=engagement.currency or "USD",
        fee_percentage=pct,
        flat_fee=flat,
        placement_fee=fee,
        guarantee_period_days=engagement.guarantee_period_days,
        payment_status=InvoicePaymentStatus.PENDING,
        status=PlacementStatus.ACTIVE,
        notes=body.notes,
    )
    db.add(placement)
    db.flush()

    if engagement_supports_success_fee(engagement):
        billable = create_success_fee_billable(db, placement, engagement)
        if body.auto_invoice:
            create_invoice_from_billables(
                db,
                client_id=placement.client_id,
                billable_ids=[billable.id],
                engagement_id=engagement.id,
                created_by=current_user.id,
            )

    db.commit()
    db.refresh(placement)
    return success_response(data=_placement_response(placement, db), message="Placement created")


@router.post("/{placement_id}/invoice")
def invoice_placement(
    placement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    placement = db.query(Placement).filter(Placement.id == placement_id).first()
    if not placement:
        raise NotFoundException("Placement not found")
    engagement = db.query(Engagement).filter(Engagement.id == placement.engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")

    billable = create_success_fee_billable(db, placement, engagement)
    if billable.status.value == "invoiced":
        raise BadRequestException("Success fee already invoiced")

    invoice = create_invoice_from_billables(
        db,
        client_id=placement.client_id,
        billable_ids=[billable.id],
        engagement_id=engagement.id,
        created_by=current_user.id,
    )
    db.commit()
    return success_response(
        data={"placement_id": placement.id, "invoice_id": invoice.id, "invoice_number": invoice.invoice_number},
        message="Invoice created from placement success fee",
    )
