"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, ChevronDown, LayoutGrid, List, MoreVertical, Filter, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import JobsListTable, { JOB_STAGES } from "@/components/jobs/JobsListTable";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import ClientAvatar from "@/components/clients/ClientAvatar";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import HeaderActions from "@/components/layout/HeaderActions";
import type { JobStatus } from "@/types";

type ViewMode = "list" | "board";

const BOARD_STATUSES: JobStatus[] = ["active", "pending", "on-hold", "closed", "filled"];

export default function JobsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [data, setData] = useState<PaginatedData<Job> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: view === "board" ? 100 : 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<ApiResponse<PaginatedData<Job>>>("/jobs", { params });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, view]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const boardGroups = BOARD_STATUSES.reduce((acc, s) => {
    acc[s] = (data?.items || []).filter((j) => j.status === s);
    return acc;
  }, {} as Record<JobStatus, Job[]>);

  return (
    <PageWrapper flush>
      <div className="content-panel content-panel-flush">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <h1 className="panel-title text-lg sm:text-xl font-bold text-[#1F574A]">Jobs</h1>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <HeaderActions addLabel="Job" onAddClick={isAdmin ? () => router.push("/jobs/new") : undefined} />
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <TableSkeleton rows={6} cols={10} />
          ) : view === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {BOARD_STATUSES.map((status) => (
                <div key={status} className="flex-shrink-0 w-72 bg-gray-50/80 rounded-2xl p-3 border border-gray-200/60">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{JOB_STAGES[status] || status}</h3>
                    <span className="text-xs bg-white text-gray-600 px-2.5 py-0.5 rounded-lg font-semibold shadow-sm border border-gray-100">
                      {boardGroups[status]?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(boardGroups[status] || []).map((j) => (
                      <Link key={j.id} href={`/jobs/${j.id}`}
                        className="block bg-white border border-gray-200/80 rounded-xl p-3.5 hover:shadow-card-hover hover:border-primary/20 transition-all">
                        <p className="font-medium text-sm text-primary mb-1">{j.title}</p>
                        {j.client_name && (
                          <div className="flex items-center gap-2 mb-2">
                            <ClientAvatar name={j.client_name} size="sm" className="!bg-amber-400 !text-amber-900" />
                            <span className="text-xs text-gray-600">{j.client_name}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">{j.candidate_count} - {j.number_of_positions} headcount</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.items?.length ? (
            <EmptyState
              title="No jobs found"
              description="Create a job to start recruiting."
              actionLabel={isAdmin ? "Create Job" : undefined}
              onAction={isAdmin ? () => router.push("/jobs/new") : undefined}
            />
          ) : (
            <>
              <JobsListTable jobs={data.items} onRefresh={fetchJobs} hideToolbar />
              <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title..." />
          <Select label="Status" placeholder="All Status"
            options={[
              { value: "active", label: "Active" }, { value: "pending", label: "Pending" },
              { value: "on-hold", label: "On Hold" }, { value: "closed", label: "Closed" },
              { value: "filled", label: "Filled" },
            ]}
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={() => { setFilterOpen(false); setPage(1); fetchJobs(); }}>Apply</Button>
            <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); setFilterOpen(false); }}>Clear</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
