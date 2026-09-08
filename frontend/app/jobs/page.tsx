"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import JobsListTable, { JOB_STAGES } from "@/components/jobs/JobsListTable";
import CreateJobSlideOver from "@/components/jobs/CreateJobSlideOver";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import ListBulkBar from "@/components/ui/ListBulkBar";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import ClientAvatar from "@/components/clients/ClientAvatar";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { exportToCsv } from "@/lib/utils";
import { downloadCsvTemplate, parseCsv, pickCsvFile } from "@/lib/csv";
import HeaderActions from "@/components/layout/HeaderActions";
import type { JobStatus, Job, ApiResponse, PaginatedData } from "@/types";

type ViewMode = "list" | "board";

const BOARD_STATUSES: JobStatus[] = ["active", "pending", "on-hold", "closed", "filled"];

function jobRef(id: number) {
  return `Y${id.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

function JobsPageInner() {
  const { isAdmin, canAddJobs } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view] = useState<ViewMode>("list");
  const [data, setData] = useState<PaginatedData<Job> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillClientId, setPrefillClientId] = useState("");
  const [prefillEngagementId, setPrefillEngagementId] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);

  const openCreate = useCallback((clientId = "", engagementId = "") => {
    setPrefillClientId(clientId);
    setPrefillEngagementId(engagementId);
    setCreateOpen(true);
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      openCreate(searchParams.get("client_id") || "", searchParams.get("engagement_id") || "");
      router.replace("/jobs", { scroll: false });
    }
  }, [searchParams, openCreate, router]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: view === "board" ? 100 : 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get<ApiResponse<PaginatedData<Job>>>("/jobs", { params });
      setData(res.data.data);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, view]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const items = data?.items || [];

  const boardGroups = BOARD_STATUSES.reduce((acc, s) => {
    acc[s] = items.filter((j) => j.status === s);
    return acc;
  }, {} as Record<JobStatus, Job[]>);

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (items.length && items.every((j) => selectedIds.includes(j.id))) setSelectedIds([]);
    else setSelectedIds(items.map((j) => j.id));
  };

  const exportRows = selectedIds.length ? items.filter((j) => selectedIds.includes(j.id)) : items;

  const handleExport = () => {
    if (!exportRows.length) {
      toast.error("Nothing to export");
      return;
    }
    exportToCsv(
      "jobs.csv",
      ["reference", "title", "client", "location", "status", "headcount", "salary_min", "salary_max", "owner"],
      exportRows.map((j) => [
        jobRef(j.id),
        j.title || "",
        j.client_name || "",
        j.location || "",
        j.status || "",
        String(j.number_of_positions ?? ""),
        j.salary_min != null ? String(j.salary_min) : "",
        j.salary_max != null ? String(j.salary_max) : "",
        j.assigned_recruiter_name || "",
      ])
    );
    toast.success(`Exported ${exportRows.length} job(s)`);
  };

  const handleTemplate = () => {
    downloadCsvTemplate(
      "jobs_import_template.csv",
      ["title", "engagement_id", "location", "status", "number_of_positions", "salary_min", "salary_max"],
      ["Frontend Developer", "1", "Lahore", "active", "1", "80000", "120000"]
    );
    toast("Jobs import needs a valid engagement_id from an existing client engagement", { icon: "ℹ️" });
  };

  const handleImport = async () => {
    if (!canAddJobs && !isAdmin) {
      toast.error("You do not have permission to add jobs");
      return;
    }
    const file = await pickCsvFile();
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (!rows.length) {
        toast.error("CSV is empty");
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const row of rows) {
        const title = row.title || row.position_name || "";
        const engagementId = Number(row.engagement_id);
        if (!title.trim() || !engagementId) {
          fail++;
          continue;
        }
        try {
          await api.post("/jobs", {
            title: title.trim(),
            engagement_id: engagementId,
            location: row.location || null,
            status: row.status || "active",
            number_of_positions: row.number_of_positions ? Number(row.number_of_positions) : 1,
            salary_min: row.salary_min ? Number(row.salary_min) : null,
            salary_max: row.salary_max ? Number(row.salary_max) : null,
          });
          ok++;
        } catch {
          fail++;
        }
      }
      toast.success(`Imported ${ok} job(s)${fail ? `, ${fail} failed` : ""}`);
      fetchJobs();
    } catch {
      toast.error("Failed to import CSV");
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageWrapper flush>
      <div className="content-panel content-panel-flush">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <h1 className="panel-title text-lg sm:text-xl font-bold text-[#1F574A]">Jobs</h1>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          <HeaderActions
            addLabel="Job"
            onAddClick={isAdmin || canAddJobs ? () => openCreate() : undefined}
          />
        </div>

        {view === "list" && (
          <ListBulkBar
            selectedCount={selectedIds.length}
            totalVisible={items.length}
            onClearSelection={() => setSelectedIds([])}
            onImportCsv={handleImport}
            onExportCsv={handleExport}
            onDownloadTemplate={handleTemplate}
            importing={importing}
          />
        )}

        <div className="px-6 py-5">
          {loading ? (
            <TableSkeleton rows={6} cols={10} />
          ) : view === "board" ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {BOARD_STATUSES.map((status) => (
                <div
                  key={status}
                  className="flex-shrink-0 w-72 bg-gray-50/80 rounded-2xl p-3 border border-gray-200/60"
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      {JOB_STAGES[status] || status}
                    </h3>
                    <span className="text-xs bg-white text-gray-600 px-2.5 py-0.5 rounded-lg font-semibold shadow-sm border border-gray-100">
                      {boardGroups[status]?.length || 0}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(boardGroups[status] || []).map((j) => (
                      <Link
                        key={j.id}
                        href={`/jobs/${j.id}`}
                        className="block bg-white border border-gray-200/80 rounded-xl p-3.5 hover:shadow-card-hover hover:border-primary/20 transition-all"
                      >
                        <p className="font-medium text-sm text-primary mb-1">{j.title}</p>
                        {j.client_name && (
                          <div className="flex items-center gap-2 mb-2">
                            <ClientAvatar
                              name={j.client_name}
                              size="sm"
                              className="!bg-amber-400 !text-amber-900"
                            />
                            <span className="text-xs text-gray-600">{j.client_name}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-400">
                          {j.candidate_count} - {j.number_of_positions} headcount
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !items.length ? (
            <EmptyState
              title="No jobs found"
              description="Create a job to start recruiting."
              actionLabel={isAdmin || canAddJobs ? "Create Job" : undefined}
              onAction={isAdmin || canAddJobs ? () => openCreate() : undefined}
            />
          ) : (
            <>
              <JobsListTable
                jobs={items}
                onRefresh={fetchJobs}
                hideToolbar
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
              <Pagination page={page} totalPages={data?.total_pages || 1} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title..."
          />
          <Select
            label="Status"
            placeholder="All Status"
            options={[
              { value: "active", label: "Active" },
              { value: "pending", label: "Pending" },
              { value: "on-hold", label: "On Hold" },
              { value: "closed", label: "Closed" },
              { value: "filled", label: "Filled" },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setFilterOpen(false);
                setPage(1);
                fetchJobs();
              }}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setPage(1);
                setFilterOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Modal>

      <CreateJobSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={fetchJobs}
        prefillClientId={prefillClientId}
        prefillEngagementId={prefillEngagementId}
      />
    </PageWrapper>
  );
}

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper flush>
          <div className="p-8 text-gray-500">Loading...</div>
        </PageWrapper>
      }
    >
      <JobsPageInner />
    </Suspense>
  );
}
