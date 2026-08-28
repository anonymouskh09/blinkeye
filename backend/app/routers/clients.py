from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_current_user, require_admin
from app.core.exceptions import BadRequestException, NotFoundException
from app.core.response import paginate, success_response
from app.models.client import Client
from app.models.client_activity import ClientActivity
from app.models.client_attachment import ClientAttachment
from app.models.client_contact import ClientContact
from app.models.client_guest import ClientGuest
from app.models.client_team import ClientTeamMember
from app.models.engagement import Engagement
from app.models.enums import ActivityAction, ClientStage, ClientStatus, EntityType
from app.models.job import Job
from app.models.user import User
from app.schemas.client import (
    ClientActivityCreate,
    ClientActivityResponse,
    ClientActivityUpdate,
    ClientAttachmentResponse,
    ClientContactCreate,
    ClientContactResponse,
    ClientCreate,
    ClientDetailResponse,
    ClientGuestCreate,
    ClientGuestResponse,
    ClientResponse,
    ClientTagsUpdate,
    ClientTeamMemberResponse,
    ClientUpdate,
)
from app.schemas.job import JobSummaryResponse
from app.routers.engagements import _engagement_to_response
from app.services.activity_service import log_activity
from app.services.client_file_service import (
    delete_attachment_file,
    get_attachment_full_path,
    save_client_attachment,
)
from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

router = APIRouter(prefix="/clients", tags=["clients"])


def _client_to_response(client: Client, db: Session) -> dict:
    job_count = db.query(func.count(Job.id)).filter(Job.client_id == client.id).scalar() or 0
    owner_name = None
    if client.owner_id:
        owner = db.query(User).filter(User.id == client.owner_id).first()
        owner_name = owner.name if owner else None

    team_member = (
        db.query(ClientTeamMember)
        .filter(ClientTeamMember.client_id == client.id)
        .first()
    )
    team_member_name = None
    if team_member:
        user = db.query(User).filter(User.id == team_member.user_id).first()
        team_member_name = user.name if user else None

    return ClientResponse(
        id=client.id,
        company_name=client.company_name,
        contact_person=client.contact_person,
        email=client.email,
        phone=client.phone,
        industry=client.industry,
        location=client.location,
        address=client.address,
        website=client.website,
        description=client.description,
        notes=client.notes,
        status=client.status,
        stage=client.stage,
        owner_id=client.owner_id,
        owner_name=owner_name,
        team_member_name=team_member_name,
        job_count=job_count,
        tags=client.tags or [],
        custom_tags=client.custom_tags or [],
        visibility=client.visibility or "public",
        created_at=client.created_at,
        updated_at=client.updated_at,
    ).model_dump()


