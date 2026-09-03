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
    ON_HOLD = "on_hold"
    CUSTOMER = "customer"  # legacy — prefer on_hold
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
    """Legacy global CRM profile status — NOT the job pipeline source of truth.

    Per-job pipeline status lives on CandidateJobAssignment.status (PipelineStage).
    Keep this enum for backward-compatible profile UI / filtering only.
    """

    NEW = "new"
    REVIEWED = "reviewed"
    SHORTLISTED = "shortlisted"
    INTERVIEWING = "interviewing"
    HIRED = "hired"
    REJECTED = "rejected"


class PipelineStage(str, enum.Enum):
    """Per CandidateJobAssignment pipeline stage — single source of truth for job pipeline."""

    APPLIED = "applied"
    CV_REVIEWED = "cv_reviewed"
    SHORTLISTED = "shortlisted"  # UI: Qualified
    PHONE_SCREENING = "phone_screening"  # UI: Submitted (set when a Submission is created)
    INTERVIEW_SCHEDULED = "interview_scheduled"  # UI: Interview
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

# Semantic aliases used by Submission / Client Feedback workflows
PIPELINE_QUALIFIED = PipelineStage.SHORTLISTED
PIPELINE_SUBMITTED = PipelineStage.PHONE_SCREENING
PIPELINE_INTERVIEW = PipelineStage.INTERVIEW_SCHEDULED


class SubmissionStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    CLIENT_REVIEWING = "client_reviewing"
    CLIENT_INTERESTED = "client_interested"
    REJECTED = "rejected"
    INTERVIEW_REQUESTED = "interview_requested"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    OFFER = "offer"
    PLACED = "placed"


# Statuses that block creating another submission for the same CandidateJob
SUBMISSION_ACTIVE_STATUSES = [
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.CLIENT_REVIEWING,
    SubmissionStatus.CLIENT_INTERESTED,
    SubmissionStatus.INTERVIEW_REQUESTED,
    SubmissionStatus.INTERVIEW_SCHEDULED,
    SubmissionStatus.OFFER,
    SubmissionStatus.PLACED,
]


class ClientFeedbackType(str, enum.Enum):
    INTERESTED = "interested"
    REJECTED = "rejected"
    INTERVIEW_REQUESTED = "interview_requested"
    MORE_INFORMATION_REQUESTED = "more_information_requested"
    GENERAL_FEEDBACK = "general_feedback"


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
    CANDIDATE_IMPORTED = "candidate_imported"


class EngagementStatus(str, enum.Enum):
    PROSPECT = "prospect"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ServiceModel(str, enum.Enum):
    SOURCING_ONLY = "sourcing_only"
    SOURCING_OUTREACH = "sourcing_outreach"
    SOURCING_OUTREACH_QUALIFICATION = "sourcing_outreach_qualification"
    FULL_CYCLE = "full_cycle"
    CUSTOM = "custom"


class BillingModel(str, enum.Enum):
    HOURLY = "hourly"
    MONTHLY_RETAINER = "monthly_retainer"
    SUCCESS_BASED = "success_based"
    HYBRID = "hybrid"
    FIXED = "fixed"


class OfferStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class PlacementStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    GUARANTEE_FAILED = "guarantee_failed"


class BillableItemType(str, enum.Enum):
    HOURLY = "hourly"
    RETAINER = "retainer"
    SUCCESS_FEE = "success_fee"
    FIXED = "fixed"
    OTHER = "other"


class BillableItemStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    INVOICED = "invoiced"
    VOID = "void"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    VOID = "void"
    OVERDUE = "overdue"


class InvoicePaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "bank_transfer"
    WIRE = "wire"
    CHECK = "check"
    CASH = "cash"
    OTHER = "other"


class TimesheetStatus(str, enum.Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"


class RevenueType(str, enum.Enum):
    HOURLY = "hourly"
    RETAINER = "retainer"
    SUCCESS_FEE = "success_fee"
    FIXED = "fixed"
    HYBRID = "hybrid"
    OTHER = "other"
