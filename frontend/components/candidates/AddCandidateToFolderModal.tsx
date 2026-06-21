"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import AnimatedModal from "@/components/ui/AnimatedModal";
import ClientAvatar from "@/components/clients/ClientAvatar";
import CreateCandidateModal from "@/components/candidates/CreateCandidateModal";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, Candidate, PaginatedData } from "@/types";

type Tab = "search" | "create";

interface Props {
  open: boolean;
  onClose: () => void;
  folderId: number;
  existingCandidateIds: number[];
  onAdded: () => void;
}

export default function AddCandidateToFolderModal({
  open, onClose, folderId, existingCandidateIds, onAdded,
}: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", {
        params: { page: 1, page_size: 20, search: search || undefined },
      });
      setCandidates(res.data.data.items);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open || tab !== "search") return;
    const t = setTimeout(fetchCandidates, 300);
    return () => clearTimeout(t);
  }, [open, tab, fetchCandidates]);

  useEffect(() => {
    if (!open) {
      setTab("search");
      setSearch("");
    }
  }, [open]);

  const handleAdd = async (candidateId: number) => {
    if (existingCandidateIds.includes(candidateId)) {
      toast.error("Candidate already in folder");
      return;
    }
    setAddingId(candidateId);
    try {
      await api.post(`/folders/${folderId}/candidates`, { candidate_ids: [candidateId] });
      toast.success("Candidate added to folder");
      onAdded();
      onClose();
    } catch {
      toast.error("Failed to add candidate");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <>
      <AnimatedModal open={open} onClose={onClose} title="Add Candidate" size="lg">
        <div className="flex border-b border-gray-200 mb-4 -mt-1">
          {(["search", "create"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize",
                tab === t ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {t === "search" ? "Search Candidate" : "Create Candidate"}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <div className="space-y-4">
            <div className="relative border-b border-gray-200 pb-1">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search candidate"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-2 text-sm outline-none bg-transparent"
              />
            </div>

            <p className="text-xs text-gray-400">Recently created candidates</p>

            <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-100">
              {loading ? (
                <p className="text-sm text-gray-400 py-8 text-center">Loading...</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">No candidates found</p>
              ) : (
                candidates.map((c) => {
                  const inFolder = existingCandidateIds.includes(c.id);
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-3">
                      <ClientAvatar name={c.name} size="lg" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.current_company || c.current_job_title || c.email}</p>
                      </div>
                      <button
                        type="button"
                        disabled={inFolder || addingId === c.id}
                        onClick={() => handleAdd(c.id)}
                        className={cn(
                          "p-1.5 rounded-full transition-colors",
                          inFolder ? "text-gray-300 cursor-not-allowed" : "text-primary hover:bg-primary-50"
                        )}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "create" && (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 mb-4">
              Create a new candidate and automatically add them to this folder.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Open create form
            </button>
          </div>
        )}
      </AnimatedModal>

      <CreateCandidateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultFolderId={folderId}
        onCreated={() => {
          setCreateOpen(false);
          onAdded();
          onClose();
        }}
      />
    </>
  );
}
