"""
Idempotent demo dataset for client demos.

Safe to re-run: records are keyed by stable emails / company names
and skipped when already present.

Usage:
  cd backend && python -m scripts.seed_demo_data
  # or:  py -3.10 -m scripts.seed_demo_data
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.client import Client
from app.models.client_contact import ClientContact
from app.models.engagement import Engagement
from app.models.enums import (
    BillingModel,
    CandidateStatus,
    ClientStage,
    ClientStatus,
    EngagementStatus,
    JobStatus,
    JobType,
    PipelineStage,
    ServiceModel,
    UserRole,
    UserStatus,
)
from app.models.job import Job
from app.models.note import Note
from app.models.user import User
from app.models.enums import EntityType

DEMO_TAG = "demo"


def _user(db: Session, email: str, **kwargs) -> User:
    u = db.query(User).filter(User.email == email).first()
    if u:
        return u
    u = User(email=email, password_hash=hash_password(kwargs.pop("password", "Demo123!")), **kwargs)
    db.add(u)
    db.flush()
    return u


def _client(db: Session, company_name: str, **kwargs) -> Client:
    c = db.query(Client).filter(Client.company_name == company_name).first()
    if c:
        return c
    c = Client(company_name=company_name, **kwargs)
    db.add(c)
    db.flush()
    return c


def _engagement(db: Session, client_id: int, name: str, **kwargs) -> Engagement:
    e = (
        db.query(Engagement)
        .filter(Engagement.client_id == client_id, Engagement.engagement_name == name)
        .first()
    )
    if e:
        return e
    e = Engagement(client_id=client_id, engagement_name=name, **kwargs)
    db.add(e)
    db.flush()
    return e


def _job(db: Session, title: str, client_id: int, **kwargs) -> Job:
    j = db.query(Job).filter(Job.title == title, Job.client_id == client_id).first()
    if j:
        # Refresh matching fields on re-seed so older demo jobs stay usable
        for k, v in kwargs.items():
            if v is not None:
                setattr(j, k, v)
        db.flush()
        return j
    j = Job(title=title, client_id=client_id, **kwargs)
    db.add(j)
    db.flush()
    return j


def _candidate(db: Session, email: str, **kwargs) -> Candidate:
    c = db.query(Candidate).filter(Candidate.email == email).first()
    if c:
        for k, v in kwargs.items():
            if v is not None and getattr(c, k, None) in (None, [], "", {}):
                setattr(c, k, v)
        # Always refresh skills/experience for demo quality
        for k in ("skills", "experience_years", "current_job_title", "location", "summary"):
            if k in kwargs and kwargs[k] is not None:
                setattr(c, k, kwargs[k])
        db.flush()
        return c
    c = Candidate(email=email, **kwargs)
    db.add(c)
    db.flush()
    return c


def _assign(db: Session, candidate_id: int, job_id: int, recruiter_id: int, status: PipelineStage):
    existing = (
        db.query(CandidateJobAssignment)
        .filter(
            CandidateJobAssignment.candidate_id == candidate_id,
            CandidateJobAssignment.job_id == job_id,
        )
        .first()
    )
    if existing:
        existing.status = status
        return existing
    a = CandidateJobAssignment(
        candidate_id=candidate_id,
        job_id=job_id,
        status=status,
        assigned_recruiter_id=recruiter_id,
    )
    db.add(a)
    db.flush()
    return a


def seed_demo(db: Session) -> dict:
    admin = db.query(User).filter(User.role == UserRole.ADMIN).order_by(User.id).first()
    if not admin:
        raise RuntimeError("No admin user found — run seed_admin first")

    manager = _user(
        db,
        "manager.demo@recruite.demo",
        name="Sara Ahmed",
        role=UserRole.MANAGER,
        status=UserStatus.ACTIVE,
        password="Demo123!",
    )
    recruiter1 = _user(
        db,
        "recruiter1.demo@recruite.demo",
        name="Hassan Ali",
        role=UserRole.RECRUITER,
        status=UserStatus.ACTIVE,
        password="Demo123!",
    )
    recruiter2 = _user(
        db,
        "recruiter2.demo@recruite.demo",
        name="Fatima Khan",
        role=UserRole.RECRUITER,
        status=UserStatus.ACTIVE,
        password="Demo123!",
    )

    # —— Clients ——
    nova = _client(
        db,
        "NovaTech Solutions",
        contact_person="Omar Sheikh",
        email="omar@novatech.demo",
        phone="+92-300-1112233",
        industry="Software / SaaS",
        location="Lahore, Pakistan",
        website="https://novatech.demo",
        description="Product company building HR & payroll SaaS for APAC.",
        status=ClientStatus.ACTIVE,
        stage=ClientStage.ACTIVE,
        owner_id=manager.id,
        tags=["enterprise", DEMO_TAG],
    )
    crest = _client(
        db,
        "Crest Finance Group",
        contact_person="Nadia Malik",
        email="nadia@crestfinance.demo",
        phone="+971-50-5556677",
        industry="FinTech",
        location="Dubai, UAE",
        website="https://crestfinance.demo",
        description="Regional fintech hiring for lending and risk platforms.",
        status=ClientStatus.ACTIVE,
        stage=ClientStage.CUSTOMER if hasattr(ClientStage, "CUSTOMER") else ClientStage.ACTIVE,
        owner_id=recruiter1.id,
        tags=["fintech", DEMO_TAG],
    )
    green = _client(
        db,
        "GreenLeaf Logistics",
        contact_person="Bilal Raza",
        email="bilal@greenleaf.demo",
        phone="+92-321-9988776",
        industry="Logistics",
        location="Karachi, Pakistan",
        website="https://greenleaf.demo",
        description="Cold-chain logistics expanding ops & tech hiring.",
        status=ClientStatus.ACTIVE,
        stage=ClientStage.LEAD,
        owner_id=recruiter2.id,
        tags=["logistics", DEMO_TAG],
    )

    if not db.query(ClientContact).filter(ClientContact.client_id == nova.id).first():
        db.add(
            ClientContact(
                client_id=nova.id,
                name="Omar Sheikh",
                email="omar@novatech.demo",
                phone="+92-300-1112233",
                title="CTO",
            )
        )

    # —— Engagements ——
    nova_eng = _engagement(
        db,
        nova.id,
        "NovaTech Full-Cycle Retainer 2026",
        status=EngagementStatus.ACTIVE,
        service_model=ServiceModel.FULL_CYCLE,
        billing_model=BillingModel.MONTHLY_RETAINER,
        currency="USD",
        monthly_fee=Decimal("4500"),
        included_hours=40,
        additional_hourly_rate=Decimal("75"),
        start_date=date.today() - timedelta(days=60),
        assigned_recruiter_id=recruiter1.id,
        notes="Priority: engineering + product roles",
    )
    crest_eng = _engagement(
        db,
        crest.id,
        "Crest Success-Fee Hiring",
        status=EngagementStatus.ACTIVE,
        service_model=ServiceModel.SOURCING_OUTREACH_QUALIFICATION,
        billing_model=BillingModel.SUCCESS_BASED,
        currency="USD",
        placement_fee_percent=Decimal("18"),
        guarantee_period_days=90,
        start_date=date.today() - timedelta(days=30),
        assigned_recruiter_id=recruiter1.id,
    )
    green_eng = _engagement(
        db,
        green.id,
        "GreenLeaf Hourly Sourcing",
        status=EngagementStatus.ACTIVE,
        service_model=ServiceModel.SOURCING_ONLY,
        billing_model=BillingModel.HOURLY,
        currency="USD",
        hourly_rate=Decimal("55"),
        rate=Decimal("55"),
        start_date=date.today() - timedelta(days=14),
        assigned_recruiter_id=recruiter2.id,
    )

    # —— Jobs (matching-ready) ——
    job_fe = _job(
        db,
        "Senior Frontend Engineer",
        nova.id,
        engagement_id=nova_eng.id,
        location="Lahore / Hybrid",
        job_type=JobType.FULL_TIME,
        salary_min=1800000,
        salary_max=2800000,
        must_have_skills=["React", "TypeScript", "JavaScript", "CSS", "Git"],
        nice_to_have_skills=["Next.js", "Tailwind CSS", "GraphQL"],
        min_experience_years=4,
        max_experience_years=8,
        required_skills="React, TypeScript, JavaScript, CSS, Git",
        description=(
            "Own complex UI features for our SaaS product. Work with design and backend "
            "on React + TypeScript. Strong CSS skills and accessibility mindset required."
        ),
        screening_questions=[
            "Walk me through a React feature you owned end-to-end.",
            "How do you approach performance bottlenecks in large SPAs?",
            "Describe your experience with TypeScript in production.",
        ],
        number_of_positions=2,
        status=JobStatus.ACTIVE,
        assigned_recruiter_id=recruiter1.id,
    )
    job_be = _job(
        db,
        "Backend Engineer (Python / FastAPI)",
        nova.id,
        engagement_id=nova_eng.id,
        location="Remote (Pakistan)",
        job_type=JobType.FULL_TIME,
        salary_min=1600000,
        salary_max=2500000,
        must_have_skills=["Python", "FastAPI", "PostgreSQL", "REST", "Git"],
        nice_to_have_skills=["Docker", "Redis", "AWS"],
        min_experience_years=3,
        max_experience_years=7,
        required_skills="Python, FastAPI, PostgreSQL, REST, Git",
        description=(
            "Build and maintain API services for HR workflows. Strong Python, FastAPI, "
            "and PostgreSQL experience. Comfortable with REST design and code reviews."
        ),
        screening_questions=[
            "Describe a FastAPI service you designed and how you structured it.",
            "How do you handle database migrations and schema changes safely?",
            "What is your approach to API authentication and authorization?",
        ],
        number_of_positions=1,
        status=JobStatus.ACTIVE,
        assigned_recruiter_id=recruiter1.id,
    )
    job_risk = _job(
        db,
        "Credit Risk Analyst",
        crest.id,
        engagement_id=crest_eng.id,
        location="Dubai, UAE",
        job_type=JobType.FULL_TIME,
        salary_min=12000,
        salary_max=18000,
        must_have_skills=["Credit Risk", "Excel", "SQL", "Financial Analysis"],
        nice_to_have_skills=["Python", "Power BI", "Basel"],
        min_experience_years=3,
        max_experience_years=6,
        required_skills="Credit Risk, Excel, SQL, Financial Analysis",
        description=(
            "Assess credit portfolios, build risk reports, partner with product on lending rules. "
            "Strong Excel/SQL and prior credit risk experience in banking or fintech."
        ),
        screening_questions=[
            "Explain a credit risk model or scorecard you worked on.",
            "How do you validate data quality before reporting?",
            "What KPIs do you track for portfolio health?",
        ],
        number_of_positions=1,
        status=JobStatus.ACTIVE,
        assigned_recruiter_id=recruiter1.id,
    )
    job_ops = _job(
        db,
        "Operations Coordinator",
        green.id,
        engagement_id=green_eng.id,
        location="Karachi, Pakistan",
        job_type=JobType.FULL_TIME,
        salary_min=80000,
        salary_max=120000,
        must_have_skills=["Operations", "Excel", "Communication", "Logistics"],
        nice_to_have_skills=["ERP", "Fleet Management"],
        min_experience_years=2,
        max_experience_years=5,
        required_skills="Operations, Excel, Communication, Logistics",
        description=(
            "Coordinate daily dispatch and warehouse handoffs. Strong communication, "
            "Excel tracking, and logistics experience preferred."
        ),
        screening_questions=[
            "How do you prioritize conflicting ops requests under time pressure?",
            "Describe a process you improved and the measurable result.",
        ],
        number_of_positions=2,
        status=JobStatus.ACTIVE,
        assigned_recruiter_id=recruiter2.id,
    )

    # —— Candidates ——
    created_by = admin.id
    cands = []

    profiles = [
        dict(
            email="aisha.react@demo.recruite",
            name="Aisha Raza",
            current_job_title="Senior Frontend Engineer",
            current_company="PixelCraft",
            experience_years=6,
            location="Lahore, Pakistan",
            skills=["React", "TypeScript", "JavaScript", "CSS", "Next.js", "Git", "Tailwind CSS"],
            expected_salary=2400000,
            salary_min=2200000,
            salary_max=2600000,
            summary="Frontend lead with SaaS product experience.",
            candidate_status=CandidateStatus.SHORTLISTED,
        ),
        dict(
            email="bilal.python@demo.recruite",
            name="Bilal Hussain",
            current_job_title="Python Backend Developer",
            current_company="CloudNest",
            experience_years=5,
            location="Islamabad, Pakistan",
            skills=["Python", "FastAPI", "PostgreSQL", "REST", "Docker", "Git", "Redis"],
            expected_salary=2200000,
            salary_min=2000000,
            salary_max=2400000,
            summary="API-focused backend engineer.",
            candidate_status=CandidateStatus.REVIEWED,
        ),
        dict(
            email="zara.fullstack@demo.recruite",
            name="Zara Imran",
            current_job_title="Full Stack Engineer",
            current_company="DevForge",
            experience_years=4,
            location="Lahore, Pakistan",
            skills=["React", "Node.js", "JavaScript", "PostgreSQL", "Git", "TypeScript"],
            expected_salary=2000000,
            summary="Full-stack with stronger frontend tilt.",
            candidate_status=CandidateStatus.NEW,
        ),
        dict(
            email="hamza.risk@demo.recruite",
            name="Hamza Siddiqui",
            current_job_title="Credit Risk Analyst",
            current_company="Gulf Bank",
            experience_years=4,
            location="Dubai, UAE",
            skills=["Credit Risk", "Excel", "SQL", "Financial Analysis", "Power BI"],
            expected_salary=15000,
            salary_min=14000,
            salary_max=17000,
            summary="Banking credit risk professional.",
            candidate_status=CandidateStatus.SHORTLISTED,
        ),
        dict(
            email="sana.ops@demo.recruite",
            name="Sana Qureshi",
            current_job_title="Logistics Coordinator",
            current_company="ShipFast PK",
            experience_years=3,
            location="Karachi, Pakistan",
            skills=["Operations", "Excel", "Communication", "Logistics", "ERP"],
            expected_salary=100000,
            summary="Ops coordinator for last-mile delivery.",
            candidate_status=CandidateStatus.NEW,
        ),
        dict(
            email="usman.junior@demo.recruite",
            name="Usman Tariq",
            current_job_title="Junior React Developer",
            current_company="StartupHub",
            experience_years=2,
            location="Lahore, Pakistan",
            skills=["React", "JavaScript", "HTML", "CSS", "Git"],
            expected_salary=900000,
            summary="Early-career frontend developer.",
            candidate_status=CandidateStatus.NEW,
        ),
        dict(
            email="maria.data@demo.recruite",
            name="Maria Noor",
            current_job_title="Data Analyst",
            current_company="Insight Labs",
            experience_years=5,
            location="Remote",
            skills=["SQL", "Excel", "Python", "Power BI", "Financial Analysis"],
            expected_salary=16000,
            summary="Analyst with fintech reporting background.",
            candidate_status=CandidateStatus.REVIEWED,
        ),
        dict(
            email="ali.devop@demo.recruite",
            name="Ali Rehman",
            current_job_title="DevOps Engineer",
            current_company="InfraScale",
            experience_years=6,
            location="Karachi, Pakistan",
            skills=["AWS", "Docker", "Kubernetes", "CI/CD", "Linux", "Git"],
            expected_salary=2500000,
            summary="Cloud infrastructure engineer.",
            candidate_status=CandidateStatus.NEW,
        ),
    ]

    for p in profiles:
        c = _candidate(
            db,
            p["email"],
            name=p["name"],
            current_job_title=p.get("current_job_title"),
            current_company=p.get("current_company"),
            experience_years=p.get("experience_years"),
            location=p.get("location"),
            skills=p.get("skills"),
            expected_salary=p.get("expected_salary"),
            salary_min=p.get("salary_min"),
            salary_max=p.get("salary_max"),
            summary=p.get("summary"),
            candidate_status=p.get("candidate_status", CandidateStatus.NEW),
            created_by=created_by,
            source="Demo Seed",
            is_archived=False,
        )
        cands.append(c)

    # Pipeline samples
    _assign(db, cands[0].id, job_fe.id, recruiter1.id, PipelineStage.SHORTLISTED)
    _assign(db, cands[2].id, job_fe.id, recruiter1.id, PipelineStage.APPLIED)
    _assign(db, cands[1].id, job_be.id, recruiter1.id, PipelineStage.CV_REVIEWED)
    _assign(db, cands[3].id, job_risk.id, recruiter1.id, PipelineStage.INTERVIEW_SCHEDULED)
    _assign(db, cands[4].id, job_ops.id, recruiter2.id, PipelineStage.APPLIED)

    cands[0].assigned_job_id = job_fe.id
    cands[1].assigned_job_id = job_be.id

    # Notes
    if not db.query(Note).filter(Note.content.like("%[Demo]%")).first():
        db.add(
            Note(
                entity_type=EntityType.CANDIDATE,
                entity_id=cands[0].id,
                content="[Demo] Strong React portfolio — schedule tech screen this week.",
                created_by=recruiter1.id,
            )
        )
        db.add(
            Note(
                entity_type=EntityType.CLIENT,
                entity_id=nova.id,
                content="[Demo] Client wants 2 FE engineers onboarded before end of month.",
                created_by=manager.id,
            )
        )
        db.add(
            Note(
                entity_type=EntityType.JOB,
                entity_id=job_fe.id,
                content="[Demo] Must-have skills and screening questions set for matching.",
                created_by=recruiter1.id,
            )
        )

    db.commit()
    return {
        "users": [manager.email, recruiter1.email, recruiter2.email],
        "clients": [nova.company_name, crest.company_name, green.company_name],
        "jobs": [job_fe.title, job_be.title, job_risk.title, job_ops.title],
        "candidates": len(cands),
        "login_hint": {
            "admin": "use existing ADMIN_EMAIL / ADMIN_PASSWORD",
            "demo_team_password": "Demo123!",
            "demo_emails": [
                "manager.demo@recruite.demo",
                "recruiter1.demo@recruite.demo",
                "recruiter2.demo@recruite.demo",
            ],
        },
    }


def main():
    db = SessionLocal()
    try:
        result = seed_demo(db)
        print("Demo data seeded successfully:")
        for k, v in result.items():
            print(f"  {k}: {v}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
