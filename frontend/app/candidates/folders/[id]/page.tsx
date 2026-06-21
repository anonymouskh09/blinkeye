"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, Users, UserCircle } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import CandidatesListTable from "@/components/candidates/CandidatesListTable";
import AddCandidateToFolderModal from "@/components/candidates/AddCandidateToFolderModal";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/Modal";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, Candidate, CandidateFolder, PaginatedData } from "@/types";

type Tab = "candidates" | "team";

export default function FolderDetailPage() {
  const { id } = useParams();
  const folderId = Number(id);

  const [folder, setFolder] = useState<CandidateFolder | null>(null);
  const [data, setData] = useState<PaginatedData<Candidate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("candidates");
  const [addOpen, setAddOpen] = useState(false);
  const [removeCandidate, setRemoveCandidate] = useState<Candidate | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c] = await Promise.all([
        api.get<ApiResponse<CandidateFolder>>(`/folders/${folderId}`),
        api.get<ApiResponse<PaginatedData<Candidate>>>(`/folders/${folderId}/candidates`, {
          params: { page, page_size: 20 },
        }),
      ]);
      setFolder(f.data.data);
      setData(c.data.data);
    } catch {
      toast.error("Failed to load folder");
    } finally {
      setLoading(false);
    }
  }, [folderId, page]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleRemove = async () => {
    if (!removeCandidate) return;
    try {
      await api.delete(`/folders/${folderId}/candidates/${removeCandidate.id}`);
      toast.success("Candidate removed from folder");
      setRemoveCandidate(null);
      fetchAll();
    } catch {
      toast.error("Failed to remove candidate");
    }
  };

  if (loading && !folder) {
    return <PageWrapper><TableSkeleton rows={6} cols={8} /></PageWrapper>;
  }

  if (!folder) {
    return <PageWrapper><p className="p-6 text-gray-500">Folder not found</p></PageWrapper>;
  }

  const existingIds = data?.items.map((c) => c.id) || [];

  return (
    <PageWrapper>
      <div className="bg-white rounded-lg border border-gray-200 min-h-[calc(100vh-120px)]">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/candidates" className="hover:text-primary">Candidates</Link>
            <span>/</span>
            <Link href="/candidates?tab=folders" className="hover:text-primary">Folders</Link>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">{folder.name}</h1>
          {folder.description && <p className="text-sm text-gray-500 mt-1">{folder.description}</p>}
        </div>

        <div className="flex items-center gap-0 border-b border-gray-200 px-4">
          {([
            { id: "candidates" as Tab, label: "Candidates", icon: Users, count: folder.candidate_count },
            { id: "team" as Tab, label: "Team", icon: UserCircle },
          ]).map(({ id: tabId, label, icon: Icon, count }) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-all",
                tab === tabId ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-4 w-4" />{label}
              {count != null && count > 0 && (
                <span className="ml-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{count}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "candidates" && (
          <>
            <div className="flex items-center justify-end px-6 py-4 border-b border-gray-100">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" /> Add Candidate
              </button>
            </div>

            <div className="px-6 py-4">
              {loading ? (
                <TableSkeleton rows={5} cols={8} />
              ) : !data?.items?.length ? (
                <EmptyState
                  title="No candidates in this folder"
                  description="Add existing candidates or create new ones."
                  actionLabel="Add Candidate"
                  onAction={() => setAddOpen(true)}
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

        {tab === "team" && (
          <div className="p-12 text-center text-sm text-gray-500">Team sharing coming soon.</div>
        )}
      </div>

      <AddCandidateToFolderModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        folderId={folderId}
        existingCandidateIds={existingIds}
        onAdded={fetchAll}
      />

      <ConfirmDialog
        open={!!removeCandidate}
        onClose={() => setRemoveCandidate(null)}
        onConfirm={handleRemove}
        title="Remove from folder"
        message={`Remove "${removeCandidate?.name}" from this folder?`}
        confirmLabel="Remove"
      />
    </PageWrapper>
  );
}
