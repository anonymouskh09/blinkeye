"use client";

import { useEffect, useState } from "react";
import { Briefcase, CalendarDays, UserCheck, FileBadge2 } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import MetricCard from "@/components/dashboard/MetricCard";
import { BarChartCard, PieChartCard } from "@/components/dashboard/Charts";
import Card, { CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useAuth, useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ApiResponse, DashboardStats, DashboardCharts, ActivityLog, Interview, TopJobItem } from "@/types";

interface RecentData {
  recent_activity: ActivityLog[];
  upcoming_interviews: Interview[];
  top_jobs: TopJobItem[];
}

export default function DashboardPage() {
  useRequireRole("admin");
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [recent, setRecent] = useState<RecentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<DashboardStats>>("/dashboard/stats"),
      api.get<ApiResponse<DashboardCharts>>("/dashboard/charts"),
      api.get<ApiResponse<RecentData>>("/dashboard/recent-activity"),
    ]).then(([s, c, r]) => {
      setStats(s.data.data);
      setCharts(c.data.data);
      setRecent(r.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <PageWrapper>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Here&apos;s what&apos;s happening with your recruitment pipeline today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              title="Total Candidates"
              value={stats?.total_candidates ?? 0}
              icon={UserCheck}
              trend="↑ 12.5% vs last month"
            />
            <MetricCard
              title="Active Jobs"
              value={stats?.total_active_jobs ?? 0}
              icon={Briefcase}
              trend="↑ 9.1% vs last month"
            />
            <MetricCard
              title="Interviews This Week"
              value={stats?.interviews_this_week ?? 0}
              icon={CalendarDays}
              trend="↑ 20.0% vs last week"
            />
            <MetricCard
              title="Offers Extended"
              value={stats?.offers_extended ?? 0}
              icon={FileBadge2}
              trend="↑ 16.7% vs last month"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {loading ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />) : charts && (
          <>
            <BarChartCard title="Candidates by Pipeline Stage" data={charts.pipeline_stages} />
            <PieChartCard title="Jobs by Status" data={charts.jobs_by_status} />
            <BarChartCard title="Recruiter Performance" data={charts.recruiter_performance} color="#2F7A64" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardBody>
            {loading ? <TableSkeleton rows={5} cols={1} /> : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {recent?.recent_activity?.length ? recent.recent_activity.map((a) => (
                  <div key={a.id} className="text-sm border-b border-gray-100 pb-2">
                    <p className="text-gray-800">{a.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{a.created_by_name} · {formatDate(a.created_at)}</p>
                  </div>
                )) : <p className="text-gray-500 text-sm">No recent activity</p>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Upcoming Interviews</CardTitle></CardHeader>
          <CardBody>
            {loading ? <TableSkeleton rows={5} cols={1} /> : (
              <div className="space-y-3">
                {recent?.upcoming_interviews?.length ? recent.upcoming_interviews.map((i) => (
                  <div key={i.id} className="text-sm border-b border-gray-100 pb-2">
                    <p className="font-medium text-gray-800">{i.candidate_name}</p>
                    <p className="text-gray-500">{i.job_title} · {formatDateTime(i.interview_date, i.interview_time)}</p>
                  </div>
                )) : <p className="text-gray-500 text-sm">No upcoming interviews</p>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Top Jobs by Candidates</CardTitle></CardHeader>
          <CardBody>
            {loading ? <TableSkeleton rows={5} cols={2} /> : (
              <TableWrapper>
                <thead><tr><Th>Job</Th><Th>Count</Th></tr></thead>
                <tbody>
                  {recent?.top_jobs?.map((j) => (
                    <Tr key={j.id}>
                      <Td><span className="font-medium">{j.title}</span><br /><span className="text-xs text-gray-400">{j.client_name}</span></Td>
                      <Td>{j.candidate_count}</Td>
                    </Tr>
                  ))}
                </tbody>
              </TableWrapper>
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
