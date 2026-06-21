# RecruitPro - Recruitment Agency Management System

Full-stack recruitment agency management platform with role-based access, hiring pipeline, and reporting.

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Recharts, @dnd-kit
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Alembic
- **Auth:** JWT in httpOnly cookies

## Project Structure

```
recruitment_software/
├── backend/          # FastAPI REST API
└── frontend/         # Next.js web application
```

## Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL (local installation)

## Database Setup

1. Create the database:
   ```sql
   CREATE DATABASE recruitment_db;
   ```

2. Copy environment file and configure:
   ```bash
   cd backend
   copy .env.example .env
   ```
   Update `DATABASE_URL` with your PostgreSQL credentials.

3. Install Python dependencies and run migrations:
   ```bash
   pip install -r requirements.txt
   alembic upgrade head
   python -m app.core.seed
   ```

## Running the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

Default admin credentials:
- Email: `admin@agency.com`
- Password: `Admin123!`

## Running the Frontend

```bash
cd frontend
copy .env.local.example .env.local
npm install
npm run dev
```

App: http://localhost:3000

## Features

- **Admin:** Full access to clients, jobs, team, candidates, pipeline, interviews, reports
- **Recruiter:** Assigned jobs, own candidates, interviews
- **Pipeline:** Kanban board with drag-and-drop stage management
- **CV Upload:** Local file storage (PDF/DOC/DOCX, max 10MB)
- **Activity Tracking:** Auto-logged timeline for all actions
- **Reports:** Client, job, recruiter, and pipeline analytics with CSV export

# blinkeye