def _client_detail(client: Client, db: Session) -> dict:
    data = _client_to_response(client, db)

    jobs = db.query(Job).options(joinedload(Job.candidate_assignments)).filter(Job.client_id == client.id).order_by(Job.created_at.desc()).all()
    job_items = []
    for job in jobs:
        candidate_count = len(job.candidate_assignments) if job.candidate_assignments else 0
        recruiter = db.query(User).filter(User.id == job.assigned_recruiter_id).first() if job.assigned_recruiter_id else None
        engagement = db.query(Engagement).filter(Engagement.id == job.engagement_id).first() if job.engagement_id else None
        job_items.append(
            JobSummaryResponse(
                id=job.id,
                title=job.title,
                status=job.status,
                location=job.location,
                candidate_count=candidate_count,
                created_at=job.created_at,
                salary_min=job.salary_min,
                salary_max=job.salary_max,
                number_of_positions=job.number_of_positions,
                assigned_recruiter_id=job.assigned_recruiter_id,
                assigned_recruiter_name=recruiter.name if recruiter else None,
                engagement_id=job.engagement_id,
                engagement_name=engagement.engagement_name if engagement else None,
            ).model_dump()
        )

    contacts = [
        ClientContactResponse.model_validate(c).model_dump()
        for c in db.query(ClientContact).filter(ClientContact.client_id == client.id).all()
    ]

    team = []
    for tm in db.query(ClientTeamMember).filter(ClientTeamMember.client_id == client.id).all():
        user = db.query(User).filter(User.id == tm.user_id).first()
        if user:
            team.append(
                ClientTeamMemberResponse(
                    id=tm.id,
                    user_id=user.id,
                    name=user.name,
                    email=user.email,
                    status=user.status.value,
                ).model_dump()
            )

    guests = [
        ClientGuestResponse.model_validate(g).model_dump()
        for g in db.query(ClientGuest).filter(ClientGuest.client_id == client.id).all()
    ]

    attachments = []
    for att in db.query(ClientAttachment).filter(ClientAttachment.client_id == client.id).order_by(ClientAttachment.created_at.desc()).all():
        uploader = db.query(User).filter(User.id == att.uploaded_by).first()
        attachments.append(
            ClientAttachmentResponse(
                id=att.id,
                client_id=att.client_id,
                filename=att.filename,
                file_path=att.file_path,
                file_size=att.file_size,
                uploaded_by=att.uploaded_by,
                uploaded_by_name=uploader.name if uploader else None,
                created_at=att.created_at,
            ).model_dump()
        )

    activity_items = []
    for act in db.query(ClientActivity).filter(ClientActivity.client_id == client.id).order_by(ClientActivity.activity_date.desc(), ClientActivity.created_at.desc()).all():
        assignee = db.query(User).filter(User.id == act.assigned_to_id).first() if act.assigned_to_id else None
        creator = db.query(User).filter(User.id == act.created_by).first()
        activity_items.append(
            ClientActivityResponse(
                id=act.id,
                client_id=act.client_id,
                title=act.title,
                activity_type=act.activity_type,
                activity_date=act.activity_date,
                start_time=act.start_time,
                end_time=act.end_time,
                duration_minutes=act.duration_minutes,
                location=act.location,
                description=act.description,
                assigned_to_id=act.assigned_to_id,
                assigned_to_name=assignee.name if assignee else None,
                share_with_guests=act.share_with_guests,
                created_by=act.created_by,
                created_by_name=creator.name if creator else None,
                created_at=act.created_at,
            ).model_dump()
        )

    data["jobs"] = job_items
    data["engagements"] = [
        _engagement_to_response(e, db)
        for e in db.query(Engagement).filter(Engagement.client_id == client.id).order_by(Engagement.created_at.desc()).all()
    ]
    data["contacts"] = contacts
    data["team"] = team
    data["guests"] = guests
    data["attachments"] = attachments
    data["activities"] = activity_items
    return data


@router.get("")
def list_clients(
    search: str | None = None,
    status: ClientStatus | None = None,
    stage: ClientStage | None = None,
    owner_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(Client)
    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                Client.company_name.ilike(term),
                Client.contact_person.ilike(term),
                Client.email.ilike(term),
                Client.phone.ilike(term),
                Client.industry.ilike(term),
                Client.location.ilike(term),
            )
        )
    if status:
        query = query.filter(Client.status == status)
    if stage:
        query = query.filter(Client.stage == stage)
    if owner_id:
        query = query.filter(Client.owner_id == owner_id)

    total = query.count()
    clients = query.order_by(Client.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_client_to_response(c, db) for c in clients]
    return success_response(
        data={"items": items, **paginate(total, page, page_size).model_dump()},
        message="Clients retrieved",
    )


