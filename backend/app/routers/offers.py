from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import OfferStatus, PipelineStage, SubmissionStatus, UserRole
from app.models.job import Job
from app.models.offer import Offer
from app.models.placement import Placement
from app.models.submission import Submission
from app.models.user import User
from app.schemas.billing import (
    OfferAcceptRequest,
    OfferCreate,
    OfferRejectRequest,
    OfferResponse,
    OfferUpdate,
)
from app.services.billing_service import create_placement_from_accepted_offer

router = APIRouter(prefix="/offers", tags=["offers"])


def _offer_response(offer: Offer, db: Session) -> OfferResponse:
    candidate = db.query(Candidate).filter(Candidate.id == offer.candidate_id).first()
    job = db.query(Job).filter(Job.id == offer.job_id).first()
    client = db.query(Client).filter(Client.id == offer.client_id).first()
    engagement = (
        db.query(Engagement).filter(Engagement.id == offer.engagement_id).first()
        if offer.engagement_id
        else None
    )
    recruiter = db.query(User).filter(User.id == offer.recruiter_id).first()
    placement = db.query(Placement).filter(Placement.offer_id == offer.id).first()
    return OfferResponse(
        id=offer.id,
        candidate_id=offer.candidate_id,
        candidate_name=candidate.name if candidate else None,
        job_id=offer.job_id,
        job_title=job.title if job else None,
        client_id=offer.client_id,
        client_name=client.company_name if client else None,
        engagement_id=offer.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        submission_id=offer.submission_id,
        candidate_job_assignment_id=offer.candidate_job_assignment_id,
        recruiter_id=offer.recruiter_id,
        recruiter_name=recruiter.name if recruiter else None,
        salary=offer.salary,
        currency=offer.currency,
        start_date=offer.start_date,
        bonus=offer.bonus,
        equity=offer.equity,
        offer_date=offer.offer_date,
        acceptance_date=offer.acceptance_date,
        rejection_date=offer.rejection_date,
        status=offer.status.value,
        notes=offer.notes,
        placement_id=placement.id if placement else None,
        created_at=offer.created_at,
        updated_at=offer.updated_at,
    )


