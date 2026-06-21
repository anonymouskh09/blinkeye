"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import toast from "react-hot-toast";
import FoldersListTable from "@/components/candidates/FoldersListTable";
import CreateFolderModal from "@/components/candidates/CreateFolderModal";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/Modal";
import api from "@/lib/api";
import type { ApiResponse, CandidateFolder, PaginatedData } from "@/types";

export default function FoldersTab() {
  const [data, setData] = useState<PaginatedData<CandidateFolder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<CandidateFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<CandidateFolder | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<CandidateFolder>>>("/folders", {
        params: { page, page_size: 20, search: search || undefined },
      });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const handleCreate = async ({ name, description }: { name: string; description: string }) => {
    setSaving(true);
    try {
      if (editFolder) {
        await api.put(`/folders/${editFolder.id}`, { name, description });
        toast.success("Folder updated");
      } else {
        await api.post("/folders", { name, description });
        toast.success("Folder created");
      }
      setCreateOpen(false);
      setEditFolder(null);
      fetchFolders();
    } catch {
      toast.error(editFolder ? "Failed to update folder" : "Failed to create folder");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFavorite = async (folder: CandidateFolder) => {
    try {
      await api.put(`/folders/${folder.id}`, { is_favorite: !folder.is_favorite });
      fetchFolders();
    } catch {
      toast.error("Failed to update folder");
    }
  };

  const handleDelete = async () => {
    if (!deleteFolder) return;
    setSaving(true);
    try {
      await api.delete(`/folders/${deleteFolder.id}`);
      toast.success("Folder deleted");
      setDeleteFolder(null);
      fetchFolders();
    } catch {
      toast.error("Failed to delete folder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-700">All Folders</p>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm w-48 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={() => { setEditFolder(null); setCreateOpen(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" /> Create folder
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <TableSkeleton rows={4} cols={5} />
        ) : !data?.items?.length ? (
          <EmptyState
            title="No folders yet"
            description="Create a folder to organize your candidates."
            actionLabel="Create folder"
            onAction={() => setCreateOpen(true)}
          />
        ) : (
          <>
            <FoldersListTable
              folders={data.items}
              onToggleFavorite={handleToggleFavorite}
              onEdit={(f) => { setEditFolder(f); setCreateOpen(true); }}
              onDelete={setDeleteFolder}
            />
            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span>Results per page</span>
                <select className="border border-gray-200 rounded px-2 py-1 text-sm" defaultValue="20">
                  <option value="20">20</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span>{(page - 1) * 20 + 1} - {Math.min(page * 20, data.total)} of {data.total}</span>
                <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
              </div>
            </div>
          </>
        )}
      </div>

      <CreateFolderModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditFolder(null); }}
        onSubmit={handleCreate}
        folder={editFolder}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteFolder}
        onClose={() => setDeleteFolder(null)}
        onConfirm={handleDelete}
        title="Delete folder"
        message={`Delete "${deleteFolder?.name}"? Candidates will not be deleted, only removed from this folder.`}
        confirmLabel="Delete"
        loading={saving}
      />
    </>
  );
}
