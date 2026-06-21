"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import { BarChartCard, FunnelChart } from "@/components/dashboard/Charts";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { exportToCsv } from "@/lib/utils";
import type { ApiResponse } from "@/types";

type Tab = "clients" | "jobs" | "recruiters" | "pipeline";

interface ClientReport { client_name: string; total_jobs: number; active_jobs: number; closed_jobs: number; total_candidates: number; hired_count: number; }
interface JobReport { job_title: string; client_name: string; recruiter_name: string; total_candidates: number; shortlisted: number; interviewed: number; hired: number; rejected: number; }
interface RecruiterReport { recruiter_name: string; assigned_jobs: number; candidates_added: number; shortlisted: number; interviews_scheduled: number; hired: number; }
interface PipelineReport { stage: string; count: number; }

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

  const tabs: { id: Tab; label: string }[] = [
    { id: "clients", label: "Client Report" },
    { id: "jobs", label: "Job Report" },
    { id: "recruiters", label: "Recruiter Performance" },
    { id: "pipeline", label: "Candidate Status" },
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

  return (
    <PageWrapper>
      <Header title="Reports" subtitle="Analytics and performance reports" />

      <div className="content-panel">
        <div className="sub-tabs px-4">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`sub-tab ${tab === t.id ? "sub-tab-active" : "sub-tab-inactive"}`}>
            {t.label}
          </button>
        ))}
        </div>

        <div className="p-6">
      {loading ? <TableSkeleton rows={8} cols={6} /> : (
        <>
          {tab === "clients" && (
            <>
              <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" onClick={exportClients}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              </div>
              <TableWrapper>
                <thead><tr><Th>Client</Th><Th>Total Jobs</Th><Th>Active</Th><Th>Closed</Th><Th>Candidates</Th><Th>Hired</Th></tr></thead>
                <tbody>{clientData.map((r, i) => (
                  <Tr key={i}><Td>{r.client_name}</Td><Td>{r.total_jobs}</Td><Td>{r.active_jobs}</Td><Td>{r.closed_jobs}</Td><Td>{r.total_candidates}</Td><Td>{r.hired_count}</Td></Tr>
                ))}</tbody>
              </TableWrapper>
            </>
          )}

          {tab === "jobs" && (
            <>
              <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" onClick={exportJobs}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
              </div>
              <TableWrapper>
                <thead><tr><Th>Job</Th><Th>Client</Th><Th>Recruiter</Th><Th>Total</Th><Th>Shortlisted</Th><Th>Interviewed</Th><Th>Hired</Th><Th>Rejected</Th></tr></thead>
                <tbody>{jobData.map((r, i) => (
                  <Tr key={i}><Td>{r.job_title}</Td><Td>{r.client_name}</Td><Td>{r.recruiter_name}</Td><Td>{r.total_candidates}</Td><Td>{r.shortlisted}</Td><Td>{r.interviewed}</Td><Td>{r.hired}</Td><Td>{r.rejected}</Td></Tr>
                ))}</tbody>
              </TableWrapper>
            </>
          )}

          {tab === "recruiters" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TableWrapper>
                <thead><tr><Th>Recruiter</Th><Th>Jobs</Th><Th>Candidates</Th><Th>Shortlisted</Th><Th>Interviews</Th><Th>Hired</Th></tr></thead>
                <tbody>{recruiterData.map((r, i) => (
                  <Tr key={i}><Td>{r.recruiter_name}</Td><Td>{r.assigned_jobs}</Td><Td>{r.candidates_added}</Td><Td>{r.shortlisted}</Td><Td>{r.interviews_scheduled}</Td><Td>{r.hired}</Td></Tr>
                ))}</tbody>
              </TableWrapper>
              <BarChartCard title="Hired by Recruiter"
                data={recruiterData.map((r) => ({ name: r.recruiter_name, value: r.hired }))} />
            </div>
          )}

          {tab === "pipeline" && (
            <FunnelChart title="Pipeline Funnel"
              data={pipelineData.map((r) => ({ name: r.stage, value: r.count }))} />
          )}
        </>
      )}
        </div>
      </div>
    </PageWrapper>
  );
}
