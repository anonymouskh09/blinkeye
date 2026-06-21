"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe, Lock, MoreVertical, Tag, Search,
  Briefcase, ArrowLeftRight, Pencil, UserCog, Settings, Archive,
  Upload, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import ClientStageBadge from "@/components/clients/ClientStageBadge";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  CLIENT_TAG_OPTIONS, TAG_COLORS, getTagDisplay, makeCustomTagId,
  type CustomTagDef,
} from "@/lib/clientTags";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { Client, ClientStage, User } from "@/types";

const STAGES: ClientStage[] = ["prospect", "lead", "active", "customer", "inactive"];

interface Props {
  client: Client;
  users: User[];
  onUpdate: () => void;
  onStageChange: (stage: ClientStage) => void;
  onArchive: () => void;
}

export default function ClientDetailHeader({ client, users, onUpdate, onStageChange, onArchive }: Props) {
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
  const [moveStageOpen, setMoveStageOpen] = useState(false);
  const [ownershipOpen, setOwnershipOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [editForm, setEditForm] = useState({ company_name: client.company_name, phone: client.phone || "", email: client.email || "" });
  const [newStage, setNewStage] = useState<ClientStage>(client.stage);
  const [newOwner, setNewOwner] = useState(String(client.owner_id || ""));
  const [newVisibility, setNewVisibility] = useState(client.visibility || "public");
  const tagsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedTags(client.tags || []);
    setCustomTags(client.custom_tags || []);
    setEditForm({ company_name: client.company_name, phone: client.phone || "", email: client.email || "" });
    setNewStage(client.stage);
    setNewOwner(String(client.owner_id || ""));
    setNewVisibility(client.visibility || "public");
  }, [client]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(e.target as Node)) setTagsOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
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

  const saveStage = async () => {
    onStageChange(newStage);
    setMoveStageOpen(false);
  };

  const saveOwnership = async () => {
    await api.put(`/clients/${client.id}`, { owner_id: newOwner ? Number(newOwner) : null });
    toast.success("Ownership updated");
    setOwnershipOpen(false);
    onUpdate();
  };

  const saveVisibility = async () => {
    await api.put(`/clients/${client.id}`, { visibility: newVisibility });
    toast.success("Visibility updated");
    setVisibilityOpen(false);
    onUpdate();
  };

  const filteredTags = [
    ...CLIENT_TAG_OPTIONS.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase())),
    ...customTags.filter((t) => t.label.toLowerCase().includes(tagSearch.toLowerCase())).map((t) => ({ id: t.id, label: t.label, isCustom: true })),
  ];

  const isPublic = (client.visibility || "public") === "public";

  return (
    <>
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <ClientAvatar name={client.company_name} size="xl" className="!bg-amber-400 !text-amber-900 shadow-sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-gray-900 truncate">{client.company_name}</h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                  {isPublic ? <><Globe className="h-3 w-3" /> Public</> : <><Lock className="h-3 w-3" /> Private</>}
                </span>
                <ClientStageBadge stage={client.stage} />
                {client.owner_name && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                    <UserAvatar name={client.owner_name} />
                    <span className="text-xs text-gray-600">{client.owner_name}</span>
                  </span>
                )}
              </div>

              <div className="mt-3 relative" ref={tagsRef}>
                <div className="flex items-center gap-2 flex-wrap">
                  <button type="button" onClick={() => setTagsOpen(!tagsOpen)}
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Tags
                  </button>
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
                </div>

                {tagsOpen && (
                  <div className="absolute left-0 top-full mt-2 z-30 w-72 bg-white border border-gray-200 rounded-lg shadow-xl animate-slide-down overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Search"
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      {filteredTags.map((tag) => {
                        const active = selectedTags.includes(tag.id);
                        const def = getTagDisplay(tag.id, customTags);
                        const Icon = def?.Icon || Tag;
                        return (
                          <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)}
                            className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50", active && "bg-primary-50")}>
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
                      <button type="button" onClick={() => { setManageTagsOpen(true); setTagsOpen(false); }}
                        className="text-xs text-primary hover:underline">Manage tags</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-md border border-gray-200 text-primary hover:bg-primary-50 transition-colors">
              <MoreVertical className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-40 w-52 bg-white border border-gray-200 rounded-lg shadow-xl py-1 animate-slide-down">
                {[
                  { label: "Add Job", icon: Briefcase, action: () => { router.push(`/jobs/new?client_id=${client.id}`); setMenuOpen(false); } },
                  { label: "Move Stage", icon: ArrowLeftRight, action: () => { setMoveStageOpen(true); setMenuOpen(false); } },
                  { label: "Edit", icon: Pencil, action: () => { setEditOpen(true); setMenuOpen(false); } },
                  { label: "Edit Ownership", icon: UserCog, action: () => { setOwnershipOpen(true); setMenuOpen(false); } },
                  { label: "Edit Visibility", icon: Settings, action: () => { setVisibilityOpen(true); setMenuOpen(false); } },
                  { label: "Archive", icon: Archive, action: () => { setMenuOpen(false); onArchive(); } },
                ].map(({ label, icon: Icon, action }) => (
                  <button key={label} type="button" onClick={action}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <Icon className="h-4 w-4 text-gray-500" /> {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatedModal open={manageTagsOpen} onClose={() => setManageTagsOpen(false)} title="Create Custom Tag" size="md">
        <div className="space-y-4">
          <Input label="Tag Name *" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="My custom tag" />
          <Select label="Color" options={TAG_COLORS.map((c) => ({ value: c.id, label: c.id.charAt(0).toUpperCase() + c.id.slice(1) }))}
            value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} />
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

      <AnimatedModal open={moveStageOpen} onClose={() => setMoveStageOpen(false)} title="Move Stage" size="sm">
        <Select label="New Stage" options={STAGES.map((s) => ({ value: s, label: s.toUpperCase() }))}
          value={newStage} onChange={(e) => setNewStage(e.target.value as ClientStage)} />
        <Button className="mt-4" onClick={saveStage}>Update Stage</Button>
      </AnimatedModal>

      <AnimatedModal open={ownershipOpen} onClose={() => setOwnershipOpen(false)} title="Edit Ownership" size="sm">
        <Select label="Client Owner" placeholder="Select owner"
          options={users.map((u) => ({ value: String(u.id), label: u.name }))}
          value={newOwner} onChange={(e) => setNewOwner(e.target.value)} />
        <Button className="mt-4" onClick={saveOwnership}>Save</Button>
      </AnimatedModal>

      <AnimatedModal open={visibilityOpen} onClose={() => setVisibilityOpen(false)} title="Edit Visibility" size="sm">
        <Select label="Visibility" options={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]} value={newVisibility} onChange={(e) => setNewVisibility(e.target.value)} />
        <Button className="mt-4" onClick={saveVisibility}>Save</Button>
      </AnimatedModal>
    </>
  );
}
