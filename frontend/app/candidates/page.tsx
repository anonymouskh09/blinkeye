"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronDown, Users, FolderOpen, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import CandidatesListTable, { candidateRef } from "@/components/candidates/CandidatesListTable";
import CreateCandidateModal from "@/components/candidates/CreateCandidateModal";
import FoldersTab from "@/components/candidates/FoldersTab";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListBulkBar from "@/components/ui/ListBulkBar";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn, exportToCsv } from "@/lib/utils";
import { downloadCsvTemplate, parseCsv, pickCsvFile } from "@/lib/csv";
import HeaderActions from "@/components/layout/HeaderActions";
import type { ApiResponse, Candidate, PaginatedData } from "@/types";

type SubTab = "candidates" | "folders" | "ai";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "candidates", label: "Candidates", icon: Users },
  { id: "folders", label: "Folders", icon: FolderOpen },
  { id: "ai", label: "AI Advanced Search", icon: Sparkles },
];

export default function CandidatesPage() {
  return (
    <Suspense fallback={<PageWrapper><TableSkeleton rows={6} cols={8} /></PageWrapper>}>
      <CandidatesPageContent />
    </Suspense>
  );
}

function CandidatesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>("candidates");
  const [data, setData] = useState<PaginatedData<Candidate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [startWithForm, setStartWithForm] = useState(false);
  const [defaultJobId, setDefaultJobId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [importing, setImporting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (search) params.search = search;
      if (locationFilter) params.location = locationFilter;
      const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", { params });
      setData(res.data.data);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [page, search, locationFilter]);

  useEffect(() => {
    const t = searchParams.get("tab") as SubTab | null;
    if (t && SUB_TABS.some((x) => x.id === t)) setSubTab(t);
    if (searchParams.get("create") === "form") {
      setStartWithForm(true);
      const jobId = searchParams.get("job_id");
      setDefaultJobId(jobId ? Number(jobId) : null);
      setCreateOpen(true);
      router.replace("/candidates", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        /* noop */
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const items = data?.items || [];
  const totalCount = data?.total ?? 0;

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (items.length && items.every((c) => selectedIds.includes(c.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((c) => c.id));
    }
  };

  const exportRows = selectedIds.length
    ? items.filter((c) => selectedIds.includes(c.id))
    : items;

  const handleExport = () => {
    if (!exportRows.length) {
      toast.error("Nothing to export");
      return;
    }
    exportToCsv(
      "candidates.csv",
      ["reference", "name", "email", "phone", "location", "current_job_title", "current_company", "notice_period", "expected_salary"],
      exportRows.map((c) => [
        candidateRef(c.id),
        c.name || "",
        c.email || "",
        c.phone || "",
        c.location || "",
        c.current_job_title || "",
        c.current_company || "",
        c.notice_period || "",
        c.expected_salary != null ? String(c.expected_salary) : "",
      ])
    );
    toast.success(`Exported ${exportRows.length} candidate(s)`);
  };

  const handleBulkArchive = async () => {
    if (!selectedIds.length) return;
    if (
      !confirm(
        `Archive ${selectedIds.length} selected candidate${selectedIds.length === 1 ? "" : "s"}?`
      )
    ) {
      return;
    }
    setArchiving(true);
    try {
      await Promise.all(selectedIds.map((id) => api.delete(`/candidates/${id}`)));
      toast.success(
        selectedIds.length === 1
          ? "Candidate archived"
          : `${selectedIds.length} candidates archived`
      );
      setSelectedIds([]);
      fetchCandidates();
    } catch {
      toast.error("Failed to archive some candidates");
      fetchCandidates();
    } finally {
      setArchiving(false);
    }
  };

  const handleTemplate = () => {
    downloadCsvTemplate(
      "candidates_import_template.csv",
      ["name", "email", "phone", "location", "current_job_title", "current_company", "notice_period", "expected_salary"],
      ["Jane Doe", "jane@example.com", "+1234567890", "Lahore", "Developer", "Acme", "2 weeks", "120000"]
    );
  };

  const handleImport = async () => {
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
        const name = row.name || row.full_name || "";
        if (!name.trim()) {
          fail++;
          continue;
        }
        try {
          const fd = new FormData();
          fd.append("name", name.trim());
          fd.append("email", (row.email || "").trim());
          if (row.phone) fd.append("phone", row.phone);
          if (row.location) fd.append("location", row.location);
          if (row.current_job_title) fd.append("current_job_title", row.current_job_title);
          if (row.current_company) fd.append("current_company", row.current_company);
          if (row.notice_period) fd.append("notice_period", row.notice_period);
          if (row.expected_salary) fd.append("expected_salary", row.expected_salary);
          await api.post("/candidates", fd);
          ok++;
        } catch {
          fail++;
        }
      }
      toast.success(`Imported ${ok} candidate(s)${fail ? `, ${fail} failed` : ""}`);
      fetchCandidates();
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
            <h1 className="panel-title text-lg sm:text-xl font-bold text-[#1F574A]">Candidates</h1>
            <ChevronDown className="h-4 w-4 text-gray-400" />
            {totalCount > 0 && <span className="count-badge ml-1">{totalCount}</span>}
          </div>
          <HeaderActions addLabel="Candidate" onAddClick={() => setCreateOpen(true)} />
        </div>

        <div className="sub-tabs">
          {SUB_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setSubTab(id);
                router.replace(id === "candidates" ? "/candidates" : `/candidates?tab=${id}`, { scroll: false });
              }}
              className={cn("sub-tab", subTab === id ? "sub-tab-active" : "sub-tab-inactive")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {subTab === "candidates" && (
          <>
            <ListBulkBar
              selectedCount={selectedIds.length}
              totalVisible={items.length}
              onClearSelection={() => setSelectedIds([])}
              onImportCsv={handleImport}
              onExportCsv={handleExport}
              onDownloadTemplate={handleTemplate}
              onArchiveSelected={handleBulkArchive}
              importing={importing}
              archiving={archiving}
            />

            <div className="px-6 py-5">
              {loading ? (
                <TableSkeleton rows={6} cols={10} />
              ) : !items.length ? (
                <EmptyState
                  title="No candidates found"
                  description="Create a candidate to start building your talent pool."
                  actionLabel="Create Candidate"
                  onAction={() => setCreateOpen(true)}
                />
              ) : (
                <>
                  <CandidatesListTable
                    candidates={items}
                    selectedIds={selectedIds}
                    onToggle={toggle}
                    onToggleAll={toggleAll}
                  />
                  <Pagination page={page} totalPages={data?.total_pages || 1} onPageChange={setPage} />
                </>
              )}
            </div>
          </>
        )}

        {subTab === "folders" && <FoldersTab />}

        {subTab === "ai" && (
          <div className="py-20 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-50 to-secondary-50 border border-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1.5">AI Advanced Search</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Search candidates using natural language and AI-powered matching.
            </p>
          </div>
        )}
      </div>

      <CreateCandidateModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setStartWithForm(false);
          setDefaultJobId(null);
        }}
        onCreated={fetchCandidates}
        startWithForm={startWithForm}
        defaultJobId={defaultJobId}
      />

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, title, email..."
          />
          <Input
            label="Location"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="e.g. Lahore, Pakistan"
          />
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                setFilterOpen(false);
                setPage(1);
                fetchCandidates();
              }}
            >
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setLocationFilter("");
                setPage(1);
                setFilterOpen(false);
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
