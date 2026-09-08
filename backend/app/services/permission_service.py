from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.exceptions import ForbiddenException, NotFoundException
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.client_hidden import ClientHiddenMember
from app.models.client_team import ClientTeamMember
from app.models.enums import UserRole
from app.models.job import Job
from app.models.user import User

PERM_FIELDS = (
    "can_view_clients",
    "can_add_clients",
    "can_edit_clients",
    "can_view_jobs",
    "can_add_jobs",
    "can_edit_jobs",
    "can_view_candidates",
    "can_add_candidates",
    "can_edit_candidates",
)


def is_admin(user: User) -> bool:
    return user.role == UserRole.ADMIN


def permissions_dict(user: User) -> dict[str, bool]:
    if is_admin(user):
        return {f: True for f in PERM_FIELDS}
    return {f: bool(getattr(user, f, False)) for f in PERM_FIELDS}


def has_permission(user: User, field: str) -> bool:
    if is_admin(user):
        return True
    return bool(getattr(user, field, False))


def require_permission(user: User, field: str, message: str | None = None) -> None:
    if not has_permission(user, field):
        raise ForbiddenException(message or "You do not have permission for this action")


def make_permission_dep(field: str, message: str):
    def _dep(current_user: User = Depends(get_current_user)) -> User:
        require_permission(current_user, field, message)
        return current_user

    return _dep


require_view_clients = make_permission_dep("can_view_clients", "You do not have permission to view clients")
require_add_clients = make_permission_dep("can_add_clients", "You do not have permission to add clients")
require_edit_clients = make_permission_dep("can_edit_clients", "You do not have permission to edit clients")
require_view_jobs = make_permission_dep("can_view_jobs", "You do not have permission to view jobs")
require_add_jobs = make_permission_dep("can_add_jobs", "You do not have permission to add jobs")
require_edit_jobs = make_permission_dep("can_edit_jobs", "You do not have permission to edit jobs")
require_view_candidates = make_permission_dep("can_view_candidates", "You do not have permission to view candidates")
require_add_candidates = make_permission_dep("can_add_candidates", "You do not have permission to add candidates")
require_edit_candidates = make_permission_dep("can_edit_candidates", "You do not have permission to edit candidates")


def _explicit_hidden_client_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ClientHiddenMember.client_id).filter(ClientHiddenMember.user_id == user.id).all()
    return {r[0] for r in rows}


def _team_client_ids(db: Session, user: User) -> set[int]:
    rows = db.query(ClientTeamMember.client_id).filter(ClientTeamMember.user_id == user.id).all()
    owned = db.query(Client.id).filter(Client.owner_id == user.id).all()
    return {r[0] for r in rows} | {r[0] for r in owned}


def private_team_client_ids(db: Session, user: User) -> set[int]:
    """Private clients this user is assigned to (or owns)."""
    if is_admin(user):
        return set()
    team_ids = _team_client_ids(db, user)
    if not team_ids:
        return set()
    rows = (
        db.query(Client.id)
        .filter(Client.id.in_(team_ids), Client.visibility == "private")
        .all()
    )
    return {r[0] for r in rows}


def inaccessible_client_ids(db: Session, user: User) -> set[int]:
    """
    Clients this user must not see.
    - public: visible to everyone (except explicit hide)
    - private: only owner / assigned team members / admin
    """
    if is_admin(user):
        return set()

    explicit = _explicit_hidden_client_ids(db, user)
    team_ids = _team_client_ids(db, user)

    private_rows = db.query(Client.id).filter(Client.visibility == "private").all()
    private_ids = {r[0] for r in private_rows}
    private_blocked = private_ids - team_ids

    return explicit | private_blocked


def can_see_client(db: Session, user: User, client_id: int) -> bool:
    if is_admin(user):
        return True
    return client_id not in inaccessible_client_ids(db, user)


def is_client_hidden_from(db: Session, user: User, client_id: int) -> bool:
    """Alias used by routers — True when user cannot see the client."""
    return not can_see_client(db, user, client_id)


def require_client_visible(db: Session, user: User, client_id: int) -> None:
    if not can_see_client(db, user, client_id):
        raise NotFoundException("Client not found")


def apply_hidden_clients_filter(query, db: Session, user: User, client_id_column):
    """Exclude clients (or rows keyed by client_id) the user cannot see."""
    blocked = inaccessible_client_ids(db, user)
    if blocked:
        query = query.filter(~client_id_column.in_(blocked))
    return query


def hidden_job_ids(db: Session, user: User) -> set[int]:
    blocked = inaccessible_client_ids(db, user)
    if not blocked:
        return set()
    rows = db.query(Job.id).filter(Job.client_id.in_(blocked)).all()
    return {r[0] for r in rows}


def apply_hidden_candidates_filter(query, db: Session, user: User):
    """Hide candidates tied to jobs of clients the user cannot see."""
    job_ids = hidden_job_ids(db, user)
    if not job_ids:
        return query
    assigned_ids = (
        db.query(CandidateJobAssignment.candidate_id)
        .filter(CandidateJobAssignment.job_id.in_(job_ids))
        .distinct()
    )
    return query.filter(
        ~Candidate.id.in_(assigned_ids),
        (Candidate.assigned_job_id.is_(None)) | (~Candidate.assigned_job_id.in_(job_ids)),
    )


def apply_jobs_visibility_filter(query, db: Session, user: User):
    """
    Non-admins see every job whose client they can access
    (public clients + private clients they are assigned to).
    """
    if is_admin(user):
        return query

    blocked = inaccessible_client_ids(db, user)
    if blocked:
        query = query.filter(~Job.client_id.in_(blocked))
    return query


def can_access_job(user: User, job: Job, db: Session | None = None) -> bool:
    if is_admin(user):
        return True
    if not has_permission(user, "can_view_jobs"):
        return False
    if db is not None:
        return can_see_client(db, user, job.client_id)
    # Without db, fall back to assignee check only
    return job.assigned_recruiter_id == user.id


def require_job_access(user: User, job: Job, db: Session | None = None) -> None:
    if not can_access_job(user, job, db):
        raise ForbiddenException("You do not have access to this job")


def get_job_or_404(db: Session, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    return job
