"use client";

import { useState } from "react";
import {
  Plus, Phone, Users, CheckSquare, Mail, Video, MapPin, Link2,
  Calendar, Trash2, Pencil, Clock3, CircleAlert, Paperclip, ChevronDown,
  UserCog, UserRoundPlus, Link, List, AlignLeft, Type,
} from "lucide-react";
import toast from "react-hot-toast";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ScheduledActivity, User as AppUser } from "@/types";

export type EntityActivityType = "client" | "candidate" | "job";

const ENTITY_API_BASE: Record<EntityActivityType, string> = {
  client: "clients",
  candidate: "candidates",
  job: "jobs",
};

const ACTIVITY_TYPES = [
  { id: "call", label: "CALL", icon: Phone },
  { id: "meeting", label: "MEETING", icon: Users },
  { id: "task", label: "TASK", icon: CheckSquare },
  { id: "email", label: "EMAIL", icon: Mail },
  { id: "interview", label: "INTERVIEW", icon: Video },
];

type ActivityForm = {
  title: string;
  activity_type: string;
  activity_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  location: string;
  description: string;
  assigned_to_id: string;
  share_with_guests: boolean;
  attendees: string;
  invite_as_bcc: boolean;
  online_meeting_type: string;
  online_meeting_url: string;
  importance: string;
  related_to_type: EntityActivityType;
  related_to_label: string;
  attachment_names: string[];
};

const emptyForm = (entityType: EntityActivityType, relatedLabel: string): ActivityForm => ({
  title: "",
  activity_type: "call",
  activity_date: new Date().toISOString().slice(0, 10),
  start_time: "09:00",
  end_time: "09:15",
  duration_minutes: 15,
  location: "",
  description: "",
  assigned_to_id: "",
  share_with_guests: false,
  attendees: "",
  invite_as_bcc: false,
  online_meeting_type: "manual_url",
  online_meeting_url: "",
  importance: "",
  related_to_type: entityType,
  related_to_label: relatedLabel,
  attachment_names: [],
});

function computeDuration(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((x) => Number.isNaN(x))) return 0;
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : 0;
}

function activityToForm(a: ScheduledActivity, entityType: EntityActivityType, relatedLabel: string): ActivityForm {
  return {
    title: a.title,
    activity_type: a.activity_type,
    activity_date: a.activity_date.slice(0, 10),
    start_time: a.start_time || "09:00",
    end_time: a.end_time || "09:15",
    duration_minutes: a.duration_minutes || 15,
    location: a.location || "",
    description: a.description || "",
    assigned_to_id: a.assigned_to_id ? String(a.assigned_to_id) : "",
    share_with_guests: a.share_with_guests,
    attendees: "",
    invite_as_bcc: false,
    online_meeting_type: "manual_url",
    online_meeting_url: "",
    importance: "",
    related_to_type: entityType,
    related_to_label: relatedLabel,
    attachment_names: [],
  };
}

interface Props {
  entityType: EntityActivityType;
  entityId: string;
  relatedLabel: string;
  activities: ScheduledActivity[];
  users: AppUser[];
  onRefresh: () => void;
}

