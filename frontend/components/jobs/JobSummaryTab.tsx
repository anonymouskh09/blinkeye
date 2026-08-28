"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import { jobRef } from "@/components/jobs/JobDetailHeader";
import api from "@/lib/api";
import type { Job, User } from "@/types";
import { BILLING_MODEL_LABELS, SERVICE_MODEL_LABELS } from "@/types";

function SummaryRow({
  label, value, onSave, type = "text", readonly,
}: {
  label: string;
  value: string;
  onSave: (v: string) => Promise<void>;
  type?: "text" | "number" | "textarea";
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

  if (readonly) {
    return (
      <div className="flex items-center px-4 py-3.5 border-b border-gray-100 last:border-0">
        <dt className="w-44 shrink-0 text-sm text-gray-600">{label}</dt>
        <dd className="flex-1 text-sm text-gray-800">{value || "—"}</dd>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-start gap-3 px-4 py-3.5 bg-slate-50 border-b border-gray-100">
        <dt className="w-44 shrink-0 text-sm text-gray-600 pt-1">{label}</dt>
        {type === "textarea" ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
            className="flex-1 text-sm border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-primary-500/30" />
        ) : (
          <input autoFocus type={type} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 text-sm bg-transparent border-b-2 border-primary outline-none py-0.5" />
        )}
        <button type="button" onClick={() => setEditing(false)} className="p-1 rounded bg-red-50 text-red-500"><X className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={save} disabled={saving} className="p-1 rounded bg-green-50 text-green-600"><Check className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-slate-50/50">
      <dt className="w-44 shrink-0 text-sm text-gray-600">{label}</dt>
      <dd className="flex-1 text-sm text-gray-800">
        {readonly ? (value || "—") : value ? (
          <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="text-left hover:text-primary">{value}</button>
        ) : (
          <button type="button" onClick={() => { setDraft(""); setEditing(true); }} className="text-primary hover:underline text-sm">+ Add</button>
        )}
      </dd>
      {value && !readonly && (
        <button type="button" onClick={() => { setDraft(value); setEditing(true); }}
          className="p-1 text-primary opacity-0 group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

interface Props {
  job: Job;
  users: User[];
  onUpdate: () => void;
}

export default function JobSummaryTab({ job, users, onUpdate }: Props) {
  const [descEditing, setDescEditing] = useState(false);
  const [descDraft, setDescDraft] = useState(job.description || "");

  const save = async (key: string, value: string) => {
    const payload: Record<string, unknown> = { [key]: value || null };
    if (key === "salary_min" || key === "salary_max" || key === "number_of_positions") {
      payload[key] = value ? Number(value) : null;
    }
    await api.put(`/jobs/${job.id}`, payload);
    toast.success("Updated");
    onUpdate();
  };

  const saveDescription = async () => {
    await api.put(`/jobs/${job.id}`, { description: descDraft });
    toast.success("Description saved");
    setDescEditing(false);
    onUpdate();
  };

  const salaryMin = job.salary_min ? String(job.salary_min) : "";
  const salaryMax = job.salary_max ? String(job.salary_max) : "";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Job Description</h3>
            {!descEditing && (
              <button type="button" onClick={() => { setDescDraft(job.description || ""); setDescEditing(true); }}
                className="text-sm text-primary hover:underline">+ Add</button>
            )}
          </div>
          <div className="p-4 min-h-[120px]">
            {descEditing ? (
              <div className="space-y-3">
                <textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} rows={8}
                  className="w-full text-sm border border-gray-200 rounded-md p-3 outline-none focus:ring-2 focus:ring-primary-500/30"
                  placeholder="Write job description (min 250 characters for AI requirements extraction)..." />
                <div className="flex gap-2">
                  <button type="button" onClick={saveDescription} className="px-3 py-1.5 bg-primary text-white text-sm rounded-md hover:bg-primary-700">Save</button>
                  <button type="button" onClick={() => setDescEditing(false)} className="px-3 py-1.5 border border-gray-200 text-sm rounded-md">Cancel</button>
                </div>
              </div>
            ) : job.description ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No job description yet. Click + Add to write one.</p>
            )}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Job Requirements</h3>
          </div>
          <div className="p-6 text-center">
            {job.required_skills || job.experience_required ? (
              <dl className="text-left text-sm space-y-2">
                {job.experience_required && <div><dt className="text-gray-500">Experience</dt><dd>{job.experience_required}</dd></div>}
                {job.required_skills && <div><dt className="text-gray-500">Skills</dt><dd>{job.required_skills}</dd></div>}
              </dl>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-3">Job requirements are empty.</p>
                <p className="text-xs text-gray-400 mb-4">Add a job description of at least 250 characters to automatically extract requirements, or manually input them.</p>
                <button type="button" onClick={() => { setDescDraft(job.description || ""); setDescEditing(true); }}
                  className="text-sm text-primary hover:underline">Add job description</button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Job Details</h3>
          </div>
          <dl>
            <SummaryRow label="Job Reference" value={jobRef(job.id)} onSave={async () => {}} readonly />
            <SummaryRow label="Client" value={job.client_name || "—"} onSave={async () => {}} readonly />
            <SummaryRow label="Engagement" value={job.engagement_name || "—"} onSave={async () => {}} readonly />
            <SummaryRow
              label="Service Model"
              value={job.service_model ? SERVICE_MODEL_LABELS[job.service_model] : "—"}
              onSave={async () => {}}
              readonly
            />
            <SummaryRow
              label="Billing Model"
              value={job.billing_model ? BILLING_MODEL_LABELS[job.billing_model] : "—"}
              onSave={async () => {}}
              readonly
            />
            <SummaryRow label="Position Name" value={job.title} onSave={(v) => save("title", v)} />
            <SummaryRow label="Job Location" value={job.location || ""} onSave={(v) => save("location", v)} />
            <SummaryRow label="Remote" value={job.location?.toLowerCase().includes("remote") ? "Yes" : "No"} onSave={async () => {}} readonly />
            <SummaryRow label="Headcount" value={String(job.number_of_positions)} onSave={(v) => save("number_of_positions", v)} type="number" />
            <SummaryRow label="Experience Level" value={job.experience_required || ""} onSave={(v) => save("experience_required", v)} />
            <SummaryRow label="Minimum Salary" value={salaryMin} onSave={(v) => save("salary_min", v)} type="number" />
            <SummaryRow label="Maximum Salary" value={salaryMax} onSave={(v) => save("salary_max", v)} type="number" />
            <SummaryRow label="Contract Details" value={job.job_type.replace("-", " ")} onSave={async () => {}} readonly />
            <SummaryRow label="Open Date" value={job.created_at.slice(0, 10)} onSave={async () => {}} readonly />
            <SummaryRow label="Required Skills" value={job.required_skills || ""} onSave={(v) => save("required_skills", v)} type="textarea" />
          </dl>
        </div>

        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between bg-[#eef2f6] px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">Job Owner</h3>
          </div>
          <div className="p-4">
            {job.assigned_recruiter_name ? (
              <div className="flex items-center gap-2">
                <UserAvatar name={job.assigned_recruiter_name} size="md" />
                <div>
                  <p className="text-sm font-medium text-primary">{job.assigned_recruiter_name}</p>
                  <select
                    className="text-xs text-gray-500 mt-1 border border-gray-200 rounded px-2 py-1"
                    value={job.assigned_recruiter_id || ""}
                    onChange={async (e) => {
                      await api.put(`/jobs/${job.id}`, { assigned_recruiter_id: Number(e.target.value) });
                      toast.success("Owner updated");
                      onUpdate();
                    }}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <select className="w-full text-sm border border-gray-200 rounded-md px-3 py-2"
                value="" onChange={async (e) => {
                  await api.put(`/jobs/${job.id}`, { assigned_recruiter_id: Number(e.target.value) });
                  toast.success("Owner assigned");
                  onUpdate();
                }}>
                <option value="">Assign owner...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