@router.get("")
def list_offers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    client_id: int | None = None,
    job_id: int | None = None,
    candidate_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Offer)
    if current_user.role == UserRole.RECRUITER:
        q = q.filter(Offer.recruiter_id == current_user.id)
    if client_id:
        q = q.filter(Offer.client_id == client_id)
    if job_id:
        q = q.filter(Offer.job_id == job_id)
    if candidate_id:
        q = q.filter(Offer.candidate_id == candidate_id)
    if status:
        q = q.filter(Offer.status == status)
    total = q.count()
    items = q.order_by(Offer.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return success_response(
        data={
            "items": [_offer_response(o, db) for o in items],
            **paginate(total, page, page_size).model_dump(),
        }
    )


@router.get("/{offer_id}")
def get_offer(
    offer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise NotFoundException("Offer not found")
    if current_user.role == UserRole.RECRUITER and offer.recruiter_id != current_user.id:
        raise NotFoundException("Offer not found")
    return success_response(data=_offer_response(offer, db))


@router.post("")
def create_offer(
    body: OfferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = db.query(Job).filter(Job.id == body.job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    candidate = db.query(Candidate).filter(Candidate.id == body.candidate_id).first()
    if not candidate:
        raise NotFoundException("Candidate not found")

    assignment_id = body.candidate_job_assignment_id
    if not assignment_id:
        assignment = (
            db.query(CandidateJobAssignment)
            .filter(
                CandidateJobAssignment.candidate_id == body.candidate_id,
                CandidateJobAssignment.job_id == body.job_id,
            )
            .first()
        )
        assignment_id = assignment.id if assignment else None

    engagement_id = job.engagement_id
    status = OfferStatus(body.status) if body.status else OfferStatus.SENT

    offer = Offer(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        client_id=job.client_id,
        engagement_id=engagement_id,
        submission_id=body.submission_id,
        candidate_job_assignment_id=assignment_id,
        recruiter_id=current_user.id,
        salary=body.salary,
        currency=body.currency or "USD",
        start_date=body.start_date,
        bonus=body.bonus,
        equity=body.equity,
        offer_date=body.offer_date or date.today(),
        status=status,
        notes=body.notes,
    )
    db.add(offer)

    if assignment_id and status in (OfferStatus.SENT, OfferStatus.DRAFT):
        assignment = db.query(CandidateJobAssignment).filter(CandidateJobAssignment.id == assignment_id).first()
        if assignment and assignment.status not in (PipelineStage.HIRED, PipelineStage.REJECTED):
            assignment.status = PipelineStage.OFFER_SENT

    if body.submission_id:
        submission = db.query(Submission).filter(Submission.id == body.submission_id).first()
        if submission and status == OfferStatus.SENT:
            submission.status = SubmissionStatus.OFFER

    db.commit()
    db.refresh(offer)
    return success_response(data=_offer_response(offer, db), message="Offer created")


@router.put("/{offer_id}")
def update_offer(
    offer_id: int,
    body: OfferUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise NotFoundException("Offer not found")
    if offer.status in (OfferStatus.ACCEPTED, OfferStatus.REJECTED):
        raise BadRequestException("Cannot edit an accepted or rejected offer")

    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = OfferStatus(data["status"])
    for k, v in data.items():
        setattr(offer, k, v)
    db.commit()
    db.refresh(offer)
    return success_response(data=_offer_response(offer, db), message="Offer updated")


@router.post("/{offer_id}/accept")
def accept_offer(
    offer_id: int,
    body: OfferAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise NotFoundException("Offer not found")
    if offer.status == OfferStatus.ACCEPTED:
        raise BadRequestException("Offer already accepted")
    if offer.status == OfferStatus.REJECTED:
        raise BadRequestException("Cannot accept a rejected offer")

    offer.status = OfferStatus.ACCEPTED
    offer.acceptance_date = body.acceptance_date or date.today()
    offer.rejection_date = None

    if offer.submission_id:
        submission = db.query(Submission).filter(Submission.id == offer.submission_id).first()
        if submission:
            submission.status = SubmissionStatus.OFFER

    placement_data = None
    billable_id = None
    invoice_id = None
    if body.create_placement:
        if not offer.engagement_id:
            raise BadRequestException("Offer has no engagement — cannot create placement")
        engagement = db.query(Engagement).filter(Engagement.id == offer.engagement_id).first()
        if not engagement:
            raise NotFoundException("Engagement not found")
        placement, billable, invoice = create_placement_from_accepted_offer(
            db,
            offer,
            engagement,
            placement_date=offer.acceptance_date,
            recruiter_id=current_user.id,
            auto_invoice=body.auto_invoice,
            created_by=current_user.id,
        )
        placement_data = placement.id
        billable_id = billable.id if billable else None
        invoice_id = invoice.id if invoice else None

    db.commit()
    db.refresh(offer)
    resp = _offer_response(offer, db)
    return success_response(
        data={
            **resp.model_dump(),
            "placement_id": placement_data or resp.placement_id,
            "billable_item_id": billable_id,
            "invoice_id": invoice_id,
        },
        message="Offer accepted",
    )


@router.post("/{offer_id}/reject")
def reject_offer(
    offer_id: int,
    body: OfferRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise NotFoundException("Offer not found")
    if offer.status == OfferStatus.ACCEPTED:
        raise BadRequestException("Cannot reject an accepted offer")

    offer.status = OfferStatus.REJECTED
    offer.rejection_date = body.rejection_date or date.today()
    if body.notes:
        offer.notes = (offer.notes or "") + f"\nRejection: {body.notes}"
    db.commit()
    db.refresh(offer)
    return success_response(data=_offer_response(offer, db), message="Offer rejected")
