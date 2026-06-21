"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, UserCheck, Calendar, Trophy } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import StatCard from "@/components/dashboard/StatCard";
import Card, { CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, RecruiterDashboardStats, RecruiterJobProgress, ActivityLog, Interview } from "@/types";

interface RecruiterData {
  stats: RecruiterDashboardStats;
  assigned_jobs: RecruiterJobProgress[];
  upcoming_interviews: Interview[];
  recent_activity: ActivityLog[];
}

export default function MyJobsPage() {
  const [data, setData] = useState<RecruiterData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ApiResponse<RecruiterData>>("/dashboard/recruiter")
      .then((r) => setData(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageWrapper>
      <Header title="My Jobs" subtitle="Your assigned jobs and recruitment progress" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />) : (
          <>
            <StatCard title="Assigned Jobs" value={data?.stats.assigned_jobs ?? 0} icon={Briefcase} />
            <StatCard title="Candidates Added" value={data?.stats.candidates_added ?? 0} icon={UserCheck} color="bg-purple-50 text-purple-600" />
            <StatCard title="Interviews Scheduled" value={data?.stats.interviews_scheduled ?? 0} icon={Calendar} color="bg-orange-50 text-orange-600" />
            <StatCard title="Hired Candidates" value={data?.stats.hired_candidates ?? 0} icon={Trophy} color="bg-green-50 text-green-600" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Assigned Jobs Progress</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            {loading ? <StatCardSkeleton /> : data?.assigned_jobs?.length ? data.assigned_jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="block p-4 rounded-lg border hover:border-primary/30 transition-all">
                <div className="flex justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">{job.title}</p>
                    <p className="text-xs text-gray-500">{job.client_name}</p>
                  </div>
                  <span className="text-sm text-gray-500">{job.hired_count}/{job.total_candidates} hired</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${job.progress_percent}%` }} />
                </div>
              </Link>
            )) : <p className="text-gray-500 text-sm">No assigned jobs yet</p>}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Upcoming Interviews</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              {data?.upcoming_interviews?.length ? data.upcoming_interviews.map((i) => (
                <div key={i.id} className="text-sm border-b pb-2">
                  <p className="font-medium">{i.candidate_name}</p>
                  <p className="text-gray-500">{i.job_title} · {formatDate(i.interview_date)}</p>
                </div>
              )) : <p className="text-gray-500 text-sm">No upcoming interviews</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardBody className="space-y-3 max-h-60 overflow-y-auto">
              {data?.recent_activity?.length ? data.recent_activity.map((a) => (
                <div key={a.id} className="text-sm border-b pb-2">
                  <p className="text-gray-800">{a.description}</p>
                  <p className="text-xs text-gray-400">{formatDate(a.created_at)}</p>
                </div>
              )) : <p className="text-gray-500 text-sm">No recent activity</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageWrapper>
  );
}
