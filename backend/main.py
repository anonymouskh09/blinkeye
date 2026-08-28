from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import AppException, app_exception_handler, generic_exception_handler, http_exception_handler
from app.core.response import success_response
from app.routers import auth, candidates, clients, dashboard, engagements, extension, extension_management, folders, gmail, interviews, jobs, notes, outreach, pipeline, recruitment_center, reports, submissions, users
from app.services.outreach_scheduler_service import run_outreach_scheduler

from app.core.database import Base, engine
from app.core.seed import seed_admin

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        seed_admin()
    except Exception as e:
        print(f"Seed info: {e}")

    scheduler.add_job(run_outreach_scheduler, "interval", minutes=1, id="outreach_sender", replace_existing=True)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Recruitment Agency Management System", version="1.0.0", lifespan=lifespan)

if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET:
    print(f"Gmail OAuth configured (redirect: {settings.GOOGLE_REDIRECT_URI})")
else:
    print("WARNING: Gmail OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(engagements.router)
app.include_router(jobs.router)
app.include_router(users.router)
app.include_router(candidates.router)
app.include_router(folders.router)
app.include_router(pipeline.router)
app.include_router(submissions.router)
app.include_router(interviews.router)
app.include_router(notes.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(recruitment_center.router)
app.include_router(gmail.router)
app.include_router(outreach.router)
app.include_router(extension.router)
app.include_router(extension_management.router)


@app.get("/health")
def health_check():
    return success_response(data={"status": "healthy"}, message="API is running")
