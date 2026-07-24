"use client";

import { useState } from "react";
import { Pencil, Check, X, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import { candidateRef } from "@/components/candidates/CandidatesListTable";
import CandidateProfileSummaryCard from "@/components/candidates/CandidateProfileSummaryCard";
import CandidateExperienceTimeline from "@/components/candidates/profile/CandidateExperienceTimeline";
import CandidateEducationSection from "@/components/candidates/profile/CandidateEducationSection";
import CandidateSkillsBadges from "@/components/candidates/profile/CandidateSkillsBadges";
import CandidateProfileSidebar from "@/components/candidates/profile/CandidateProfileSidebar";
import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import api from "@/lib/api";
import {
  profileFieldsFromExperiences,
  syncCompanyToExperiences,
  syncTitleToExperiences,
} from "@/lib/candidateProfileSync";
import { formatDateTimeBullet } from "@/lib/utils";
import type { ActivityLog, Candidate, CandidateEducation, CandidateExperience, Note, Job } from "@/types";

function SummaryRow({
  label, value, onSave, readonly, type = "text",
}: {
  label: string; value: string; onSave: (v: string) => Promise<void>; readonly?: boolean; type?: "text" | "textarea";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { toast.error("Failed to save"); } finally { setSaving(false); }
  };

  if (readonly) {
    return (
      <div className="flex items-center gap-4 border-b border-gray-50 py-3 last:border-0">
        <dt className="w-44 shrink-0 text-sm text-gray-500">{label}</dt>
        <dd className="flex-1 text-sm text-gray-800">{value || "—"}</dd>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-start gap-4 border-b border-gray-50 bg-slate-50/50 py-3">
        <dt className="w-44 shrink-0 pt-1 text-sm text-gray-500">{label}</dt>
        {type === "textarea" ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-primary" />
        ) : (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 border-b-2 border-primary bg-transparent text-sm outline-none" />
        )}
        <button type="button" onClick={() => setEditing(false)} className="p-1 text-red-500"><X className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={save} disabled={saving} className="p-1 text-green-600"><Check className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-4 border-b border-gray-50 py-3 last:border-0 hover:bg-slate-50/30">
      <dt className="w-44 shrink-0 text-sm text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm text-gray-800">
        {value ? (
          <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="text-left hover:text-primary">{value}</button>
        ) : (
          <button type="button" onClick={() => { setDraft(""); setEditing(true); }} className="text-sm text-primary hover:underline">+ Add</button>
        )}
      </dd>
      {value && (
        <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="p-1 text-primary opacity-0 transition group-hover:opacity-100">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface Props {
  candidate: Candidate;
  notes: Note[];
  history: ActivityLog[];
  jobs: Job[];
  onUpdate: () => void;
  onAddNote?: () => void;
}

export default function CandidateSummaryTab({ candidate, notes, history, jobs, onUpdate, onAddNote }: Props) {
  const extras = candidate.profile_extras || {};
  const firstName = extras.first_name || candidate.name.split(" ")[0] || "";
  const lastName = extras.last_name || candidate.name.split(" ").slice(1).join(" ") || "";
  const summary = extras.summary || candidate.summary || "";

  const patch = async (payload: Record<string, unknown>) => {
    await api.patch(`/candidates/${candidate.id}/profile`, payload);
    toast.success("Updated");
    onUpdate();
  };

  const patchExtra = async (key: string, value: string) => {
    await patch({ profile_extras: { ...extras, [key]: value || null } });
  };

  const saveSummary = async (value: string) => {
    await api.patch(`/candidates/${candidate.id}/profile`, {
      profile_extras: { ...extras, summary: value || null },
    });
    onUpdate();
  };

  const skills = candidate.skill_levels?.length
    ? candidate.skill_levels.map((s) => s.name)
    : candidate.skills || [];

  const saveExperiences = async (experiences: CandidateExperience[]) => {
    await patch({ experiences, ...profileFieldsFromExperiences(experiences) });
  };

  const saveEducations = async (educations: CandidateEducation[]) => {
    await patch({ educations });
  };

  const saveSkills = async (nextSkills: string[]) => {
    await patch({
      skills: nextSkills,
      skill_levels: nextSkills.map((name) => ({ name, level: 8 })),
    });
  };

  const saveCompany = async (company: string) => {
    await patch({
      current_company: company || null,
      experiences: syncCompanyToExperiences(candidate.experiences || [], company),
    });
  };

  const saveJobTitle = async (title: string) => {
    await patch({
      current_job_title: title || null,
      experiences: syncTitleToExperiences(candidate.experiences || [], title),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <button
          type="button"
          onClick={onAddNote}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-50 px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-primary-100"
        >
          <Plus className="h-4 w-4" />
          Add a note
        </button>

        <CandidateProfileSummaryCard summary={summary} onSave={saveSummary} />

        <CandidateExperienceTimeline experiences={candidate.experiences || []} onSave={saveExperiences} />

        <CandidateEducationSection educations={candidate.educations || []} onSave={saveEducations} />

        <CandidateSkillsBadges skills={skills} onSave={saveSkills} />

        <ProfileSectionCard title="Candidate Details" bodyClassName="py-1">
          <dl>
            <SummaryRow label="Full Name" value={candidate.name} onSave={(v) => patch({ name: v })} />
            <SummaryRow label="First Name" value={firstName} onSave={(v) => patchExtra("first_name", v)} />
            <SummaryRow label="Last Name" value={lastName} onSave={(v) => patchExtra("last_name", v)} />
            <SummaryRow label="Reference" value={candidateRef(candidate.id)} onSave={async () => {}} readonly />
            <SummaryRow label="Gender" value={extras.gender || ""} onSave={(v) => patchExtra("gender", v)} />
            <SummaryRow label="Diploma" value={extras.diploma || ""} onSave={(v) => patchExtra("diploma", v)} />
            <SummaryRow label="University" value={extras.university || ""} onSave={(v) => patchExtra("university", v)} />
            <SummaryRow label="Current Company" value={candidate.current_company || ""} onSave={saveCompany} />
            <SummaryRow label="Current Position" value={candidate.current_job_title || ""} onSave={saveJobTitle} />
            <SummaryRow label="Location" value={candidate.location || ""} onSave={(v) => patch({ location: v || null })} />
            <SummaryRow label="Email" value={candidate.email} onSave={(v) => patch({ email: v })} />
            <SummaryRow label="Phone" value={candidate.phone || ""} onSave={(v) => patch({ phone: v })} />
            <SummaryRow label="Skype" value={extras.skype || ""} onSave={(v) => patchExtra("skype", v)} />
            <SummaryRow label="Other Contact" value={extras.other_contact || ""} onSave={(v) => patchExtra("other_contact", v)} />
          </dl>
        </ProfileSectionCard>

        <ProfileSectionCard title="Log Book" bodyClassName="py-1">
          <dl>
            <SummaryRow label="Source" value={extras.source || "Manual entry"} onSave={async () => {}} readonly />
            <SummaryRow label="Created at" value={formatDateTimeBullet(candidate.created_at)} onSave={async () => {}} readonly />
            <SummaryRow label="Resume added" value={extras.resume_added_at ? formatDateTimeBullet(extras.resume_added_at) : "—"} onSave={async () => {}} readonly />
            <SummaryRow label="Created by" value={candidate.created_by_name || "—"} onSave={async () => {}} readonly />
          </dl>
        </ProfileSectionCard>

        <ProfileSectionCard title="Recent History" bodyClassName="py-2">
          <div className="divide-y divide-gray-50">
            {history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex items-start gap-3 py-3">
                <UserAvatar name={h.created_by_name || "U"} size="md" />
                <p className="flex-1 text-sm text-gray-800">{h.description}</p>
                <span className="whitespace-nowrap text-xs text-gray-400">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</span>
              </div>
            ))}
            {!history.length && <p className="py-8 text-center text-sm text-gray-400">No history yet</p>}
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard title="Recent Notes" bodyClassName="py-3">
          <div className="space-y-2">
            {notes.slice(0, 3).map((n) => (
              <div key={n.id} className="rounded-lg border border-primary/10 bg-primary-50/40 p-3 text-sm text-gray-800">{n.content}</div>
            ))}
            {!notes.length && <p className="py-6 text-center text-sm text-gray-400">No notes yet</p>}
          </div>
        </ProfileSectionCard>
      </div>

      <CandidateProfileSidebar candidate={candidate} jobs={jobs} onUpdate={onUpdate} />
    </div>
  );
}
