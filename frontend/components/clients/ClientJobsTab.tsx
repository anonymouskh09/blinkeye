"use client";

import JobsListTable from "@/components/jobs/JobsListTable";
import type { Job, JobSummary } from "@/types";

interface Props {
  client: { id: number; company_name: string };
  jobs: JobSummary[];
  onRefresh: () => void;
}

export default function ClientJobsTab({ client, jobs, onRefresh }: Props) {
  const mapped: Job[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    status: j.status,
    location: j.location,
    candidate_count: j.candidate_count,
    created_at: j.created_at,
    updated_at: j.created_at,
    salary_min: j.salary_min,
    salary_max: j.salary_max,
    number_of_positions: j.number_of_positions ?? 1,
    assigned_recruiter_id: j.assigned_recruiter_id,
    assigned_recruiter_name: j.assigned_recruiter_name,
    client_id: client.id,
    client_name: client.company_name,
    engagement_id: j.engagement_id ?? 0,
    engagement_name: j.engagement_name,
    job_type: "full-time",
  }));

  return <JobsListTable jobs={mapped} onRefresh={onRefresh} showClient={true} />;
}
