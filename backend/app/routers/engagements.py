from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import ActivityAction, EntityType, UserRole
from app.models.job import Job
from app.models.user import User
from app.schemas.engagement import EngagementCreate, EngagementResponse, EngagementUpdate
from app.services.activity_service import log_activity

router = APIRouter(prefix="/engagements", tags=["engagements"])


def _engagement_to_response(engagement: Engagement, db: Session, include_jobs: bool = False) -> dict:
    client = db.query(Client).filter(Client.id == engagement.client_id).first()
    recruiter = None
    if engagement.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == engagement.assigned_recruiter_id).first()

    jobs_query = db.query(Job).options(joinedload(Job.candidate_assignments)).filter(
        Job.engagement_id == engagement.id
    )
    jobs = jobs_query.order_by(Job.created_at.desc()).all() if include_jobs else jobs_query.all()
    job_count = len(jobs)

    job_items = []
    if include_jobs:
        for job in jobs:
            job_recruiter = (
                db.query(User).filter(User.id == job.assigned_recruiter_id).first()
                if job.assigned_recruiter_id
                else None
            )
            job_items.append({
                "id": job.id,
                "title": job.title,
                "status": job.status.value if hasattr(job.status, "value") else str(job.status),
                "location": job.location,
                "candidate_count": len(job.candidate_assignments) if job.candidate_assignments else 0,
                "assigned_recruiter_name": job_recruiter.name if job_recruiter else None,
                "created_at": job.created_at,
            })

    return EngagementResponse(
        id=engagement.id,
        client_id=engagement.client_id,
        client_name=client.company_name if client else None,
        engagement_name=engagement.engagement_name,
        start_date=engagement.start_date,
        end_date=engagement.end_date,
        status=engagement.status,
        service_model=engagement.service_model,
        billing_model=engagement.billing_model,
        currency=engagement.currency,
        rate=engagement.rate,
        hourly_rate=engagement.hourly_rate,
        billing_period=engagement.billing_period,
        monthly_fee=engagement.monthly_fee,
        included_hours=engagement.included_hours,
        additional_hourly_rate=engagement.additional_hourly_rate,
        placement_fee_percent=engagement.placement_fee_percent,
        flat_placement_fee=engagement.flat_placement_fee,
        guarantee_period_days=engagement.guarantee_period_days,
        payment_terms=engagement.payment_terms,
        contract_reference=engagement.contract_reference,
        notes=engagement.notes,
        sla=engagement.sla,
        target_kpis=engagement.target_kpis,
        custom_responsibilities=engagement.custom_responsibilities or [],
        assigned_recruiter_id=engagement.assigned_recruiter_id,
        assigned_recruiter_name=recruiter.name if recruiter else None,
        job_count=job_count,
        jobs=job_items,
        created_at=engagement.created_at,
        updated_at=engagement.updated_at,
    ).model_dump(mode="json")


@router.get("")
def list_engagements(
    client_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Engagement)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(
            (Engagement.assigned_recruiter_id == current_user.id)
            | (Engagement.client_id.in_(
                db.query(Job.client_id).filter(Job.assigned_recruiter_id == current_user.id).distinct()
            ))
        )
    if client_id:
        query = query.filter(Engagement.client_id == client_id)
    if status:
        query = query.filter(Engagement.status == status)
    if search:
        query = query.filter(Engagement.engagement_name.ilike(f"%{search}%"))

    total = query.count()
    engagements = (
        query.order_by(Engagement.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [_engagement_to_response(e, db) for e in engagements]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Engagements retrieved",
    )


@router.post("")
def create_engagement(
    payload: EngagementCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise NotFoundException("Client not found")

    if payload.assigned_recruiter_id:
        recruiter = db.query(User).filter(User.id == payload.assigned_recruiter_id).first()
        if not recruiter:
            raise NotFoundException("Recruiter not found")

    data = payload.model_dump()
    engagement = Engagement(**data)
    db.add(engagement)
    db.flush()
    log_activity(
        db,
        EntityType.CLIENT,
        client.id,
        ActivityAction.CREATED,
        f"Engagement '{engagement.engagement_name}' was created",
        admin.id,
    )
    db.commit()
    db.refresh(engagement)
    return success_response(
        data=_engagement_to_response(engagement, db, include_jobs=True),
        message="Engagement created",
    )


@router.get("/{engagement_id}")
def get_engagement(
    engagement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")
    if current_user.role != UserRole.ADMIN:
        has_job_access = (
            db.query(Job)
            .filter(Job.engagement_id == engagement.id, Job.assigned_recruiter_id == current_user.id)
            .first()
            is not None
        )
        if engagement.assigned_recruiter_id != current_user.id and not has_job_access:
            raise NotFoundException("Engagement not found")
    return success_response(
        data=_engagement_to_response(engagement, db, include_jobs=True),
        message="Engagement retrieved",
    )


@router.put("/{engagement_id}")
def update_engagement(
    engagement_id: int,
    payload: EngagementUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "assigned_recruiter_id" in update_data and update_data["assigned_recruiter_id"]:
        recruiter = db.query(User).filter(User.id == update_data["assigned_recruiter_id"]).first()
        if not recruiter:
            raise NotFoundException("Recruiter not found")

    start = update_data.get("start_date", engagement.start_date)
    end = update_data.get("end_date", engagement.end_date)
    if start and end and end < start:
        raise BadRequestException("end_date cannot be before start_date")

    for key, value in update_data.items():
        setattr(engagement, key, value)

    log_activity(
        db,
        EntityType.CLIENT,
        engagement.client_id,
        ActivityAction.UPDATED,
        f"Engagement '{engagement.engagement_name}' was updated",
        admin.id,
    )
    db.commit()
    db.refresh(engagement)
    return success_response(
        data=_engagement_to_response(engagement, db, include_jobs=True),
        message="Engagement updated",
    )


@router.patch("/{engagement_id}/status")
def update_engagement_status(
    engagement_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    from app.models.enums import EngagementStatus

    engagement = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")
    try:
        new_status = EngagementStatus(status)
    except ValueError as exc:
        raise BadRequestException("Invalid engagement status") from exc

    old = engagement.status.value
    engagement.status = new_status
    log_activity(
        db,
        EntityType.CLIENT,
        engagement.client_id,
        ActivityAction.STATUS_CHANGED,
        f"Engagement '{engagement.engagement_name}' status changed from {old} to {new_status.value}",
        admin.id,
    )
    db.commit()
    db.refresh(engagement)
    return success_response(
        data=_engagement_to_response(engagement, db, include_jobs=True),
        message="Engagement status updated",
    )
