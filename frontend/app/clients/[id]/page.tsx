"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Briefcase, FileText, Activity, StickyNote, Paperclip, Users, UserPlus,
  Contact, History, Plus, Download, Trash2, Upload,
} from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import ClientDetailHeader from "@/components/clients/ClientDetailHeader";
import ClientSummaryTab from "@/components/clients/ClientSummaryTab";
import ClientJobsTab from "@/components/clients/ClientJobsTab";
import ClientNotesTab from "@/components/clients/ClientNotesTab";
import ClientActivitiesTab from "@/components/clients/ClientActivitiesTab";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import type { ApiResponse, Client, ActivityLog, Note, User, ClientStage, PaginatedData } from "@/types";

type Tab = "jobs" | "summary" | "activities" | "notes" | "attachments" | "team" | "guests" | "contacts" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType; countKey?: string }[] = [
  { id: "jobs", label: "Jobs", icon: Briefcase, countKey: "jobs" },
  { id: "summary", label: "Summary", icon: FileText },
  { id: "activities", label: "Activities", icon: Activity, countKey: "activities" },
  { id: "notes", label: "Notes", icon: StickyNote, countKey: "notes" },
  { id: "attachments", label: "Attachments", icon: Paperclip, countKey: "attachments" },
  { id: "team", label: "Team", icon: Users, countKey: "team" },
  { id: "contacts", label: "Contacts", icon: Contact, countKey: "contacts" },
  { id: "guests", label: "Guests", icon: UserPlus, countKey: "guests" },
  { id: "history", label: "History", icon: History },
];

