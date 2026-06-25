import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    RECRUITER = "recruiter"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ClientStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ClientStage(str, enum.Enum):
    PROSPECT = "prospect"
    LEAD = "lead"
    ACTIVE = "active"
    CUSTOMER = "customer"
    INACTIVE = "inactive"


class JobType(str, enum.Enum):
    FULL_TIME = "full-time"
    PART_TIME = "part-time"
    CONTRACT = "contract"


class JobStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING = "pending"
    ON_HOLD = "on-hold"
    CLOSED = "closed"
    FILLED = "filled"


class CandidateStatus(str, enum.Enum):
    NEW = "new"
    REVIEWED = "reviewed"
    SHORTLISTED = "shortlisted"
    INTERVIEWING = "interviewing"
    HIRED = "hired"
    REJECTED = "rejected"


class PipelineStage(str, enum.Enum):
    APPLIED = "applied"
    CV_REVIEWED = "cv_reviewed"
    SHORTLISTED = "shortlisted"
    PHONE_SCREENING = "phone_screening"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_COMPLETED = "interview_completed"
    CLIENT_REVIEW = "client_review"
    OFFER_SENT = "offer_sent"
    HIRED = "hired"
    REJECTED = "rejected"


PIPELINE_STAGES_ORDER = [
    PipelineStage.APPLIED,
    PipelineStage.CV_REVIEWED,
    PipelineStage.SHORTLISTED,
    PipelineStage.PHONE_SCREENING,
    PipelineStage.INTERVIEW_SCHEDULED,
    PipelineStage.INTERVIEW_COMPLETED,
    PipelineStage.CLIENT_REVIEW,
    PipelineStage.OFFER_SENT,
    PipelineStage.HIRED,
    PipelineStage.REJECTED,
]


class InterviewType(str, enum.Enum):
    PHONE = "phone"
    ONLINE = "online"
    IN_PERSON = "in-person"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    RESCHEDULED = "rescheduled"


class EntityType(str, enum.Enum):
    CANDIDATE = "candidate"
    JOB = "job"
    CLIENT = "client"


class ActivityAction(str, enum.Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    STATUS_CHANGED = "status_changed"
    CV_UPLOADED = "cv_uploaded"
    NOTE_ADDED = "note_added"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_UPDATED = "interview_updated"
    INTERVIEW_CANCELLED = "interview_cancelled"
    ASSIGNED = "assigned"
