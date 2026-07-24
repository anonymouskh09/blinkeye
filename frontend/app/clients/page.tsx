"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, RefreshCw, Filter, MoreVertical,
  ArrowUpDown, LayoutGrid, List, Pencil, Briefcase, ArrowLeftRight, Archive,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import ClientStageBadge, { CLIENT_STATUS_OPTIONS } from "@/components/clients/ClientStageBadge";
import ClientsBoard from "@/components/clients/ClientsBoard";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatDateTimeBullet, cn } from "@/lib/utils";
import type { ApiResponse, Client, ClientStage, PaginatedData, User } from "@/types";

type ViewMode = "list" | "board";

const emptyForm = {
  company_name: "",
  team_user_id: "",
};

export default function ClientsPage() {
  useRequireRole("admin");
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [data, setData] = useState<PaginatedData<Client> | null>(null);
  const [board, setBoard] = useState<Record<string, Client[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuClient, setMenuClient] = useState<Client | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [statusClient, setStatusClient] = useState<Client | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ClientStage>("prospect");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setMenuClient(null);
    setMenuPos(null);
  };

  const openMenu = (client: Client, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuClient?.id === client.id) {
      closeMenu();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 192;
    const menuHeight = 200;
    let top = rect.bottom + 6;
    let left = rect.right - menuWidth;
    if (top + menuHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menuHeight - 6);
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
    setMenuPos({ top, left });
    setMenuClient(client);
  };

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "board") {
        const res = await api.get<ApiResponse<{ stages: Record<string, Client[]> }>>("/clients/board");
        setBoard(res.data.data.stages);
      } else {
        const params: Record<string, string | number> = { page, page_size: 20, status: "active" };
        if (search) params.search = search;
        if (stageFilter) params.stage = stageFilter;
        const res = await api.get<ApiResponse<PaginatedData<Client>>>("/clients", { params });
        setData(res.data.data);
      }
    } catch {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [page, search, stageFilter, view]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (!createOpen) return;
    setLoadingTeam(true);
    api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, status: "active" } })
      .then((res) => setTeamUsers(res.data.data.items))
      .catch(() => toast.error("Failed to load team members"))
      .finally(() => setLoadingTeam(false));
  }, [createOpen]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[aria-label="Actions"]')) return;
      if (menuRef.current && !menuRef.current.contains(target)) closeMenu();
    };
    const onScroll = () => closeMenu();
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const openChangeStatus = (client: Client) => {
    closeMenu();
    const stage = client.stage === "customer" ? "on_hold" : client.stage;
    setSelectedStatus(CLIENT_STATUS_OPTIONS.some((o) => o.value === stage) ? stage : "prospect");
    setStatusClient(client);
  };

  const handleCreate = async () => {
    if (!form.company_name.trim()) { toast.error("Client name is required"); return; }
    if (!form.team_user_id) { toast.error("Select a team member"); return; }
    setSaving(true);
    try {
      const res = await api.post("/clients", {
        company_name: form.company_name.trim(),
        team_user_ids: [Number(form.team_user_id)],
      });
      toast.success("Client created");
      setCreateOpen(false);
      setForm(emptyForm);
      router.push(`/clients/${res.data.data.id}`);
    } catch {
      toast.error("Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusSave = async () => {
    if (!statusClient) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/clients/${statusClient.id}`, { stage: selectedStatus });
      toast.success("Status updated");
      setStatusClient(null);
      fetchClients();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleArchive = async (id: number) => {
    if (!confirm("Archive this client? You can find it later under Settings → Archive.")) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Client archived");
      closeMenu();
      fetchClients();
    } catch {
      toast.error("Failed to archive client");
    }
  };

  return (
    <PageWrapper flush>
      <div className="content-panel content-panel-flush">
        <div className="panel-header">
          <h1 className="panel-title">Clients</h1>
          <div className="flex items-center gap-2">
            <div className="view-toggle">
              <button
                onClick={() => setView("board")}
                className={cn("view-toggle-btn", view === "board" ? "view-toggle-active" : "view-toggle-inactive")}
              >
                <LayoutGrid className="h-3.5 w-3.5 inline mr-1" />BOARD
              </button>
              <button
                onClick={() => setView("list")}
                className={cn("view-toggle-btn", view === "list" ? "view-toggle-active" : "view-toggle-inactive")}
              >
                <List className="h-3.5 w-3.5 inline mr-1" />LIST
              </button>
            </div>
            <button onClick={fetchClients} className="btn-icon">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="toolbar">
          <div className="flex items-center gap-2">
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Create Client
            </button>
            <button onClick={() => setFilterOpen(true)} className="btn-outline-primary">
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="px-6 pb-6"><TableSkeleton rows={6} cols={8} /></div>
        ) : view === "board" ? (
          <ClientsBoard stages={board} onUpdate={fetchClients} />
        ) : !data?.items?.length ? (
          <EmptyState title="No clients found" actionLabel="Create Client" onAction={() => setCreateOpen(true)} />
        ) : (
          <div className="px-6 pb-6">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-10 px-4 py-3"><input type="checkbox" className="rounded" /></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="inline-flex items-center gap-1">Client Name <ArrowUpDown className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Job Count</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
                    <th className="w-12 px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="px-4 py-3"><input type="checkbox" className="rounded" /></td>
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
                      <td className="px-4 py-3 text-sm text-gray-700">{c.job_count}</td>
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
                        {formatDateTimeBullet(c.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => openMenu(c, e)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </div>
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

      {menuClient && menuPos && (
        <div
          ref={menuRef}
          className="fixed z-[100] w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 animate-slide-down"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <button
            type="button"
            className="dropdown-item flex items-center gap-2.5"
            onClick={() => {
              closeMenu();
              router.push(`/clients/${menuClient.id}`);
            }}
          >
            <Pencil className="h-4 w-4 text-gray-400" /> Edit
          </button>
          <button
            type="button"
            className="dropdown-item flex items-center gap-2.5"
            onClick={() => {
              closeMenu();
              router.push(`/jobs/new?client_id=${menuClient.id}`);
            }}
          >
            <Briefcase className="h-4 w-4 text-gray-400" /> Add Job
          </button>
          <button
            type="button"
            className="dropdown-item flex items-center gap-2.5"
            onClick={() => openChangeStatus(menuClient)}
          >
            <ArrowLeftRight className="h-4 w-4 text-gray-400" /> Change Status
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            className="dropdown-item flex items-center gap-2.5 text-red-600 hover:bg-red-50"
            onClick={() => handleArchive(menuClient.id)}
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
        </div>
      )}

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(emptyForm); }} title="Create Client">
        <div className="space-y-5">
          <Input
            label="Client Name *"
            value={form.company_name}
            placeholder="Enter client company name"
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />

          <Select
            label="Team *"
            placeholder={loadingTeam ? "Loading team members..." : "Select team member"}
            disabled={loadingTeam || !teamUsers.length}
            options={teamUsers.map((u) => ({
              value: String(u.id),
              label: `${u.name} (${u.role})`,
            }))}
            value={form.team_user_id}
            onChange={(e) => setForm({ ...form, team_user_id: e.target.value })}
          />

          <div className="flex gap-3 pt-1">
            <Button onClick={handleCreate} loading={saving}>Create</Button>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!statusClient} onClose={() => setStatusClient(null)} title="Change Status" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Set status for <span className="font-medium text-gray-800">{statusClient?.company_name}</span>
          </p>
          <div className="space-y-2">
            {CLIENT_STATUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors",
                  selectedStatus === opt.value
                    ? "border-primary bg-primary-50"
                    : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <input
                  type="radio"
                  name="client-status"
                  checked={selectedStatus === opt.value}
                  onChange={() => setSelectedStatus(opt.value)}
                  className="text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                {opt.value === "prospect" && (
                  <span className="ml-auto text-[10px] uppercase font-semibold text-gray-400">Default</span>
                )}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleStatusSave} loading={updatingStatus}>Save Status</Button>
            <Button variant="outline" onClick={() => setStatusClient(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, industry, location..." />
          <Select
            label="Stage"
            placeholder="All Stages"
            options={CLIENT_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label.toUpperCase() }))}
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => { setFilterOpen(false); setPage(1); fetchClients(); }}>Apply Filters</Button>
            <Button variant="outline" onClick={() => { setSearch(""); setStageFilter(""); setPage(1); setFilterOpen(false); }}>Clear</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
