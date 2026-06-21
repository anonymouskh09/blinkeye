from app.models.enums import UserRole
from app.models.job import Job
from app.models.user import User
from app.core.exceptions import ForbiddenException, NotFoundException


def can_access_job(user: User, job: Job) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    return job.assigned_recruiter_id == user.id


def require_job_access(user: User, job: Job) -> None:
    if not can_access_job(user, job):
        raise ForbiddenException("You do not have access to this job")


def get_job_or_404(db, job_id: int) -> Job:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise NotFoundException("Job not found")
    return job
