"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import ClientStageBadge from "@/components/clients/ClientStageBadge";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatDateTimeBullet } from "@/lib/utils";
import type { ApiResponse, Client, PaginatedData } from "@/types";

export default function ArchivePage() {
  useRequireRole("admin");
  const [data, setData] = useState<PaginatedData<Client> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<Client>>>("/clients", {
        params: { page, page_size: 20, status: "inactive" },
      });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load archived clients");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleRestore = async (id: number) => {
    setRestoringId(id);
    try {
      await api.put(`/clients/${id}`, { status: "active" });
      toast.success("Client restored");
      fetchArchived();
    } catch {
      toast.error("Failed to restore client");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <PageWrapper>
      <Header
        title="Archive"
        subtitle="Archived clients — restore them anytime"
        actions={
          <button onClick={fetchArchived} className="btn-icon" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="content-panel">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={6} /></div>
        ) : !data?.items?.length ? (
          <EmptyState title="No archived clients" />
        ) : (
          <div className="p-6">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ClientAvatar name={c.company_name} size="sm" />
                          <Link href={`/clients/${c.id}`} className="font-medium text-primary hover:underline text-sm">
                            {c.company_name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{c.industry || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{c.location || "—"}</td>
                      <td className="px-4 py-3"><ClientStageBadge stage={c.stage} /></td>
                      <td className="px-4 py-3">
                        {c.owner_name ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={c.owner_name} />
                            <span className="text-sm text-gray-700">{c.owner_name}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDateTimeBullet(c.updated_at || c.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          loading={restoringId === c.id}
                          onClick={() => handleRestore(c.id)}
                        >
                          <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
