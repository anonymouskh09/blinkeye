"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Plus, ChevronDown, Filter, RefreshCw, MoreVertical,
  Users, FolderOpen, Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import CandidatesListTable from "@/components/candidates/CandidatesListTable";
import CreateCandidateModal from "@/components/candidates/CreateCandidateModal";
import FoldersTab from "@/components/candidates/FoldersTab";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (search) params.search = search;
      if (locationFilter) params.location = locationFilter;
      const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", { params });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [page, search, locationFilter]);

  useEffect(() => {
    const t = searchParams.get("tab") as SubTab | null;
    if (t && SUB_TABS.some((x) => x.id === t)) setSubTab(t);
  }, [searchParams]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const totalCount = data?.total ?? 0;

  return (
    <PageWrapper flush>
      <div className="content-panel content-panel-flush">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <h1 className="panel-title">Candidates</h1>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
          {totalCount > 0 && <span className="count-badge">{totalCount}</span>}
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
            <div className="toolbar">
              <button onClick={() => setCreateOpen(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Create Candidate
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFilterOpen(true)} className="btn-outline-primary">
                  <Filter className="h-4 w-4" /> Filters
                </button>
                <button type="button" onClick={fetchCandidates} className="btn-icon">
                  <RefreshCw className="h-4 w-4" />
                </button>
                <div className="relative" ref={menuRef}>
                  <button onClick={() => setMenuOpen(!menuOpen)} className="btn-icon">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen && (
                    <div className="dropdown-menu">
                      <button onClick={() => { setFilterOpen(true); setMenuOpen(false); }} className="dropdown-item">
                        Export list
                      </button>
                      <button onClick={() => { fetchCandidates(); setMenuOpen(false); }} className="dropdown-item">
                        Refresh all
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              {loading ? (
                <TableSkeleton rows={6} cols={10} />
              ) : !data?.items?.length ? (
                <EmptyState
                  title="No candidates found"
                  description="Create a candidate to start building your talent pool."
                  actionLabel="Create Candidate"
                  onAction={() => setCreateOpen(true)}
                />
              ) : (
                <>
                  <CandidatesListTable candidates={data.items} />
                  <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
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
            <p className="text-sm text-gray-500 max-w-md mx-auto">Search candidates using natural language and AI-powered matching.</p>
          </div>
        )}
      </div>

      <CreateCandidateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={fetchCandidates} />

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, title, email..." />
          <Input label="Location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="e.g. Lahore, Pakistan" />
          <div className="flex gap-2 pt-2">
            <Button onClick={() => { setFilterOpen(false); setPage(1); fetchCandidates(); }}>Apply</Button>
            <Button variant="outline" onClick={() => { setSearch(""); setLocationFilter(""); setPage(1); setFilterOpen(false); }}>Clear</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
