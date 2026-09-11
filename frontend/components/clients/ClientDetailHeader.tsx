"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Globe, Lock, MoreVertical, Tag, Search, MapPin, Calendar,
  Briefcase, ArrowLeftRight, Pencil, Archive, Upload, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import ClientStageBadge, { CLIENT_STATUS_OPTIONS } from "@/components/clients/ClientStageBadge";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  CLIENT_TAG_OPTIONS, TAG_COLORS, getTagDisplay, makeCustomTagId,
  type CustomTagDef,
} from "@/lib/clientTags";
import { cn, formatDate } from "@/lib/utils";
import api from "@/lib/api";
import type { ApiResponse, Client, ClientStage, Job, PaginatedData } from "@/types";

interface Props {
  client: Client;
  onUpdate: () => void;
  onStageChange: (stage: ClientStage) => void;
  onArchive: () => void;
}

export default function ClientDetailHeader({ client, onUpdate, onStageChange, onArchive }: Props) {
  const router = useRouter();
  const [tagsOpen, setTagsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(client.tags || []);
  const [customTags, setCustomTags] = useState<CustomTagDef[]>(client.custom_tags || []);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");
  const [newTagIcon, setNewTagIcon] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignJobOpen, setAssignJobOpen] = useState(false);
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [assigningJob, setAssigningJob] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: client.company_name,
    phone: client.phone || "",
    email: client.email || "",
  });
  const [selectedStatus, setSelectedStatus] = useState<ClientStage>(
    client.stage === "customer" ? "on_hold" : client.stage
  );
  const tagsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTags(client.tags || []);
    setCustomTags(client.custom_tags || []);
    setEditForm({ company_name: client.company_name, phone: client.phone || "", email: client.email || "" });
    setSelectedStatus(client.stage === "customer" ? "on_hold" : client.stage);
  }, [client]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (tagsRef.current && !tagsRef.current.contains(target)) setTagsOpen(false);
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const saveTags = async (tags: string[], customs: CustomTagDef[]) => {
    await api.put(`/clients/${client.id}/tags`, { tags, custom_tags: customs });
    onUpdate();
  };

  const toggleTag = async (tagId: string) => {
    const next = selectedTags.includes(tagId) ? selectedTags.filter((t) => t !== tagId) : [...selectedTags, tagId];
    setSelectedTags(next);
    try {
      await saveTags(next, customTags);
    } catch {
      toast.error("Failed to update tags");
      setSelectedTags(client.tags || []);
    }
  };

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50000) { toast.error("Icon must be under 50KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setNewTagIcon(reader.result as string);
    reader.readAsDataURL(file);
  };

  const createCustomTag = async () => {
    if (!newTagName.trim()) { toast.error("Tag name required"); return; }
    const tag: CustomTagDef = { id: makeCustomTagId(newTagName), label: newTagName.trim(), color: newTagColor, icon: newTagIcon };
    const nextCustom = [...customTags, tag];
    const nextSelected = [...selectedTags, tag.id];
    setCustomTags(nextCustom);
    setSelectedTags(nextSelected);
    try {
      await saveTags(nextSelected, nextCustom);
      toast.success("Custom tag created");
      setNewTagName("");
      setNewTagIcon(undefined);
      setManageTagsOpen(false);
    } catch {
      toast.error("Failed to create tag");
    }
  };

  const saveEdit = async () => {
    await api.put(`/clients/${client.id}`, editForm);
    toast.success("Client updated");
    setEditOpen(false);
    onUpdate();
  };

  const saveStatus = async () => {
    onStageChange(selectedStatus);
    setStatusOpen(false);
  };

  const openAssignExistingJob = () => {
    setMenuOpen(false);
    setSelectedJobId("");
    setAssignJobOpen(true);
    setLoadingJobs(true);
    api
      .get<ApiResponse<PaginatedData<Job>>>("/jobs", { params: { page_size: 100 } })
      .then((res) => {
        const items = (res.data.data.items || []).filter((j) => j.client_id !== client.id);
        setAvailableJobs(items);
      })
      .catch(() => {
        setAvailableJobs([]);
        toast.error("Failed to load jobs");
      })
      .finally(() => setLoadingJobs(false));
  };

  const assignExistingJob = async () => {
    if (!selectedJobId) {
      toast.error("Select a job");
      return;
    }
    setAssigningJob(true);
    try {
      await api.put(`/jobs/${selectedJobId}`, {
        client_id: client.id,
        engagement_id: null,
      });
      toast.success("Job assigned to this client");
      setAssignJobOpen(false);
      onUpdate();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to assign job";
      toast.error(message);
    } finally {
      setAssigningJob(false);
    }
  };

  const filteredTags = [
    ...CLIENT_TAG_OPTIONS.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase())),
    ...customTags.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase())).map((t) => ({ id: t.id, label: t.label, isCustom: true })),
  ];

  const isPublic = (client.visibility || "public") === "public";
  const websiteHref = client.website
    ? (client.website.startsWith("http") ? client.website : `https://${client.website}`)
    : null;

  return (
    <>
      <div className="px-6 pt-5 pb-5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-1.5 text-sm mb-4">
          <Link href="/clients" className="text-[#3b82f6] hover:underline transition-colors font-normal">
            Clients
          </Link>
          <span className="text-gray-400">/</span>
          <span className="font-semibold text-gray-900">{client.company_name}</span>
        </div>

        <div className="flex items-start gap-5">
          <ClientAvatar
            name={client.company_name}
            size="xl"
            className="!rounded-2xl !w-16 !h-16 !text-xl shadow-sm"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <ClientStageBadge stage={client.stage} />
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={async () => {
                      const next = isPublic ? "private" : "public";
                      try {
                        await api.put(`/clients/${client.id}`, { visibility: next });
                        toast.success(next === "public" ? "Client is now public" : "Client is now private");
                        onUpdate();
                      } catch {
                        toast.error("Failed to update visibility");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).click();
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 transition hover:border-[#1F574A]/40 hover:bg-[#1F574A]/5 hover:text-[#1F574A]"
                    title="Click to toggle public / private"
                  >
                    {isPublic ? (
                      <>
                        <Globe className="h-3 w-3" /> Public
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3" /> Private
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight truncate">{client.company_name}</h1>
                  <div className="relative shrink-0" ref={menuRef}>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#1F574A]"
                      aria-label="Client actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute left-0 top-full mt-1 z-40 w-52 bg-white border border-gray-200 rounded-lg shadow-xl py-1 animate-slide-down">
                        <button
                          type="button"
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                        >
                          <Pencil className="h-4 w-4 text-gray-500" /> Edit
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setMenuOpen(false);
                            router.push(`/jobs?create=1&client_id=${client.id}`);
                          }}
                        >
                          <Briefcase className="h-4 w-4 text-gray-500" /> Add Job
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={openAssignExistingJob}
                        >
                          <Briefcase className="h-4 w-4 text-gray-500" /> Assign Existing Job
                        </button>
                        {client.owner_id && (
                          <button
                            type="button"
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => {
                              setMenuOpen(false);
                              router.push(
                                `/jobs?create=1&client_id=${client.id}&recruiter_id=${client.owner_id}`
                              );
                            }}
                          >
                            <Briefcase className="h-4 w-4 text-gray-500" /> Assign Job to Owner
                          </button>
                        )}
                        <button
                          type="button"
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => { setStatusOpen(true); setMenuOpen(false); }}
                        >
                          <ArrowLeftRight className="h-4 w-4 text-gray-500" /> Change Status
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          type="button"
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => { setMenuOpen(false); onArchive(); }}
                        >
                          <Archive className="h-4 w-4" /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                  {client.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      {client.location}
                    </span>
                  )}
                  {websiteHref && (
                    <a
                      href={websiteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-primary hover:underline"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {client.website}
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    Client since {formatDate(client.created_at)}
                  </span>
                </div>
              </div>

              {client.owner_name && (
                <div className="flex items-center gap-3 shrink-0 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
                  <UserAvatar name={client.owner_name} size="md" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">Owner</p>
                    <p className="text-xs font-semibold text-gray-800 truncate">{client.owner_name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 relative" ref={tagsRef}>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedTags.map((id) => {
                  const def = getTagDisplay(id, customTags);
                  if (!def) return null;
                  const { Icon } = def;
                  return (
                    <span key={id} className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border", def.pill)}>
                      {def.customIcon ? (
                        <img src={def.customIcon} alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                      {def.label}
                    </span>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setTagsOpen(!tagsOpen)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> {selectedTags.length ? "Add Tag" : "Tags"}
                </button>
              </div>

              {tagsOpen && (
                <div className="absolute left-0 top-full mt-2 z-30 w-72 bg-white border border-gray-200 rounded-lg shadow-xl animate-slide-down overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        placeholder="Search"
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {filteredTags.map((tag) => {
                      const active = selectedTags.includes(tag.id);
                      const def = getTagDisplay(tag.id, customTags);
                      const Icon = def?.Icon || Tag;
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50", active && "bg-primary-50")}
                        >
                          {def?.customIcon ? (
                            <img src={def.customIcon} alt="" className="w-4 h-4 rounded-sm object-cover shrink-0" />
                          ) : (
                            <span className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", def?.dot || "bg-gray-300")}>
                              <Icon className="h-3 w-3 text-white" />
                            </span>
                          )}
                          <span className="text-gray-700">{tag.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setManageTagsOpen(true); setTagsOpen(false); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Manage tags
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatedModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} title="Create Custom Tag" size="md">
        <div className="space-y-4">
          <Input label="Tag Name *" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="My custom tag" />
          <Select
            label="Color"
            options={TAG_COLORS.map((c) => ({ value: c.id, label: c.id.charAt(0).toUpperCase() + c.id.slice(1) }))}
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom Icon (optional)</label>
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-600">
              <Upload className="h-4 w-4" /> Upload icon
              <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
            </label>
            {newTagIcon && <img src={newTagIcon} alt="" className="mt-2 w-8 h-8 rounded object-cover" />}
          </div>
          <Button onClick={createCustomTag}>Create Tag</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Client" size="md">
        <div className="space-y-3">
          <Input label="Company Name" value={editForm.company_name} onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })} />
          <Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          <Input label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Button onClick={saveEdit}>Save Changes</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change Status" size="sm">
        <div className="space-y-3">
          {CLIENT_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors",
                selectedStatus === opt.value ? "border-primary bg-primary-50" : "border-gray-200 hover:bg-gray-50"
              )}
            >
              <input
                type="radio"
                name="client-detail-status"
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
          <div className="flex gap-2 pt-1">
            <Button onClick={saveStatus}>Save Status</Button>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
          </div>
        </div>
      </AnimatedModal>

      <AnimatedModal
        open={assignJobOpen}
        onClose={() => setAssignJobOpen(false)}
        title="Assign Existing Job"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Pick a job from another client to move it under <span className="font-semibold text-gray-800">{client.company_name}</span>.
          </p>
          <Select
            label="Job"
            placeholder={loadingJobs ? "Loading jobs…" : availableJobs.length ? "Select a job" : "No other jobs available"}
            disabled={loadingJobs || !availableJobs.length}
            options={availableJobs.map((j) => ({
              value: String(j.id),
              label: `${j.title}${j.client_name ? ` · ${j.client_name}` : ""}`,
            }))}
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={assignExistingJob} loading={assigningJob} disabled={!selectedJobId}>
              Assign Job
            </Button>
            <Button variant="outline" onClick={() => setAssignJobOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </AnimatedModal>
    </>
  );
}
