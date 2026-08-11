"use client";

import { useState } from "react";
import { Pencil, Check, X, Eye, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import Badge from "@/components/ui/Badge";
import api from "@/lib/api";
import type { Client } from "@/types";

const SUMMARY_FIELDS: { key: keyof Client; label: string }[] = [
  { key: "company_name", label: "Client Name" },
  { key: "website", label: "Client Website" },
  { key: "industry", label: "Client Industry" },
  { key: "location", label: "Client Location" },
  { key: "address", label: "Client Address" },
];

function SummaryRow({
  label,
  value,
  onSave,
  readonly,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  readonly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-50 border-b border-gray-100 animate-fade-in">
        <dt className="w-44 shrink-0 text-xs text-gray-600">{label}</dt>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="flex-1 text-xs bg-transparent border-b-2 border-primary outline-none py-0.5 text-gray-800"
        />
        <button type="button" onClick={() => setEditing(false)} className="p-1 rounded bg-red-50 text-red-500 hover:bg-red-100"><X className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={save} disabled={saving} className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100"><Check className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-slate-50/50 transition-colors">
      <dt className="w-44 shrink-0 text-xs text-gray-600">{label}</dt>
      <dd className="flex-1 text-xs text-gray-800">
        {value ? (
          readonly ? value : (
            <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="text-left hover:text-primary">{value}</button>
          )
        ) : (
          <button type="button" onClick={() => { setDraft(""); setEditing(true); }} className="text-primary hover:underline text-xs">+ Add</button>
        )}
      </dd>
      {value && !readonly && (
        <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
          className="p-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SidebarSection({
  title,
  countLabel,
  onAdd,
  children,
}: {
  title: string;
  countLabel: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
        <button type="button" onClick={onAdd}
          className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-lg leading-none hover:bg-primary-700 transition-colors">+</button>
      </div>
      <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">{countLabel}</div>
      {children}
    </div>
  );
}

interface Props {
  client: Client;
  clientId: string;
  onUpdate: () => void;
  onAddTeam: () => void;
  onAddGuest: () => void;
  onAddContact: () => void;
}

export default function ClientSummaryTab({ client, clientId, onUpdate, onAddTeam, onAddGuest, onAddContact }: Props) {
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(client.description || "");

  const saveField = async (key: string, value: string) => {
    await api.put(`/clients/${clientId}`, { [key]: value });
    toast.success("Updated");
    onUpdate();
  };

  const saveDescription = async () => {
    await api.put(`/clients/${clientId}`, { description: descDraft });
    toast.success("Updated");
    setDescEditing(false);
    onUpdate();
  };

  const teamCount = client.team?.length ?? 0;
  const guestCount = client.guests?.length ?? 0;
  const contactCount = client.contacts?.length ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700">Details</h3>
          </div>
          <dl>
            {SUMMARY_FIELDS.map((f) => (
              <SummaryRow
                key={f.key}
                label={f.label}
                value={String(client[f.key] ?? "")}
                onSave={(v) => saveField(f.key, v)}
                readonly={f.key === "company_name" ? false : undefined}
              />
            ))}
          </dl>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-700">Description</h3>
          </div>
          {descEditing ? (
            <div className="px-4 py-3 animate-fade-in">
              <p className="text-xs text-gray-600 mb-2">Client Description</p>
              <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={4}
                className="w-full text-xs border border-gray-200 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setDescEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                <button type="button" onClick={saveDescription} className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary-700">Save</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3.5 border-b border-gray-100 hover:bg-slate-50/50">
              <dt className="w-44 shrink-0 text-xs text-gray-600">Client Description</dt>
              <dd className="flex-1 text-xs">
                {client.description ? (
                  <button type="button" onClick={() => { setDescDraft(client.description || ""); setDescEditing(true); }}
                    className="text-gray-800 text-left hover:text-primary">{client.description}</button>
                ) : (
                  <button type="button" onClick={() => setDescEditing(true)} className="text-primary hover:underline">+ Add</button>
                )}
              </dd>
            </div>
          )}
        </div>

        <p className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1 pl-1">
          Customize the summary fields <ExternalLink className="h-3.5 w-3.5" />
        </p>
      </div>

      <div className="space-y-4">
        <SidebarSection title="Team" countLabel={`${teamCount} team member${teamCount !== 1 ? "s" : ""}`} onAdd={onAddTeam}>
          {client.team?.length ? client.team.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar name={m.name} />
                <span className="text-xs text-gray-800 truncate">{m.name}</span>
                <Badge className="bg-green-100 text-green-700 text-[10px] uppercase shrink-0">{m.status}</Badge>
              </div>
              <Eye className="h-4 w-4 text-gray-400 shrink-0" />
            </div>
          )) : <p className="px-4 py-4 text-xs text-gray-400">No team members</p>}
        </SidebarSection>

        <SidebarSection title="Contacts" countLabel={`${contactCount} contact${contactCount !== 1 ? "s" : ""}`} onAdd={onAddContact}>
          {client.contacts?.length ? client.contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-800 text-white flex items-center justify-center text-xs font-semibold">{c.name[0]?.toUpperCase()}</div>
                <span className="text-xs text-gray-800">{c.name}</span>
              </div>
              <Eye className="h-4 w-4 text-gray-400" />
            </div>
          )) : <p className="px-4 py-4 text-xs text-gray-400">No contacts yet</p>}
        </SidebarSection>

        <SidebarSection title="Guests" countLabel={`${guestCount} guest${guestCount !== 1 ? "s" : ""}`} onAdd={onAddGuest}>
          {client.guests?.length ? client.guests.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-800 text-white flex items-center justify-center text-xs font-semibold">{g.name[0]?.toUpperCase()}</div>
                <span className="text-xs text-gray-800">{g.name}</span>
              </div>
              <Eye className="h-4 w-4 text-gray-400" />
            </div>
          )) : <p className="px-4 py-4 text-xs text-gray-400">No guests added yet</p>}
        </SidebarSection>
      </div>
    </div>
  );
}