function ActivityFormFields({
  form, setForm, relatedLabel, users,
}: {
  form: ActivityForm;
  setForm: (f: ActivityForm) => void;
  relatedLabel: string;
  users: AppUser[];
}) {
  const updateTime = (key: "start_time" | "end_time", value: string) => {
    const next = { ...form, [key]: value };
    next.duration_minutes = computeDuration(next.start_time, next.end_time);
    setForm(next);
  };

  const updateAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    setForm({ ...form, attachment_names: Array.from(files).map((f) => f.name) });
  };

  return (
    <div className="space-y-6">
      <Input
        label="Add Title *"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="Add activity title"
      />

      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto pb-1">
        {ACTIVITY_TYPES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setForm({ ...form, activity_type: id })}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold rounded-xl transition-colors whitespace-nowrap",
              form.activity_type === id
                ? "bg-primary-50 text-primary border border-primary/20"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</label>
          <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={form.activity_date}
              onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start</label>
          <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm">
            <Clock3 className="h-4 w-4 text-gray-400" />
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => updateTime("start_time", e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">End</label>
          <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-sm">
            <Clock3 className="h-4 w-4 text-gray-400" />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => updateTime("end_time", e.target.value)}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</label>
          <div className="mt-1 border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm text-gray-700 font-medium">
            {form.duration_minutes || 0} Minutes
          </div>
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.share_with_guests}
          onChange={(e) => setForm({ ...form, share_with_guests: e.target.checked })}
          className="rounded border-gray-300"
        />
        Share with guests
      </label>

      <div className="space-y-4 rounded-2xl border border-gray-200 p-4 bg-white/70">
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
            <MapPin className="h-4 w-4 text-gray-400" /> Location
          </div>
          <Input
            label=""
            placeholder="Search Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Link2 className="h-4 w-4 text-gray-400" /> Related to
          </div>
          <Select
            label=""
            options={[
              { value: "candidate", label: "Candidate" },
              { value: "client", label: "Client" },
              { value: "job", label: "Job" },
            ]}
            value={form.related_to_type}
            onChange={(e) => setForm({ ...form, related_to_type: e.target.value as EntityActivityType })}
          />
          <Input
            label=""
            value={form.related_to_label || relatedLabel}
            onChange={(e) => setForm({ ...form, related_to_label: e.target.value })}
            placeholder={relatedLabel}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
            <UserCog className="h-4 w-4 text-gray-400" /> Assignees
          </div>
          <Select
            label=""
            placeholder="Assign to"
            options={users.map((u) => ({ value: String(u.id), label: u.name }))}
            value={form.assigned_to_id}
            onChange={(e) => setForm({ ...form, assigned_to_id: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] items-start gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 mt-2">
            <UserRoundPlus className="h-4 w-4 text-gray-400" /> Attendees
          </div>
          <div className="space-y-2">
            <Input
              label=""
              value={form.attendees}
              onChange={(e) => setForm({ ...form, attendees: e.target.value })}
              placeholder="Search candidates or enter email address"
            />
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={form.invite_as_bcc}
                onChange={(e) => setForm({ ...form, invite_as_bcc: e.target.checked })}
                className="rounded border-gray-300"
              />
              Invite as BCC
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr_1fr] items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Video className="h-4 w-4 text-gray-400" /> Online meeting type
          </div>
          <Select
            label=""
            options={[
              { value: "manual_url", label: "Manual URL" },
              { value: "google_meet", label: "Google Meet" },
              { value: "zoom", label: "Zoom" },
              { value: "teams", label: "Microsoft Teams" },
            ]}
            value={form.online_meeting_type}
            onChange={(e) => setForm({ ...form, online_meeting_type: e.target.value })}
          />
          <Input
            label=""
            placeholder="Enter URL"
            value={form.online_meeting_url}
            onChange={(e) => setForm({ ...form, online_meeting_url: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
            <CircleAlert className="h-4 w-4 text-gray-400" /> Importance
          </div>
          <Select
            label=""
            placeholder="Select importance"
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
              { value: "critical", label: "Critical" },
            ]}
            value={form.importance}
            onChange={(e) => setForm({ ...form, importance: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <AlignLeft className="h-4 w-4 text-gray-400" /> Description
        </div>
        <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 p-2 bg-gray-50/70">
            {[
              { icon: Type, label: "T" },
              { icon: List, label: "List" },
              { icon: Link, label: "Link" },
              { icon: AlignLeft, label: "Align" },
              { icon: ChevronDown, label: "More" },
            ].map(({ icon: Icon, label }) => (
              <button key={label} type="button" className="p-1.5 text-gray-500 hover:bg-white rounded-lg">
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <Textarea
            label=""
            placeholder="Add description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={5}
            className="border-0 rounded-none shadow-none focus:ring-0 focus:border-0"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Paperclip className="h-4 w-4 text-gray-400" /> Attachments
        </div>
        <label className="block rounded-2xl border-2 border-dashed border-gray-200 p-6 text-center bg-gray-50/60 hover:border-primary/30 transition-colors cursor-pointer">
          <input type="file" multiple className="hidden" onChange={(e) => updateAttachments(e.target.files)} />
          <span className="inline-flex items-center gap-2 text-sm text-gray-700">
            <Paperclip className="h-4 w-4 text-primary" /> Select files or drop files here
          </span>
          <p className="text-xs text-gray-400 mt-2">Supported file types (max 20MB): .pdf, .doc, .docx, .xls, .xlsx, .jpg, .png, .zip</p>
        </label>
        {form.attachment_names.length > 0 && (
          <div className="text-xs text-gray-500">
            {form.attachment_names.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EntityActivitiesTab({
  entityType, entityId, relatedLabel, activities, users, onRefresh,
}: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm(entityType, relatedLabel));

  const apiBase = `/${ENTITY_API_BASE[entityType]}/${entityId}/activities`;

  const openCreate = () => {
    setForm(emptyForm(entityType, relatedLabel));
    setCreateOpen(true);
  };

  const openEdit = (a: ScheduledActivity) => {
    setForm(activityToForm(a, entityType, relatedLabel));
    setEditId(a.id);
  };

  const payloadFromForm = (f: ActivityForm) => ({
    title: f.title,
    activity_type: f.activity_type,
    activity_date: f.activity_date,
    start_time: f.start_time || null,
    end_time: f.end_time || null,
    duration_minutes: f.duration_minutes || null,
    location: f.location || null,
    description: f.description || null,
    assigned_to_id: f.assigned_to_id ? Number(f.assigned_to_id) : null,
    share_with_guests: f.share_with_guests,
  });

  const createActivity = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    await api.post(apiBase, payloadFromForm(form));
    toast.success("Activity created");
    setCreateOpen(false);
    setForm(emptyForm(entityType, relatedLabel));
    onRefresh();
  };

  const updateActivity = async () => {
    if (!editId || !form.title.trim()) return;
    await api.put(`${apiBase}/${editId}`, payloadFromForm(form));
    toast.success("Activity updated");
    setEditId(null);
    setForm(emptyForm(entityType, relatedLabel));
    onRefresh();
  };

  const deleteActivity = async (activityId: number) => {
    if (!confirm("Delete this activity?")) return;
    await api.delete(`${apiBase}/${activityId}`);
    toast.success("Deleted");
    onRefresh();
  };

  return (
    <div>
      <button type="button" onClick={openCreate}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors mb-5 shadow-sm">
        <Plus className="h-4 w-4" /> Add Activity
      </button>

      <div className="space-y-4">
        {activities.length ? activities.map((a) => (
          <div key={a.id} className="border border-gray-200/80 rounded-2xl bg-white shadow-card overflow-hidden animate-fade-in">
            <div className="flex items-start gap-3 px-5 py-4">
              <div className="mt-0.5 w-5 h-5 rounded bg-green-500 flex items-center justify-center shrink-0">
                <CheckSquare className="h-3 w-3 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{a.title}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Date</p>
                    <p className="text-gray-800">{a.activity_date.slice(0, 10)}</p>
                    {a.duration_minutes != null && <><p className="text-gray-500 mt-2 font-medium">Duration</p><p className="text-gray-800">{a.duration_minutes} Minutes</p></>}
                    <p className="text-gray-500 mt-2 font-medium">Type</p>
                    <p className="text-gray-800 capitalize">{a.activity_type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Related to</p>
                    <p className="text-primary">{relatedLabel}</p>
                    <p className="text-gray-500 mt-2 font-medium">Created by</p>
                    <div className="flex items-center gap-2 mt-1">
                      <UserAvatar name={a.created_by_name || "U"} />
                      <span className="text-gray-800">{a.created_by_name}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Assigned To</p>
                    {a.assigned_to_name ? (
                      <div className="flex items-center gap-2">
                        <UserAvatar name={a.assigned_to_name} />
                        <span className="text-gray-800">{a.assigned_to_name}</span>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </div>
                </div>
                {a.description && (
                  <div className="mt-4">
                    <p className="text-gray-500 font-medium text-sm mb-1">Description:</p>
                    <p className={cn("text-sm text-gray-700", expanded !== a.id && "line-clamp-2")}>{a.description}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 mt-4">
                  {a.description && (
                    <button type="button" onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      className="text-sm text-primary border border-primary/30 px-3 py-1 rounded-xl hover:bg-primary-50">
                      {expanded === a.id ? "Show Less" : "Read More"}
                    </button>
                  )}
                  <button type="button" onClick={() => openEdit(a)} className="p-1.5 text-primary hover:bg-primary-50 rounded-xl transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => deleteActivity(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors ml-auto">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="border border-dashed border-gray-200 rounded-2xl bg-white py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 text-primary mx-auto flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8" />
            </div>
            <p className="text-gray-800 font-semibold">You have not scheduled any activities yet</p>
            <p className="text-sm text-gray-500 mt-1 mb-5">All scheduled activities will appear here once the first one is created.</p>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Activity
            </button>
          </div>
        )}
      </div>

      <AnimatedModal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Activity" size="xl">
        <ActivityFormFields form={form} setForm={setForm} relatedLabel={relatedLabel} users={users} />
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
          <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <Button onClick={createActivity}>Continue</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={editId !== null} onClose={() => setEditId(null)} title="Edit Activity" size="xl">
        <ActivityFormFields form={form} setForm={setForm} relatedLabel={relatedLabel} users={users} />
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
          <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <Button onClick={updateActivity}>Save Changes</Button>
        </div>
      </AnimatedModal>
    </div>
  );
}