@router.get("/board")
def board_clients(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    clients = db.query(Client).filter(Client.status == ClientStatus.ACTIVE).order_by(Client.created_at.desc()).all()
    board: dict[str, list] = {stage.value: [] for stage in ClientStage}
    for client in clients:
        board[client.stage.value].append(_client_to_response(client, db))
    return success_response(data={"stages": board}, message="Client board retrieved")


@router.post("")
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    data = payload.model_dump(exclude={"team_user_ids"})
    contact_title = data.pop("contact_title", None)
    team_user_ids = list(dict.fromkeys(payload.team_user_ids or []))
    if not data.get("owner_id"):
        data["owner_id"] = team_user_ids[0] if team_user_ids else admin.id

    client = Client(**data)
    db.add(client)
    db.flush()

    assigned_ids = set(team_user_ids)
    assigned_ids.add(data["owner_id"])
    for user_id in assigned_ids:
        db.add(ClientTeamMember(client_id=client.id, user_id=user_id))
    if payload.contact_person:
        db.add(
            ClientContact(
                client_id=client.id,
                name=payload.contact_person,
                email=payload.email or None,
                phone=payload.phone or None,
                title=contact_title or None,
            )
        )

    log_activity(
        db, EntityType.CLIENT, client.id, ActivityAction.CREATED,
        f"Client '{client.company_name}' was created", admin.id,
    )
    db.commit()
    db.refresh(client)
    return success_response(data=_client_to_response(client, db), message="Client created")


@router.get("/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    return success_response(data=_client_detail(client, db), message="Client retrieved")


@router.put("/{client_id}")
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(client, key, value)

    log_activity(
        db, EntityType.CLIENT, client.id, ActivityAction.UPDATED,
        f"Client '{client.company_name}' was updated", admin.id,
    )
    db.commit()
    db.refresh(client)
    return success_response(data=_client_to_response(client, db), message="Client updated")


@router.delete("/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")

    client.status = ClientStatus.INACTIVE
    log_activity(
        db, EntityType.CLIENT, client.id, ActivityAction.DELETED,
        f"Client '{client.company_name}' was archived", admin.id,
    )
    db.commit()
    return success_response(message="Client archived")


@router.post("/{client_id}/contacts")
def add_contact(
    client_id: int,
    payload: ClientContactCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    contact = ClientContact(client_id=client_id, **payload.model_dump())
    db.add(contact)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Contact '{payload.name}' was added to client '{client.company_name}'", admin.id,
    )
    db.commit()
    db.refresh(contact)
    return success_response(data=ClientContactResponse.model_validate(contact).model_dump(), message="Contact added")


@router.post("/{client_id}/team")
def add_team_member(
    client_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise NotFoundException("User not found")
    existing = db.query(ClientTeamMember).filter(
        ClientTeamMember.client_id == client_id, ClientTeamMember.user_id == user_id
    ).first()
    if existing:
        raise BadRequestException("User already on team")
    tm = ClientTeamMember(client_id=client_id, user_id=user_id)
    db.add(tm)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Team member '{user.name}' was added to client '{client.company_name}'", admin.id,
    )
    db.commit()
    return success_response(
        data=ClientTeamMemberResponse(
            id=tm.id, user_id=user.id, name=user.name, email=user.email, status=user.status.value
        ).model_dump(),
        message="Team member added",
    )


@router.post("/{client_id}/guests")
def add_guest(
    client_id: int,
    payload: ClientGuestCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    guest = ClientGuest(client_id=client_id, **payload.model_dump())
    db.add(guest)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Guest '{payload.name}' was added to client '{client.company_name}'", admin.id,
    )
    db.commit()
    db.refresh(guest)
    return success_response(data=ClientGuestResponse.model_validate(guest).model_dump(), message="Guest added")


@router.delete("/{client_id}/contacts/{contact_id}")
def delete_contact(
    client_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    contact = db.query(ClientContact).filter(
        ClientContact.id == contact_id, ClientContact.client_id == client_id
    ).first()
    if not contact:
        raise NotFoundException("Contact not found")
    name = contact.name
    db.delete(contact)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Contact '{name}' was removed", admin.id,
    )
    db.commit()
    return success_response(message="Contact removed")


@router.delete("/{client_id}/team/{team_id}")
def remove_team_member(
    client_id: int,
    team_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    tm = db.query(ClientTeamMember).filter(
        ClientTeamMember.id == team_id, ClientTeamMember.client_id == client_id
    ).first()
    if not tm:
        raise NotFoundException("Team member not found")
    user = db.query(User).filter(User.id == tm.user_id).first()
    db.delete(tm)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Team member '{user.name if user else team_id}' was removed", admin.id,
    )
    db.commit()
    return success_response(message="Team member removed")


@router.delete("/{client_id}/guests/{guest_id}")
def delete_guest(
    client_id: int,
    guest_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    guest = db.query(ClientGuest).filter(
        ClientGuest.id == guest_id, ClientGuest.client_id == client_id
    ).first()
    if not guest:
        raise NotFoundException("Guest not found")
    name = guest.name
    db.delete(guest)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Guest '{name}' was removed", admin.id,
    )
    db.commit()
    return success_response(message="Guest removed")


@router.post("/{client_id}/attachments")
async def upload_attachment(
    client_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    relative_path, filename, file_size = await save_client_attachment(file, client_id)
    attachment = ClientAttachment(
        client_id=client_id,
        filename=filename,
        file_path=relative_path,
        file_size=file_size,
        uploaded_by=admin.id,
    )
    db.add(attachment)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Attachment '{filename}' was uploaded", admin.id,
    )
    db.commit()
    db.refresh(attachment)
    return success_response(
        data=ClientAttachmentResponse(
            id=attachment.id,
            client_id=attachment.client_id,
            filename=attachment.filename,
            file_path=attachment.file_path,
            file_size=attachment.file_size,
            uploaded_by=attachment.uploaded_by,
            uploaded_by_name=admin.name,
            created_at=attachment.created_at,
        ).model_dump(),
        message="Attachment uploaded",
    )


@router.get("/{client_id}/attachments/{attachment_id}/download")
def download_attachment(
    client_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    attachment = db.query(ClientAttachment).filter(
        ClientAttachment.id == attachment_id, ClientAttachment.client_id == client_id
    ).first()
    if not attachment:
        raise NotFoundException("Attachment not found")
    full_path = get_attachment_full_path(attachment.file_path)
    if not full_path.exists():
        raise NotFoundException("File not found on server")
    return FileResponse(
        path=str(full_path),
        filename=attachment.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{client_id}/attachments/{attachment_id}")
def delete_attachment(
    client_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    attachment = db.query(ClientAttachment).filter(
        ClientAttachment.id == attachment_id, ClientAttachment.client_id == client_id
    ).first()
    if not attachment:
        raise NotFoundException("Attachment not found")
    filename = attachment.filename
    delete_attachment_file(attachment.file_path)
    db.delete(attachment)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Attachment '{filename}' was deleted", admin.id,
    )
    db.commit()
    return success_response(message="Attachment deleted")


@router.put("/{client_id}/tags")
def update_client_tags(
    client_id: int,
    payload: ClientTagsUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    client.tags = payload.tags
    if payload.custom_tags is not None:
        client.custom_tags = payload.custom_tags
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Tags updated for '{client.company_name}'", admin.id,
    )
    db.commit()
    db.refresh(client)
    return success_response(
        data={"tags": client.tags or [], "custom_tags": client.custom_tags or []},
        message="Tags updated",
    )


@router.put("/{client_id}/activities/{activity_id}")
def update_client_activity(
    client_id: int,
    activity_id: int,
    payload: ClientActivityUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    activity = db.query(ClientActivity).filter(
        ClientActivity.id == activity_id, ClientActivity.client_id == client_id
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Activity '{activity.title}' was updated", admin.id,
    )
    db.commit()
    db.refresh(activity)
    assignee = db.query(User).filter(User.id == activity.assigned_to_id).first() if activity.assigned_to_id else None
    creator = db.query(User).filter(User.id == activity.created_by).first()
    return success_response(
        data=ClientActivityResponse(
            id=activity.id,
            client_id=activity.client_id,
            title=activity.title,
            activity_type=activity.activity_type,
            activity_date=activity.activity_date,
            start_time=activity.start_time,
            end_time=activity.end_time,
            duration_minutes=activity.duration_minutes,
            location=activity.location,
            description=activity.description,
            assigned_to_id=activity.assigned_to_id,
            assigned_to_name=assignee.name if assignee else None,
            share_with_guests=activity.share_with_guests,
            created_by=activity.created_by,
            created_by_name=creator.name if creator else None,
            created_at=activity.created_at,
        ).model_dump(),
        message="Activity updated",
    )


@router.post("/{client_id}/activities")
def create_client_activity(
    client_id: int,
    payload: ClientActivityCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise NotFoundException("Client not found")
    activity = ClientActivity(
        client_id=client_id,
        created_by=admin.id,
        **payload.model_dump(),
    )
    db.add(activity)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Activity '{payload.title}' was created", admin.id,
    )
    db.commit()
    db.refresh(activity)
    assignee = db.query(User).filter(User.id == activity.assigned_to_id).first() if activity.assigned_to_id else None
    return success_response(
        data=ClientActivityResponse(
            id=activity.id,
            client_id=activity.client_id,
            title=activity.title,
            activity_type=activity.activity_type,
            activity_date=activity.activity_date,
            start_time=activity.start_time,
            end_time=activity.end_time,
            duration_minutes=activity.duration_minutes,
            location=activity.location,
            description=activity.description,
            assigned_to_id=activity.assigned_to_id,
            assigned_to_name=assignee.name if assignee else None,
            share_with_guests=activity.share_with_guests,
            created_by=activity.created_by,
            created_by_name=admin.name,
            created_at=activity.created_at,
        ).model_dump(),
        message="Activity created",
    )


@router.delete("/{client_id}/activities/{activity_id}")
def delete_client_activity(
    client_id: int,
    activity_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    activity = db.query(ClientActivity).filter(
        ClientActivity.id == activity_id, ClientActivity.client_id == client_id
    ).first()
    if not activity:
        raise NotFoundException("Activity not found")
    title = activity.title
    db.delete(activity)
    log_activity(
        db, EntityType.CLIENT, client_id, ActivityAction.UPDATED,
        f"Activity '{title}' was deleted", admin.id,
    )
    db.commit()
    return success_response(message="Activity deleted")
