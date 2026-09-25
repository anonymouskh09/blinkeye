"use client";

import { useEffect, useState } from "react";
import { BarChart3, Building2, Briefcase, Download, Users, GitBranch } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import { BarChartCard, FunnelChart } from "@/components/dashboard/Charts";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn, exportToCsv, getInitials } from "@/lib/utils";
import type { ApiResponse } from "@/types";

type Tab = "clients" | "jobs" | "recruiters" | "pipeline";

interface ClientReport { client_name: string; total_jobs: number; active_jobs: number; closed_jobs: number; total_candidates: number; hired_count: number; }
interface JobReport { job_title: string; client_name: string; recruiter_name: string; total_candidates: number; shortlisted: number; interviewed: number; hired: number; rejected: number; }
interface RecruiterReport { recruiter_name: string; assigned_jobs: number; candidates_added: number; shortlisted: number; interviews_scheduled: number; hired: number; }
interface PipelineReport { stage: string; count: number; }

const sum = <T,>(rows: T[], pick: (r: T) => number) => rows.reduce((acc, r) => acc + (pick(r) || 0), 0);

function SummaryTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border px-4 py-3.5",
      accent ? "border-primary-600 bg-gradient-to-br from-primary-600 to-primary-800 text-white" : "border-slate-200 bg-white",
    )}>
      <p className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-primary-200" : "text-slate-500")}>{label}</p>
      <p className={cn("mt-1.5 text-2xl font-extrabold leading-none tabular-nums", accent ? "text-white" : "text-slate-900")}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Num({ value, tone }: { value: number; tone?: "success" | "danger" | "primary" }) {
  if (!tone) return <span className="font-semibold tabular-nums text-slate-700">{value}</span>;
  const styles = {
    success: "bg-emerald-50 text-emerald-700",
    danger: "bg-rose-50 text-rose-600",
    primary: "bg-primary-50 text-primary-600",
  };
  return (
    <span className={cn("inline-flex min-w-[32px] justify-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums", value ? styles[tone] : "bg-slate-50 text-slate-400")}>
      {value}
    </span>
  );
}

function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-[11px] font-extrabold text-primary-600">
        {getInitials(name || "?")}
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{name}</p>
        {sub && <p className="truncate text-xs font-medium text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr><td colSpan={cols} className="px-5 py-14 text-center text-sm font-medium text-slate-400">No data available</td></tr>
  );
}

