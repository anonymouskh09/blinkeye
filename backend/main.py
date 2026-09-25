from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.exceptions import AppException, app_exception_handler, generic_exception_handler, http_exception_handler
from app.core.response import success_response
from app.routers import auth, billing, candidates, clients, dashboard, engagements, extension, extension_management, folders, interviews, jobs, matches, matching, notes, offers, pipeline, placements, recruitment_center, reports, submissions, timesheets, users

from app.core.database import Base, engine
from app.core.seed import seed_admin
import app.services.match_refresh_worker  # noqa: F401  registers ORM hooks that keep match_scores fresh


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    try:
        seed_admin()
    except Exception as e:
        print(f"Seed info: {e}")

    from app.services import match_scheduler
    match_scheduler.start()
    yield
    match_scheduler.shutdown()


app = FastAPI(title="Recruitment Agency Management System", version="1.0.0", lifespan=lifespan)

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
app.include_router(offers.router)
app.include_router(placements.router)
app.include_router(billing.router)
app.include_router(timesheets.router)
app.include_router(interviews.router)
app.include_router(notes.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(recruitment_center.router)
app.include_router(matching.router)
app.include_router(matches.router)
app.include_router(extension.router)
app.include_router(extension_management.router)


@app.get("/health")
def health_check():
    return success_response(data={"status": "healthy"}, message="API is running")
