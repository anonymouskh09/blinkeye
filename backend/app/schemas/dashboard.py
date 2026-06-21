from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_clients: int
    total_active_jobs: int
    total_candidates: int
    total_team_members: int


class RecruiterDashboardStats(BaseModel):
    assigned_jobs: int
    candidates_added: int
    interviews_scheduled: int
    hired_candidates: int


class ChartDataPoint(BaseModel):
    name: str
    value: int


class DashboardCharts(BaseModel):
    pipeline_stages: list[ChartDataPoint]
    jobs_by_status: list[ChartDataPoint]
    recruiter_performance: list[ChartDataPoint]


class TopJobItem(BaseModel):
    id: int
    title: str
    client_name: str
    candidate_count: int


class RecruiterJobProgress(BaseModel):
    id: int
    title: str
    client_name: str
    status: str
    total_candidates: int
    hired_count: int
    progress_percent: float


class DashboardRecentActivity(BaseModel):
    recent_activity: list
    upcoming_interviews: list
    top_jobs: list[TopJobItem]


class RecruiterDashboardData(BaseModel):
    stats: RecruiterDashboardStats
    assigned_jobs: list[RecruiterJobProgress]
    upcoming_interviews: list
    recent_activity: list
