"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, RefreshCw, Filter, MoreVertical,
  ArrowUpDown, LayoutGrid, List, Pencil, Briefcase, ArrowLeftRight, Archive,
  ChevronDown, ChevronsUpDown,
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
import { useRequireRole, useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatDateTimeBullet, cn } from "@/lib/utils";
import type { ApiResponse, Client, ClientStage, PaginatedData, User } from "@/types";

import HeaderActions from "@/components/layout/HeaderActions";

type ViewMode = "list" | "board";

const emptyForm = {
  company_name: "",
  location: "",
  industry: "",
  website: "",
  stage: "prospect" as ClientStage,
  selected_team_ids: [] as number[],
  contact_person: "",
  contact_title: "",
  email: "",
  phone: "",
  notes: "",
};

export default function ClientsPage() {
  useRequireRole("admin");
  const { user } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("list");
  const [data, setData] = useState<PaginatedData<Client> | null>(null);
  const [board, setBoard] = useState<Record<string, Client[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toolbarMenuRef = useRef<HTMLDivElement>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    checkbox: 38,
    company_name: 140,
    job_count: 75,
    industry: 110,
    location: 110,
    stage: 100,
    owner: 120,
    team: 120,
    created_at: 130,
    actions: 40,
  });
  const [resizingCol, setResizingCol] = useState<string | null>(null);

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 150;
    setResizingCol(colKey);

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - startX;
      // Allow shrinking to minimum ~65px (shows ~4 characters/words + truncation)
      const minW = colKey === "checkbox" || colKey === "actions" ? 36 : 65;
      const newWidth = Math.max(minW, startWidth + deltaX);
      setColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const onMouseUp = () => {
      setResizingCol(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
    };

    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
  };


  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (toolbarMenuRef.current && !toolbarMenuRef.current.contains(target)) {
        setToolbarMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
    setSaving(true);
    try {
      const res = await api.post("/clients", {
        company_name: form.company_name.trim(),
        location: form.location.trim() || undefined,
        industry: form.industry.trim() || undefined,
        website: form.website.trim() || undefined,
        stage: form.stage,
        owner_id: user?.id,
        team_user_ids: form.selected_team_ids,
        contact_person: form.contact_person.trim() || undefined,
        contact_title: form.contact_title.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      toast.success("Client created");
      setCreateOpen(false);
      setForm(emptyForm);
      setShowAdvanced(false);
      router.push(`/clients/${res.data.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create client");
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
          <h1 className="panel-title text-lg sm:text-xl font-bold text-[#1F574A]">Clients</h1>
          <HeaderActions addLabel="Client" onAddClick={() => setCreateOpen(true)} />
        </div>

        {loading ? (
          <div className="p-6"><TableSkeleton rows={6} cols={8} /></div>
        ) : view === "board" ? (
          <div className="p-6">
            <ClientsBoard stages={board} onUpdate={fetchClients} />
          </div>
        ) : !data?.items?.length ? (
          <EmptyState title="No clients found" actionLabel="Create Client" onAction={() => setCreateOpen(true)} />
        ) : (
          <div className="p-4 sm:p-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className="min-w-full border-collapse"
                  style={{
                    tableLayout: "fixed",
                    width: Object.values(colWidths).reduce((a, b) => a + b, 0),
                    minWidth: "100%",
                  }}
                >
                  <colgroup>
                    <col style={{ width: colWidths.checkbox }} />
                    <col style={{ width: colWidths.company_name }} />
                    <col style={{ width: colWidths.job_count }} />
                    <col style={{ width: colWidths.industry }} />
                    <col style={{ width: colWidths.location }} />
                    <col style={{ width: colWidths.stage }} />
                    <col style={{ width: colWidths.owner }} />
                    <col style={{ width: colWidths.team }} />
                    <col style={{ width: colWidths.created_at }} />
                    <col style={{ width: colWidths.actions }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#F1F4F8] border-b border-slate-200/80 text-[12px] font-semibold text-slate-500 uppercase tracking-wider select-none">
                      <th className="relative pl-4 pr-2 py-3.5 text-left">
                        <input type="checkbox" className="rounded border-slate-300 text-primary focus:ring-primary" />
                        <div
                          onMouseDown={(e) => handleResizeStart("checkbox", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "checkbox" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "checkbox" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="inline-flex items-center gap-1 justify-between w-full truncate">
                          Company Name <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </span>
                        <div
                          onMouseDown={(e) => handleResizeStart("company_name", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "company_name" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "company_name" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        Open Jobs
                        <div
                          onMouseDown={(e) => handleResizeStart("job_count", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "job_count" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "job_count" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="inline-flex items-center gap-1 justify-between w-full truncate">
                          Industry <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </span>
                        <div
                          onMouseDown={(e) => handleResizeStart("industry", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "industry" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "industry" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="inline-flex items-center gap-1 justify-between w-full truncate">
                          Location <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </span>
                        <div
                          onMouseDown={(e) => handleResizeStart("location", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "location" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "location" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        Status
                        <div
                          onMouseDown={(e) => handleResizeStart("stage", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "stage" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "stage" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        Owner
                        <div
                          onMouseDown={(e) => handleResizeStart("owner", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "owner" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "owner" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        Team
                        <div
                          onMouseDown={(e) => handleResizeStart("team", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "team" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "team" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="relative px-3 py-3.5 text-left whitespace-nowrap overflow-hidden text-ellipsis">
                        <span className="inline-flex items-center gap-1 justify-between w-full truncate">
                          Created Date <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        </span>
                        <div
                          onMouseDown={(e) => handleResizeStart("created_at", e)}
                          className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-30 group select-none flex flex-col items-center justify-start"
                          title="Drag to resize column"
                        >
                          <div className={cn(
                            "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-blue-600 transition-opacity -mt-[1px]",
                            resizingCol === "created_at" ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )} />
                          <div className={cn(
                            "w-[2px] h-full transition-colors",
                            resizingCol === "created_at" ? "bg-blue-600" : "bg-transparent group-hover:bg-blue-500/80"
                          )} />
                        </div>
                      </th>
                      <th className="w-10 px-2 py-3.5 text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.items.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors text-[12px]">
                        <td className="pl-4 pr-2 py-3">
                          <input type="checkbox" className="rounded border-gray-300" />
                        </td>
                        <td className="px-3 py-3 overflow-hidden text-ellipsis whitespace-nowrap">
                          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
                            <ClientAvatar name={c.company_name} size="sm" />
                            <Link href={`/clients/${c.id}`} className="font-semibold text-slate-800 hover:text-primary truncate text-[12px]">
                              {c.company_name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700 whitespace-nowrap">{c.job_count}</td>
                        <td className="px-3 py-3 text-slate-600 truncate whitespace-nowrap">{c.industry || "—"}</td>
                        <td className="px-3 py-3 text-slate-600 truncate whitespace-nowrap">{c.location || "—"}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <ClientStageBadge stage={c.stage} />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                          {c.owner_name ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                              <UserAvatar name={c.owner_name} size="sm" />
                              <span className="text-slate-700 font-medium whitespace-nowrap truncate">{c.owner_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 whitespace-nowrap">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap overflow-hidden text-ellipsis">
                          {c.team && c.team.length > 0 ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                              <UserAvatar name={c.team[0].name || c.team[0].user_name} size="sm" />
                              <span className="text-slate-700 font-medium whitespace-nowrap truncate">
                                {c.team.map((t) => t.name || t.user_name).join(", ")}
                              </span>
                            </div>
                          ) : c.team_member_name ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                              <UserAvatar name={c.team_member_name} size="sm" />
                              <span className="text-slate-700 font-medium whitespace-nowrap truncate">{c.team_member_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 whitespace-nowrap">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap truncate">
                          {formatDateTimeBullet(c.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={(e) => openMenu(c, e)}
                              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
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
            </div>
            <div className="px-6 py-2 border-t border-gray-100 bg-white">
              <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
            </div>
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

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setForm(emptyForm);
          setShowAdvanced(false);
        }}
        title="Create Client"
        size="lg"
      >
        <div className="space-y-4">
          {/* 1. Client Name (Required) */}
          <Input
            label="Client Name *"
            value={form.company_name}
            placeholder="Enter client company name"
            onChange={(e) => setForm({ ...form, company_name: e.target.value })}
          />

          {/* 2. Location & Industry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Location"
              value={form.location}
              placeholder="e.g. London, UK"
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Input
              label="Industry"
              value={form.industry}
              placeholder="e.g. Technology, Healthcare"
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
            />
          </div>

          {/* 3. Website & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Website"
              value={form.website}
              placeholder="https://example.com"
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
            <Select
              label="Status"
              options={[
                { value: "prospect", label: "Prospect" },
                { value: "active", label: "Active" },
                { value: "on_hold", label: "On Hold" },
                { value: "closed", label: "Closed" },
              ]}
              value={form.stage}
              onChange={(e) => setForm({ ...form, stage: e.target.value as ClientStage })}
            />
          </div>

          {/* 4. Client Owner & Client Team */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client Owner</label>
              <input
                type="text"
                value={user?.name || "System Admin"}
                disabled
                className="w-full h-9 text-xs px-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 font-medium cursor-not-allowed select-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Client Team <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              {loadingTeam ? (
                <div className="text-xs text-slate-400 py-2">Loading team members...</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 border border-slate-200 rounded-lg p-2 bg-white min-h-[38px] max-h-[96px] overflow-y-auto">
                  {teamUsers
                    .filter((u) => u.id !== user?.id)
                    .map((u) => {
                      const isSelected = form.selected_team_ids.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            const updated = isSelected
                              ? form.selected_team_ids.filter((id) => id !== u.id)
                              : [...form.selected_team_ids, u.id];
                            setForm({ ...form, selected_team_ids: updated });
                          }}
                          className={cn(
                            "px-2 py-1 text-[11px] font-medium rounded-md transition-all flex items-center gap-1",
                            isSelected
                              ? "bg-[#1F574A] text-white shadow-sm"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          )}
                        >
                          <span>{u.name}</span>
                          {isSelected && <span className="text-[10px]">✓</span>}
                        </button>
                      );
                    })}
                  {teamUsers.filter((u) => u.id !== user?.id).length === 0 && (
                    <span className="text-xs text-slate-400">No additional team members</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 5. Advanced Options Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#1F574A] hover:text-[#18463c] transition-colors py-1 select-none"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", showAdvanced && "rotate-180")} />
              <span>Advanced Options</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 animate-slide-down">
                <div className="border-b border-slate-200/80 pb-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Primary Contact</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Contact Name"
                    value={form.contact_person}
                    placeholder="Full contact name"
                    onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                  />
                  <Input
                    label="Job Title"
                    value={form.contact_title}
                    placeholder="e.g. HR Manager, Director"
                    onChange={(e) => setForm({ ...form, contact_title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    placeholder="contact@example.com"
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                  <Input
                    label="Phone Number"
                    value={form.phone}
                    placeholder="+1 234 567 890"
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Add any notes or context about this client..."
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); setShowAdvanced(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Create Client
            </Button>
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
