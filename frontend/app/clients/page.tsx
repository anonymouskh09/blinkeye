"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, RefreshCw, Filter, MoreVertical, Globe, Eye, ChevronDown,
  ArrowUpDown, LayoutGrid, List, Phone, Trash2,
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
import ClientStageBadge from "@/components/clients/ClientStageBadge";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { formatDateTimeBullet, cn } from "@/lib/utils";
import type { ApiResponse, Client, ClientStage, PaginatedData } from "@/types";

type ViewMode = "list" | "board";

const STAGES: ClientStage[] = ["prospect", "lead", "active", "customer", "inactive"];

const emptyForm = {
  company_name: "",
  contact_person: "",
  email: "",
  phone: "",
  industry: "",
  location: "",
  website: "",
  stage: "prospect" as ClientStage,
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
  const [saving, setSaving] = useState(false);
  const [menuClientId, setMenuClientId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "board") {
        const res = await api.get<ApiResponse<{ stages: Record<string, Client[]> }>>("/clients/board");
        setBoard(res.data.data.stages);
      } else {
        const params: Record<string, string | number> = { page, page_size: 20 };
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
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuClientId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleCreate = async () => {
    if (!form.company_name.trim()) { toast.error("Client name is required"); return; }
    if (!form.phone.trim()) { toast.error("Phone number is required"); return; }
    setSaving(true);
    try {
      const res = await api.post("/clients", form);
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

  const handleDeactivate = async (id: number) => {
    if (!confirm("Deactivate this client?")) return;
    try {
      await api.delete(`/clients/${id}`);
      toast.success("Client deactivated");
      setMenuClientId(null);
      fetchClients();
    } catch {
      toast.error("Failed to deactivate client");
    }
  };

  const handleStageChange = async (clientId: number, stage: ClientStage) => {
    try {
      await api.put(`/clients/${clientId}`, { stage });
      toast.success("Stage updated");
      fetchClients();
    } catch {
      toast.error("Failed to update stage");
    }
  };

  return (
    <PageWrapper>
      <div className="content-panel">
        <div className="panel-header">
          <div className="flex items-center gap-2.5">
            <h1 className="panel-title">Clients</h1>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
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
            <button onClick={() => setFilterOpen(true)} className="btn-outline-primary">
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
        </div>

        <div className="toolbar">
          <button onClick={() => setCreateOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Create Client
          </button>
        </div>

        {loading ? (
          <div className="px-6 pb-6"><TableSkeleton rows={6} cols={9} /></div>
        ) : view === "board" ? (
          <div className="px-6 pb-6 flex gap-4 overflow-x-auto">
            {STAGES.map((stage) => (
              <div key={stage} className="flex-shrink-0 w-72 bg-gray-50/80 rounded-2xl p-3 border border-gray-200/60">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{stage}</h3>
                  <span className="text-xs bg-white text-gray-600 px-2.5 py-0.5 rounded-lg font-semibold shadow-sm border border-gray-100">
                    {(board[stage] || []).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {(board[stage] || []).map((c) => (
                    <div key={c.id} className="bg-white border border-gray-200/80 rounded-xl p-3.5 hover:shadow-card-hover hover:border-primary/20 transition-all">
                      <Link href={`/clients/${c.id}`} className="block">
                        <div className="flex items-center gap-2 mb-2">
                          <ClientAvatar name={c.company_name} size="sm" />
                          <span className="font-medium text-sm text-primary">{c.company_name}</span>
                        </div>
                        {c.phone && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">{c.job_count} job(s)</p>
                      </Link>
                      <select
                        value={c.stage}
                        onChange={(e) => handleStageChange(c.id, e.target.value as ClientStage)}
                        className="mt-2 w-full text-xs border border-gray-200 rounded px-2 py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {STAGES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Job Count</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Industry</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Team</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Created</th>
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
                          <div className="flex items-center gap-1.5 ml-1">
                            {c.website && (
                              <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                                target="_blank" rel="noreferrer" className="text-gray-400 hover:text-primary">
                                <Globe className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <Link href={`/clients/${c.id}`} className="text-gray-400 hover:text-primary">
                              <Eye className="h-3.5 w-3.5" />
                            </Link>
                            <div className="relative" ref={menuClientId === c.id ? menuRef : undefined}>
                              <button
                                onClick={() => setMenuClientId(menuClientId === c.id ? null : c.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                              {menuClientId === c.id && (
                                <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[140px]">
                                  <Link href={`/clients/${c.id}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                                    View Details
                                  </Link>
                                  <button
                                    onClick={() => handleDeactivate(c.id)}
                                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> Deactivate
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.phone || "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.job_count}</td>
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
                      <td className="px-4 py-3">
                        {c.team_member_name ? (
                          <div className="flex items-center gap-2">
                            <UserAvatar name={c.team_member_name} />
                            <span className="text-sm text-gray-700">{c.team_member_name}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDateTimeBullet(c.created_at)}
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

      <Modal open={createOpen} onClose={() => { setCreateOpen(false); setForm(emptyForm); }} title="Create Client">
        <div className="space-y-4">
          <Input label="Client Name *" value={form.company_name}
            onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <Input label="Contact Person" value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
          <Input label="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Phone *" value={form.phone} placeholder="+92 300 1234567"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Industry" value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          <Input label="Location" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <Input label="Website" value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <Select label="Stage" options={STAGES.map((s) => ({ value: s, label: s.toUpperCase() }))}
            value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as ClientStage })} />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleCreate} loading={saving}>Create Client</Button>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={filterOpen} onClose={() => setFilterOpen(false)} title="Filters" size="sm">
        <div className="space-y-4">
          <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email..." />
          <Select label="Stage" placeholder="All Stages"
            options={STAGES.map((s) => ({ value: s, label: s.toUpperCase() }))}
            value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={() => { setFilterOpen(false); setPage(1); fetchClients(); }}>Apply Filters</Button>
            <Button variant="outline" onClick={() => { setSearch(""); setStageFilter(""); setPage(1); setFilterOpen(false); }}>Clear</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