export default function ReportsPage() {
  useRequireRole("admin");
  const [tab, setTab] = useState<Tab>("clients");
  const [loading, setLoading] = useState(true);
  const [clientData, setClientData] = useState<ClientReport[]>([]);
  const [jobData, setJobData] = useState<JobReport[]>([]);
  const [recruiterData, setRecruiterData] = useState<RecruiterReport[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineReport[]>([]);

  useEffect(() => {
    setLoading(true);
    const endpoints: Record<Tab, string> = {
      clients: "/reports/clients", jobs: "/reports/jobs",
      recruiters: "/reports/recruiters", pipeline: "/reports/pipeline",
    };
    api.get<ApiResponse<{ items: unknown[] }>>(endpoints[tab]).then((r) => {
      const items = r.data.data.items;
      if (tab === "clients") setClientData(items as ClientReport[]);
      if (tab === "jobs") setJobData(items as JobReport[]);
      if (tab === "recruiters") setRecruiterData(items as RecruiterReport[]);
      if (tab === "pipeline") setPipelineData(items as PipelineReport[]);
    }).finally(() => setLoading(false));
  }, [tab]);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "clients", label: "Client Report", icon: Building2 },
    { id: "jobs", label: "Job Report", icon: Briefcase },
    { id: "recruiters", label: "Recruiter Performance", icon: Users },
    { id: "pipeline", label: "Candidate Status", icon: GitBranch },
  ];

  const exportClients = () => {
    exportToCsv("client-report.csv",
      ["Client", "Total Jobs", "Active", "Closed", "Candidates", "Hired"],
      clientData.map((r) => [r.client_name, String(r.total_jobs), String(r.active_jobs), String(r.closed_jobs), String(r.total_candidates), String(r.hired_count)]));
  };

  const exportJobs = () => {
    exportToCsv("job-report.csv",
      ["Job", "Client", "Recruiter", "Total", "Shortlisted", "Interviewed", "Hired", "Rejected"],
      jobData.map((r) => [r.job_title, r.client_name, r.recruiter_name, String(r.total_candidates), String(r.shortlisted), String(r.interviewed), String(r.hired), String(r.rejected)]));
  };

  const exportAction = tab === "clients" ? exportClients : tab === "jobs" ? exportJobs : null;

  return (
    <PageWrapper>
      <Header
        title="Reports"
        subtitle="Analytics and performance reports"
        icon={<BarChart3 className="h-5 w-5" />}
        actions={exportAction && (
          <Button variant="outline" size="sm" onClick={exportAction} disabled={loading}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      />

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-card scrollbar-none">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-[13px] font-bold transition-all",
              tab === id ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card"><TableSkeleton rows={8} cols={6} /></div>
      ) : (
        <>
          {tab === "clients" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryTile label="Clients" value={clientData.length} accent />
                <SummaryTile label="Total Jobs" value={sum(clientData, (r) => r.total_jobs)} />
                <SummaryTile label="Candidates" value={sum(clientData, (r) => r.total_candidates)} />
                <SummaryTile label="Hired" value={sum(clientData, (r) => r.hired_count)} />
              </div>
              <TableWrapper>
                <thead><tr><Th>Client</Th><Th>Total Jobs</Th><Th>Active</Th><Th>Closed</Th><Th>Candidates</Th><Th>Hired</Th></tr></thead>
                <tbody>
                  {clientData.length ? clientData.map((r, i) => (
                    <Tr key={i}>
                      <Td><NameCell name={r.client_name} /></Td>
                      <Td><Num value={r.total_jobs} /></Td>
                      <Td><Num value={r.active_jobs} tone="primary" /></Td>
                      <Td><Num value={r.closed_jobs} /></Td>
                      <Td><Num value={r.total_candidates} /></Td>
                      <Td><Num value={r.hired_count} tone="success" /></Td>
                    </Tr>
                  )) : <EmptyRow cols={6} />}
                </tbody>
              </TableWrapper>
            </>
          )}

          {tab === "jobs" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryTile label="Jobs" value={jobData.length} accent />
                <SummaryTile label="Candidates" value={sum(jobData, (r) => r.total_candidates)} />
                <SummaryTile label="Interviewed" value={sum(jobData, (r) => r.interviewed)} />
                <SummaryTile label="Hired" value={sum(jobData, (r) => r.hired)} />
              </div>
              <TableWrapper>
                <thead><tr><Th>Job</Th><Th>Recruiter</Th><Th>Total</Th><Th>Shortlisted</Th><Th>Interviewed</Th><Th>Hired</Th><Th>Rejected</Th></tr></thead>
                <tbody>
                  {jobData.length ? jobData.map((r, i) => (
                    <Tr key={i}>
                      <Td><NameCell name={r.job_title} sub={r.client_name} /></Td>
                      <Td><span className="font-semibold text-slate-700">{r.recruiter_name || "—"}</span></Td>
                      <Td><Num value={r.total_candidates} /></Td>
                      <Td><Num value={r.shortlisted} tone="primary" /></Td>
                      <Td><Num value={r.interviewed} tone="primary" /></Td>
                      <Td><Num value={r.hired} tone="success" /></Td>
                      <Td><Num value={r.rejected} tone="danger" /></Td>
                    </Tr>
                  )) : <EmptyRow cols={7} />}
                </tbody>
              </TableWrapper>
            </>
          )}

          {tab === "recruiters" && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryTile label="Recruiters" value={recruiterData.length} accent />
                <SummaryTile label="Candidates Added" value={sum(recruiterData, (r) => r.candidates_added)} />
                <SummaryTile label="Interviews" value={sum(recruiterData, (r) => r.interviews_scheduled)} />
                <SummaryTile label="Hired" value={sum(recruiterData, (r) => r.hired)} />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <TableWrapper className="xl:col-span-3">
                  <thead><tr><Th>Recruiter</Th><Th>Jobs</Th><Th>Candidates</Th><Th>Shortlisted</Th><Th>Interviews</Th><Th>Hired</Th></tr></thead>
                  <tbody>
                    {recruiterData.length ? recruiterData.map((r, i) => (
                      <Tr key={i}>
                        <Td><NameCell name={r.recruiter_name} /></Td>
                        <Td><Num value={r.assigned_jobs} /></Td>
                        <Td><Num value={r.candidates_added} /></Td>
                        <Td><Num value={r.shortlisted} tone="primary" /></Td>
                        <Td><Num value={r.interviews_scheduled} tone="primary" /></Td>
                        <Td><Num value={r.hired} tone="success" /></Td>
                      </Tr>
                    )) : <EmptyRow cols={6} />}
                  </tbody>
                </TableWrapper>
                <div className="xl:col-span-2">
                  <BarChartCard title="Hired by Recruiter" subtitle="Successful placements per recruiter"
                    data={recruiterData.map((r) => ({ name: r.recruiter_name, value: r.hired }))} />
                </div>
              </div>
            </>
          )}

          {tab === "pipeline" && (
            <FunnelChart title="Pipeline Funnel" subtitle="Candidates at each stage of the hiring process"
              data={pipelineData.map((r) => ({ name: r.stage, value: r.count }))} />
          )}
        </>
      )}
    </PageWrapper>
  );
}
