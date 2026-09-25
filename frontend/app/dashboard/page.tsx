"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Briefcase, CalendarDays, UserCheck, FileBadge2, Building2, Users, ArrowUpRight, Activity, Clock,
} from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import MetricCard from "@/components/dashboard/MetricCard";
import { BarChartCard, PieChartCard } from "@/components/dashboard/Charts";
import Card, { CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { useAuth, useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn, formatDate, getInitials } from "@/lib/utils";
import type { ApiResponse, DashboardStats, DashboardCharts, ActivityLog, Interview, TopJobItem } from "@/types";

import HeaderActions from "@/components/layout/HeaderActions";

interface RecentData {
  recent_activity: ActivityLog[];
  upcoming_interviews: Interview[];
  top_jobs: TopJobItem[];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function SectionHeader({ title, subtitle, href, icon: Icon }: { title: string; subtitle?: string; href?: string; icon: React.ElementType }) {
  return (
    <CardHeader className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <div>
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="text-[11px] font-medium text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {href && (
        <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-bold text-primary hover:text-primary-700">
          View all <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </CardHeader>
  );
}

function InterviewDate({ date }: { date: string }) {
  let month = "";
  let day = "";
  try {
    const d = new Date(`${date}T00:00:00`);
    month = format(d, "MMM");
    day = format(d, "d");
  } catch {
    day = date;
  }
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-primary-100 bg-primary-50">
      <span className="text-[10px] font-bold uppercase leading-none text-primary-500">{month}</span>
      <span className="mt-0.5 text-lg font-extrabold leading-none text-primary-700">{day}</span>
    </div>
  );
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
  const topJobMax = Math.max(1, ...(recent?.top_jobs ?? []).map((j) => j.candidate_count));

  return (
    <PageWrapper>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="page-eyebrow">Admin Dashboard</p>
        <HeaderActions showAddMenu />
      </div>

      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 px-6 py-7 text-white shadow-lg shadow-primary/20 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-56 w-56 rounded-full bg-white/[0.05]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-200">
              {format(new Date(), "EEEE, MMMM d")}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-[32px] sm:leading-tight">
              {greeting()}, {firstName}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm font-medium text-primary-100/90">
              Here&apos;s a snapshot of your recruitment pipeline, clients and team today.
            </p>
          </div>
          <div className="flex gap-3">
            {[
              { label: "Clients", value: stats?.total_clients, icon: Building2, href: "/clients" },
              { label: "Team", value: stats?.total_team_members, icon: Users, href: "/team" },
            ].map(({ label, value, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                className="flex min-w-[130px] items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                <Icon className="h-5 w-5 text-primary-200" />
                <div>
                  <p className="text-xl font-extrabold leading-none tabular-nums">{loading ? "—" : (value ?? 0).toLocaleString()}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary-200">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <MetricCard title="Total Candidates" value={stats?.total_candidates ?? 0} icon={UserCheck} tone="primary" caption="In your talent pool" />
            <MetricCard title="Active Jobs" value={stats?.total_active_jobs ?? 0} icon={Briefcase} tone="teal" caption="Open positions being worked" />
            <MetricCard title="Interviews This Week" value={stats?.interviews_this_week ?? 0} icon={CalendarDays} tone="amber" caption="Scheduled this week" />
            <MetricCard title="Offers Extended" value={stats?.offers_extended ?? 0} icon={FileBadge2} tone="emerald" caption="Offers sent to candidates" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 mb-6 lg:grid-cols-3">
        {loading ? Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />) : charts && (
          <>
            <BarChartCard title="Pipeline Stages" subtitle="Candidates by current stage" data={charts.pipeline_stages} />
            <PieChartCard title="Jobs by Status" subtitle="Distribution of all jobs" data={charts.jobs_by_status} />
            <BarChartCard title="Recruiter Performance" subtitle="Candidates handled per recruiter" data={charts.recruiter_performance} color="#2F7A64" />
          </>
        )}
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <SectionHeader title="Recent Activity" subtitle="Latest actions across the system" href="/activities" icon={Activity} />
          <CardBody className="py-4">
            {loading ? <TableSkeleton rows={5} cols={1} /> : (
              <div className="max-h-[340px] overflow-y-auto pr-1">
                {recent?.recent_activity?.length ? (
                  <ol className="relative ml-1.5 border-l-2 border-slate-100">
                    {recent.recent_activity.map((a) => (
                      <li key={a.id} className="relative pb-4 pl-5 last:pb-0">
                        <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-primary-500 ring-2 ring-primary-100" />
                        <p className="text-[13px] font-semibold leading-snug text-slate-800">{a.description}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          {a.created_by_name && <span className="font-semibold text-slate-500">{a.created_by_name}</span>}
                          {a.created_by_name && " · "}
                          {formatDate(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : <p className="py-8 text-center text-sm font-medium text-slate-400">No recent activity</p>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <SectionHeader title="Upcoming Interviews" subtitle="Next scheduled conversations" href="/interviews" icon={Clock} />
          <CardBody className="py-3">
            {loading ? <TableSkeleton rows={5} cols={1} /> : (
              <div className="divide-y divide-slate-100">
                {recent?.upcoming_interviews?.length ? recent.upcoming_interviews.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 py-3">
                    <InterviewDate date={i.interview_date} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-bold text-slate-900">{i.candidate_name}</p>
                      <p className="truncate text-xs font-medium text-slate-500">{i.job_title}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 tabular-nums">
                      {i.interview_time?.slice(0, 5)}
                    </span>
                  </div>
                )) : <p className="py-8 text-center text-sm font-medium text-slate-400">No upcoming interviews</p>}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <SectionHeader title="Top Jobs" subtitle="Ranked by candidates in pipeline" href="/jobs" icon={Briefcase} />
          <CardBody className="py-3">
            {loading ? <TableSkeleton rows={5} cols={2} /> : (
              <div className="divide-y divide-slate-100">
                {recent?.top_jobs?.length ? recent.top_jobs.map((j, idx) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="group block py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold",
                          idx === 0 ? "bg-primary-600 text-white" : "bg-primary-50 text-primary-600",
                        )}
                      >
                        {getInitials(j.client_name || j.title)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-bold text-slate-900 group-hover:text-primary">{j.title}</p>
                        <p className="truncate text-xs font-medium text-slate-500">{j.client_name}</p>
                      </div>
                      <span className="text-sm font-extrabold text-slate-900 tabular-nums">{j.candidate_count}</span>
                    </div>
                    <div className="mt-2 ml-12 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400"
                        style={{ width: `${(j.candidate_count / topJobMax) * 100}%` }}
                      />
                    </div>
                  </Link>
                )) : <p className="py-8 text-center text-sm font-medium text-slate-400">No jobs yet</p>}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </PageWrapper>
  );
}
