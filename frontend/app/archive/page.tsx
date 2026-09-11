"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveRestore, RefreshCw, Trash2 } from "lucide-react";
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
import { cn, formatDateTimeBullet } from "@/lib/utils";
import type { ApiResponse, Candidate, Client, Job, PaginatedData, User } from "@/types";

type ArchiveTab = "clients" | "jobs" | "candidates" | "team";

const TABS: { id: ArchiveTab; label: string }[] = [
  { id: "clients", label: "Clients" },
  { id: "jobs", label: "Jobs" },
  { id: "candidates", label: "Candidates" },
  { id: "team", label: "Team" },
];

export default function ArchivePage() {
  useRequireRole("admin");
  const [tab, setTab] = useState<ArchiveTab>("clients");
  const [clients, setClients] = useState<PaginatedData<Client> | null>(null);
  const [jobs, setJobs] = useState<PaginatedData<Job> | null>(null);
  const [candidates, setCandidates] = useState<PaginatedData<Candidate> | null>(null);
  const [team, setTeam] = useState<PaginatedData<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "clients") {
        const res = await api.get<ApiResponse<PaginatedData<Client>>>("/clients", {
          params: { page, page_size: 20, status: "inactive" },
        });
        setClients(res.data.data);
      } else if (tab === "jobs") {
        const res = await api.get<ApiResponse<PaginatedData<Job>>>("/jobs", {
          params: { page, page_size: 20, status: "archived" },
        });
        setJobs(res.data.data);
      } else if (tab === "candidates") {
        const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", {
          params: { page, page_size: 20, archived: true },
        });
        setCandidates(res.data.data);
      } else {
        const res = await api.get<ApiResponse<PaginatedData<User>>>("/users", {
          params: { page, page_size: 20, status: "inactive" },
        });
        setTeam(res.data.data);
      }
    } catch {
      toast.error("Failed to load archive");
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => {
    fetchArchived();
  }, [fetchArchived]);

  useEffect(() => {
    setPage(1);
  }, [tab]);

  const runAction = async (key: string, action: () => Promise<void>, okMsg: string) => {
    setBusyId(key);
    try {
      await action();
      toast.success(okMsg);
      fetchArchived();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Action failed";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const currentTotalPages =
    tab === "clients"
      ? clients?.total_pages || 1
      : tab === "jobs"
        ? jobs?.total_pages || 1
        : tab === "candidates"
          ? candidates?.total_pages || 1
          : team?.total_pages || 1;

  const empty =
    tab === "clients"
      ? !clients?.items?.length
      : tab === "jobs"
        ? !jobs?.items?.length
        : tab === "candidates"
          ? !candidates?.items?.length
          : !team?.items?.length;

  return (
    <PageWrapper>
      <Header
        title="Archive"
        subtitle="Restore or permanently delete archived records"
        actions={
          <button onClick={fetchArchived} className="btn-icon" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="content-panel">
        <div className="flex flex-wrap gap-1 border-b border-gray-200 px-4 pt-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id
                  ? "border-[#1F574A] text-[#1F574A]"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : empty ? (
          <EmptyState title={`No archived ${tab}`} />
        ) : (
          <div className="p-6">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {tab === "clients" && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Industry</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                      </>
                    )}
                    {tab === "jobs" && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Job</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                      </>
                    )}
                    {tab === "candidates" && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Candidate</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                      </>
                    )}
                    {tab === "team" && (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Member</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Archived</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tab === "clients" &&
                    clients?.items.map((c) => (
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
                        <td className="px-4 py-3">
                          <ClientStageBadge stage={c.stage} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTimeBullet(c.updated_at || c.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === `restore-c-${c.id}`}
                              onClick={() =>
                                runAction(
                                  `restore-c-${c.id}`,
                                  () => api.post(`/clients/${c.id}/unarchive`),
                                  "Client restored"
                                )
                              }
                            >
                              <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                              Unarchive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="!text-red-600 !border-red-200 hover:!bg-red-50"
                              loading={busyId === `del-c-${c.id}`}
                              onClick={() => {
                                if (!confirm(`Permanently delete ${c.company_name}? This cannot be undone.`)) return;
                                runAction(
                                  `del-c-${c.id}`,
                                  () => api.delete(`/clients/${c.id}/permanent`),
                                  "Client deleted"
                                );
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {tab === "jobs" &&
                    jobs?.items.map((j) => (
                      <tr key={j.id} className="hover:bg-primary-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/jobs/${j.id}`} className="font-medium text-primary hover:underline text-sm">
                            {j.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{j.client_name || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{j.location || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTimeBullet(j.updated_at || j.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === `restore-j-${j.id}`}
                              onClick={() =>
                                runAction(
                                  `restore-j-${j.id}`,
                                  () => api.post(`/jobs/${j.id}/unarchive`),
                                  "Job restored"
                                )
                              }
                            >
                              <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                              Unarchive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="!text-red-600 !border-red-200 hover:!bg-red-50"
                              loading={busyId === `del-j-${j.id}`}
                              onClick={() => {
                                if (!confirm(`Permanently delete ${j.title}? This cannot be undone.`)) return;
                                runAction(
                                  `del-j-${j.id}`,
                                  () => api.delete(`/jobs/${j.id}/permanent`),
                                  "Job deleted"
                                );
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {tab === "candidates" &&
                    candidates?.items.map((c) => (
                      <tr key={c.id} className="hover:bg-primary-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={c.name} />
                            <Link href={`/candidates/${c.id}`} className="font-medium text-primary hover:underline text-sm">
                              {c.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.email || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.current_job_title || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTimeBullet(c.updated_at || c.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === `restore-cand-${c.id}`}
                              onClick={() =>
                                runAction(
                                  `restore-cand-${c.id}`,
                                  () => api.post(`/candidates/${c.id}/unarchive`),
                                  "Candidate restored"
                                )
                              }
                            >
                              <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                              Unarchive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="!text-red-600 !border-red-200 hover:!bg-red-50"
                              loading={busyId === `del-cand-${c.id}`}
                              onClick={() => {
                                if (!confirm(`Permanently delete ${c.name}? This cannot be undone.`)) return;
                                runAction(
                                  `del-cand-${c.id}`,
                                  () => api.delete(`/candidates/${c.id}/permanent`),
                                  "Candidate deleted"
                                );
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {tab === "team" &&
                    team?.items.map((u) => (
                      <tr key={u.id} className="hover:bg-primary-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={u.name} />
                            <span className="font-medium text-sm text-gray-800">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 capitalize">{u.role}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDateTimeBullet(u.updated_at || u.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busyId === `restore-u-${u.id}`}
                              onClick={() =>
                                runAction(
                                  `restore-u-${u.id}`,
                                  () => api.post(`/users/${u.id}/unarchive`),
                                  "Team member restored"
                                )
                              }
                            >
                              <ArchiveRestore className="h-3.5 w-3.5 mr-1.5" />
                              Unarchive
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="!text-red-600 !border-red-200 hover:!bg-red-50"
                              loading={busyId === `del-u-${u.id}`}
                              onClick={() => {
                                if (!confirm(`Permanently delete ${u.name}? This cannot be undone.`)) return;
                                runAction(
                                  `del-u-${u.id}`,
                                  () => api.delete(`/users/${u.id}/permanent`),
                                  "Team member deleted"
                                );
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={currentTotalPages} onPageChange={setPage} />
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
