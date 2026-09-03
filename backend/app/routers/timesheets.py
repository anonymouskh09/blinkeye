from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.response import paginate, success_response
from app.models.billing import BillableItem, InvoiceLineItem, TimesheetEntry
from app.models.client import Client
from app.models.engagement import Engagement
from app.models.enums import TimesheetStatus, UserRole
from app.models.job import Job
from app.models.user import User
from app.schemas.billing import (
    BillableItemResponse,
    TimesheetApproveResponse,
    TimesheetBulkAction,
    TimesheetEntryCreate,
    TimesheetEntryResponse,
    TimesheetEntryUpdate,
)
from app.services.billing_service import (
    approve_timesheet_entries,
    create_timesheet_entry,
    reject_timesheet_entries,
    submit_timesheet_entries,
)

router = APIRouter(prefix="/timesheets", tags=["timesheets"])


def _require_manager_or_admin(user: User) -> User:
    if user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise ForbiddenException("Manager or admin access required")
    return user


def _timesheet_response(entry: TimesheetEntry, db: Session) -> TimesheetEntryResponse:
    client = db.query(Client).filter(Client.id == entry.client_id).first()
    engagement = db.query(Engagement).filter(Engagement.id == entry.engagement_id).first()
    job = db.query(Job).filter(Job.id == entry.job_id).first() if entry.job_id else None
    recruiter = db.query(User).filter(User.id == entry.recruiter_id).first()
    return TimesheetEntryResponse(
        id=entry.id,
        client_id=entry.client_id,
        client_name=client.company_name if client else None,
        engagement_id=entry.engagement_id,
        engagement_name=engagement.engagement_name if engagement else None,
        job_id=entry.job_id,
        job_title=job.title if job else None,
        recruiter_id=entry.recruiter_id,
        recruiter_name=recruiter.name if recruiter else None,
        work_date=entry.work_date,
        hours=entry.hours,
        hourly_rate=entry.hourly_rate,
        description=entry.description,
        status=entry.status,
        billable_item_id=entry.billable_item_id,
        approved_at=entry.approved_at,
        approved_by=entry.approved_by,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _billable_response_from_item(item: BillableItem, db: Session) -> BillableItemResponse:
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


def _load_entries_for_user(
    db: Session,
    entry_ids: list[int],
    current_user: User,
) -> list[TimesheetEntry]:
    entries = db.query(TimesheetEntry).filter(TimesheetEntry.id.in_(entry_ids)).all()
    if len(entries) != len(set(entry_ids)):
        raise NotFoundException("One or more timesheet entries not found")
    if current_user.role == UserRole.RECRUITER:
        for entry in entries:
            if entry.recruiter_id != current_user.id:
                raise ForbiddenException("Cannot access another recruiter's timesheet")
    return entries


@router.get("")
def list_timesheets(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    client_id: int | None = None,
    engagement_id: int | None = None,
    job_id: int | None = None,
    recruiter_id: int | None = None,
    status: str | None = None,
    work_date_from: date | None = None,
    work_date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(TimesheetEntry)
    if current_user.role == UserRole.RECRUITER:
        q = q.filter(TimesheetEntry.recruiter_id == current_user.id)
    elif recruiter_id:
        q = q.filter(TimesheetEntry.recruiter_id == recruiter_id)
    if client_id:
        q = q.filter(TimesheetEntry.client_id == client_id)
    if engagement_id:
        q = q.filter(TimesheetEntry.engagement_id == engagement_id)
    if job_id:
        q = q.filter(TimesheetEntry.job_id == job_id)
    if status:
        q = q.filter(TimesheetEntry.status == status)
    if work_date_from:
        q = q.filter(TimesheetEntry.work_date >= work_date_from)
    if work_date_to:
        q = q.filter(TimesheetEntry.work_date <= work_date_to)

    total = q.count()
    items = (
        q.order_by(TimesheetEntry.work_date.desc(), TimesheetEntry.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return success_response(
        data={
            "items": [_timesheet_response(e, db) for e in items],
            **paginate(total, page, page_size).model_dump(),
        }
    )


@router.post("")
def create_timesheet(
    body: TimesheetEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    engagement = db.query(Engagement).filter(Engagement.id == body.engagement_id).first()
    if not engagement:
        raise NotFoundException("Engagement not found")

    if body.job_id:
        job = db.query(Job).filter(Job.id == body.job_id).first()
        if not job:
            raise NotFoundException("Job not found")
        if job.engagement_id != engagement.id:
            raise BadRequestException("Job does not belong to the selected engagement")
        if job.client_id != engagement.client_id:
            raise BadRequestException("Job client does not match engagement client")

    status = TimesheetStatus.SUBMITTED if body.submit else TimesheetStatus.PENDING
    entry = create_timesheet_entry(
        db,
        engagement,
        recruiter_id=current_user.id,
        work_date=body.work_date,
        hours=body.hours,
        job_id=body.job_id,
        description=body.description,
        status=status,
    )
    db.commit()
    db.refresh(entry)
    return success_response(data=_timesheet_response(entry, db), message="Timesheet entry created")


@router.put("/{entry_id}")
def update_timesheet(
    entry_id: int,
    body: TimesheetEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(TimesheetEntry).filter(TimesheetEntry.id == entry_id).first()
    if not entry:
        raise NotFoundException("Timesheet entry not found")
    if current_user.role == UserRole.RECRUITER and entry.recruiter_id != current_user.id:
        raise ForbiddenException("Cannot edit another recruiter's timesheet")
    if entry.billable_item_id is not None or entry.status == TimesheetStatus.APPROVED.value:
        raise BadRequestException("Cannot edit an approved/billed timesheet entry")
    if entry.status == TimesheetStatus.SUBMITTED.value and current_user.role == UserRole.RECRUITER:
        raise BadRequestException("Submitted timesheets cannot be edited — ask a manager to reject first")

    data = body.model_dump(exclude_unset=True)
    if "job_id" in data and data["job_id"] is not None:
        job = db.query(Job).filter(Job.id == data["job_id"]).first()
        if not job:
            raise NotFoundException("Job not found")
        if job.engagement_id != entry.engagement_id:
            raise BadRequestException("Job does not belong to this engagement")
    for k, v in data.items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return success_response(data=_timesheet_response(entry, db), message="Timesheet updated")


@router.post("/submit")
def submit_timesheets(
    body: TimesheetBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = _load_entries_for_user(db, body.entry_ids, current_user)
    submit_timesheet_entries(
        db,
        entries,
        actor_id=current_user.id,
        actor_role=current_user.role,
    )
    db.commit()
    for e in entries:
        db.refresh(e)
    return success_response(
        data=[_timesheet_response(e, db) for e in entries],
        message="Timesheet entries submitted",
    )


@router.post("/approve")
def approve_timesheets(
    body: TimesheetBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager_or_admin(current_user)
    entries = _load_entries_for_user(db, body.entry_ids, current_user)
    entries, billable = approve_timesheet_entries(
        db,
        entries,
        actor_id=current_user.id,
        description=body.description,
    )
    db.commit()
    for e in entries:
        db.refresh(e)
    db.refresh(billable)
    return success_response(
        data=TimesheetApproveResponse(
            entries=[_timesheet_response(e, db) for e in entries],
            billable_item=_billable_response_from_item(billable, db),
        ),
        message="Timesheet entries approved and billable item created",
    )


@router.post("/reject")
def reject_timesheets(
    body: TimesheetBulkAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_manager_or_admin(current_user)
    entries = _load_entries_for_user(db, body.entry_ids, current_user)
    reject_timesheet_entries(db, entries, actor_id=current_user.id)
    db.commit()
    for e in entries:
        db.refresh(e)
    return success_response(
        data=[_timesheet_response(e, db) for e in entries],
        message="Timesheet entries rejected",
    )


@router.delete("/{entry_id}")
def delete_timesheet(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(TimesheetEntry).filter(TimesheetEntry.id == entry_id).first()
    if not entry:
        raise NotFoundException("Timesheet entry not found")
    if current_user.role == UserRole.RECRUITER and entry.recruiter_id != current_user.id:
        raise ForbiddenException("Cannot delete another recruiter's timesheet")
    if entry.billable_item_id is not None or entry.status == TimesheetStatus.APPROVED.value:
        raise BadRequestException("Cannot delete an approved/billed timesheet entry")
    if entry.status == TimesheetStatus.SUBMITTED.value and current_user.role == UserRole.RECRUITER:
        raise BadRequestException("Cannot delete a submitted timesheet")
    db.delete(entry)
    db.commit()
    return success_response(data={"id": entry_id}, message="Timesheet entry deleted")