export default function ClientDetailPage() {
  useRequireRole("admin");
  const { id } = useParams();
  const router = useRouter();
  const clientId = String(id);

  const [client, setClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [addGuestOpen, setAddGuestOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "" });
  const [guestForm, setGuestForm] = useState({ name: "", email: "" });
  const [uploading, setUploading] = useState(false);

  const fetchNotes = useCallback(async () => {
    const n = await api.get<ApiResponse<{ items: Note[] }>>("/notes", { params: { entity_type: "client", entity_id: id } });
    setNotes(n.data.data.items);
  }, [id]);

  const fetchClient = useCallback(async () => {
    const r = await api.get<ApiResponse<Client>>(`/clients/${id}`);
    setClient(r.data.data);
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchClient(), fetchNotes()]);
  }, [fetchClient, fetchNotes]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchClient().catch(() => { toast.error("Failed to load client"); setClient(null); }),
      api.get<ApiResponse<{ items: ActivityLog[] }>>("/activity", { params: { entity_type: "client", entity_id: id } }).catch(() => ({ data: { data: { items: [] } } })),
      fetchNotes().catch(() => setNotes([])),
      api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, status: "active" } }).catch(() => ({ data: { data: { items: [] } } })),
    ]).then(([, h, , u]) => {
      setHistory(h.data.data.items);
      setUsers(u.data.data.items);
    }).finally(() => setLoading(false));
  }, [id, fetchClient, fetchNotes]);

  const changeStage = async (stage: ClientStage) => {
    await api.put(`/clients/${id}`, { stage });
    toast.success("Stage updated");
    fetchClient();
  };

  const handleArchive = async () => {
    if (!confirm("Archive this client?")) return;
    await api.delete(`/clients/${id}`);
    toast.success("Client archived");
    router.push("/clients");
  };

  const addContact = async () => {
    if (!contactForm.name.trim()) return;
    await api.post(`/clients/${id}/contacts`, contactForm);
    toast.success("Contact added");
    setAddContactOpen(false);
    setContactForm({ name: "", email: "", phone: "" });
    refreshAll();
  };

  const addGuest = async () => {
    if (!guestForm.name.trim()) return;
    await api.post(`/clients/${id}/guests`, guestForm);
    toast.success("Guest added");
    setAddGuestOpen(false);
    setGuestForm({ name: "", email: "" });
    refreshAll();
  };

  const addTeamMember = async () => {
    if (!selectedUserId) return;
    await api.post(`/clients/${id}/team`, null, { params: { user_id: selectedUserId } });
    toast.success("Team member added");
    setAddTeamOpen(false);
    setSelectedUserId("");
    fetchClient();
  };

  const removeContact = async (contactId: number) => {
    if (!confirm("Remove contact?")) return;
    await api.delete(`/clients/${id}/contacts/${contactId}`);
    toast.success("Removed");
    fetchClient();
  };

  const removeGuest = async (guestId: number) => {
    if (!confirm("Remove guest?")) return;
    await api.delete(`/clients/${id}/guests/${guestId}`);
    toast.success("Removed");
    fetchClient();
  };

  const removeTeamMember = async (teamId: number) => {
    if (!confirm("Remove team member?")) return;
    await api.delete(`/clients/${id}/team/${teamId}`);
    toast.success("Removed");
    fetchClient();
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/clients/${id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Uploaded");
      fetchClient();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const downloadAttachment = async (attachmentId: number, filename: string) => {
    const res = await api.get(`/clients/${id}/attachments/${attachmentId}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const deleteAttachment = async (attachmentId: number) => {
    if (!confirm("Delete attachment?")) return;
    await api.delete(`/clients/${id}/attachments/${attachmentId}`);
    toast.success("Deleted");
    fetchClient();
  };

  const getCount = (key?: string) => {
    if (!key || !client) return 0;
    if (key === "notes") return notes.length;
    return (client as unknown as Record<string, unknown[]>)[key]?.length ?? 0;
  };

  const availableUsers = users.filter((u) => !client?.team?.some((m) => m.user_id === u.id));

  if (loading) return <PageWrapper><CardSkeleton /></PageWrapper>;
  if (!client) return <PageWrapper><p className="p-8 text-gray-500">Client not found</p></PageWrapper>;

  return (
    <PageWrapper>
      <div className="bg-white rounded-lg border border-gray-200 min-h-[calc(100vh-120px)] shadow-sm overflow-hidden">
        <ClientDetailHeader
          client={client}
          onUpdate={fetchClient}
          onStageChange={changeStage}
          onArchive={handleArchive}
        />

        <div className="flex items-center gap-0 border-b border-gray-200 px-2 overflow-x-auto bg-white">
          {TABS.map(({ id: tabId, label, icon: Icon, countKey }) => {
            const count = getCount(countKey);
            const active = tab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => setTab(tabId)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap",
                  active ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {countKey && count > 0 && (
                  <span className="ml-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-6 bg-gray-50/30 min-h-[400px]">
          {tab === "summary" && (
            <ClientSummaryTab
              client={client}
              clientId={clientId}
              onUpdate={fetchClient}
              onAddTeam={() => setAddTeamOpen(true)}
              onAddGuest={() => setAddGuestOpen(true)}
              onAddContact={() => setAddContactOpen(true)}
            />
          )}

          {tab === "notes" && (
            <ClientNotesTab client={client} clientId={clientId} notes={notes} onRefresh={refreshAll} />
          )}

          {tab === "activities" && (
            <ClientActivitiesTab
              client={client}
              clientId={clientId}
              activities={client.activities || []}
              users={users}
              onRefresh={fetchClient}
            />
          )}

          {tab === "jobs" && (
            <ClientJobsTab client={client} jobs={client.jobs || []} onRefresh={fetchClient} />
          )}

          {tab === "team" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <Button size="sm" onClick={() => setAddTeamOpen(true)} className="mb-4"><Plus className="h-4 w-4 mr-1" /> Add Team Member</Button>
              {client.team?.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
                  <UserAvatar name={m.name} size="md" />
                  <div className="flex-1"><p className="font-medium text-sm">{m.name}</p><p className="text-xs text-gray-500">{m.email}</p></div>
                  <Badge className="bg-green-100 text-green-700 uppercase text-[10px]">{m.status}</Badge>
                  <button type="button" onClick={() => removeTeamMember(m.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}

          {tab === "guests" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <Button size="sm" onClick={() => setAddGuestOpen(true)} className="mb-4"><Plus className="h-4 w-4 mr-1" /> Add Guest</Button>
              {client.guests?.map((g) => (
                <div key={g.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <span className="text-sm">{g.name}{g.email ? ` (${g.email})` : ""}</span>
                  <button type="button" onClick={() => removeGuest(g.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}

          {tab === "contacts" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <Button size="sm" onClick={() => setAddContactOpen(true)} className="mb-4"><Plus className="h-4 w-4 mr-1" /> Add Contact</Button>
              {client.contacts?.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-800 text-white flex items-center justify-center font-semibold">{c.name[0]}</div>
                    <div><p className="font-medium text-sm">{c.name}</p><p className="text-xs text-gray-500">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p></div>
                  </div>
                  <button type="button" onClick={() => removeContact(c.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}

          {tab === "attachments" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-2xl">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-md hover:bg-primary-700 cursor-pointer mb-4 transition-colors">
                <Upload className="h-4 w-4" />{uploading ? "Uploading..." : "Upload File"}
                <input type="file" className="hidden" onChange={uploadFile} disabled={uploading} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls,.txt" />
              </label>
              {client.attachments?.map((att) => (
                <div key={att.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div><p className="text-sm font-medium">{att.filename}</p><p className="text-xs text-gray-400">{att.uploaded_by_name} · {formatDate(att.created_at)}</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => downloadAttachment(att.id, att.filename)} className="text-primary"><Download className="h-4 w-4" /></button>
                    <button type="button" onClick={() => deleteAttachment(att.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "history" && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-w-3xl">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                {history.length} action{history.length !== 1 ? "s" : ""} taken
              </div>
              {history.length ? history.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <UserAvatar name={a.created_by_name || "U"} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{a.description}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </div>
              )) : (
                <p className="px-5 py-12 text-sm text-gray-400 text-center">No history yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatedModal open={addContactOpen} onClose={() => setAddContactOpen(false)} title="Add Contact">
        <div className="space-y-3">
          <Input label="Name *" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
          <Input label="Email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
          <Input label="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
          <Button onClick={addContact}>Add Contact</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={addGuestOpen} onClose={() => setAddGuestOpen(false)} title="Add Guest">
        <div className="space-y-3">
          <Input label="Name *" value={guestForm.name} onChange={(e) => setGuestForm({ ...guestForm, name: e.target.value })} />
          <Input label="Email" value={guestForm.email} onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })} />
          <Button onClick={addGuest}>Add Guest</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={addTeamOpen} onClose={() => setAddTeamOpen(false)} title="Add Team Member">
        <div className="space-y-3">
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">Choose team member</option>
            {availableUsers.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
          </select>
          <Button onClick={addTeamMember} disabled={!availableUsers.length}>Add to Team</Button>
        </div>
      </AnimatedModal>
    </PageWrapper>
  );
}
