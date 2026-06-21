from pydantic import BaseModel


class ClientReportItem(BaseModel):
    client_name: str
    total_jobs: int
    active_jobs: int
    closed_jobs: int
    total_candidates: int
    hired_count: int


class JobReportItem(BaseModel):
    job_title: str
    client_name: str
    recruiter_name: str
    total_candidates: int
    shortlisted: int
    interviewed: int
    hired: int
    rejected: int


class RecruiterReportItem(BaseModel):
    recruiter_name: str
    assigned_jobs: int
    candidates_added: int
    shortlisted: int
    interviews_scheduled: int
    hired: int


class PipelineReportItem(BaseModel):
    stage: str
    count: int
