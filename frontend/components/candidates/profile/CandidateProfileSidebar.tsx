"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Star } from "lucide-react";
import toast from "react-hot-toast";
import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import api from "@/lib/api";
import { COMMON_TIMEZONES, SALARY_CURRENCIES, guessTimezoneFromLocation } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { ApiResponse, Candidate, CandidateStatus, Job, OutreachEnrollmentSummary } from "@/types";

const STATUSES: { id: CandidateStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "reviewed", label: "Reviewed" },
  { id: "shortlisted", label: "Shortlisted" },
  { id: "interviewing", label: "Interviewing" },
  { id: "hired", label: "Hired" },
  { id: "rejected", label: "Rejected" },
];

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
      <div className="flex items-start justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
        <dt className="shrink-0 text-xs text-gray-500">{label}</dt>
        <dd className="text-right text-xs font-medium text-gray-800">{value || "—"}</dd>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-2 border-b border-gray-50 py-2.5 last:border-0">
        <dt className="text-xs text-gray-500">{label}</dt>
        {type === "textarea" ? (
          <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary" />
        ) : (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-primary" />
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="text-xs font-medium text-primary">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3 border-b border-gray-50 py-2.5 last:border-0">
      <dt className="shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-gray-800">
        {value ? (
          <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="hover:text-primary">{value}</button>
        ) : (
          <button type="button" onClick={() => { setDraft(""); setEditing(true); }} className="text-primary hover:underline">+ Add</button>
        )}
      </dd>
    </div>
  );
}

interface Props {
  candidate: Candidate;
  jobs: Job[];
  onUpdate: () => void;
}

export default function CandidateProfileSidebar({ candidate, jobs, onUpdate }: Props) {
  const extras = candidate.profile_extras || {};
  const [jobSearch, setJobSearch] = useState("");
  const [jobOpen, setJobOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [sequences, setSequences] = useState<{ id: number; name: string; status: string }[]>([]);
  const [enrollments, setEnrollments] = useState<OutreachEnrollmentSummary[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  const [selectedSequence, setSelectedSequence] = useState("");
  const [salaryMin, setSalaryMin] = useState(String(candidate.salary_min ?? ""));
  const [salaryMax, setSalaryMax] = useState(String(candidate.salary_max ?? ""));
  const [salaryCurrency, setSalaryCurrency] = useState(candidate.salary_currency || "USD");
  const [timezone, setTimezone] = useState(candidate.timezone || "");
  const [savingSalary, setSavingSalary] = useState(false);
  const [savingTz, setSavingTz] = useState(false);

  useEffect(() => {
    setSalaryMin(String(candidate.salary_min ?? ""));
    setSalaryMax(String(candidate.salary_max ?? ""));
    setSalaryCurrency(candidate.salary_currency || "USD");
    setTimezone(candidate.timezone || guessTimezoneFromLocation(candidate.location) || "");
  }, [candidate]);

  const fetchEnrollments = useCallback(async () => {
    setLoadingEnrollments(true);
    try {
      const res = await api.get<ApiResponse<{ items: OutreachEnrollmentSummary[] }>>(
        `/outreach/candidates/${candidate.id}/enrollments`,
      );
      setEnrollments(res.data.data.items);
    } catch {
      setEnrollments([]);
    } finally {
      setLoadingEnrollments(false);
    }
  }, [candidate.id]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const patch = async (payload: Record<string, unknown>) => {
    await api.patch(`/candidates/${candidate.id}/profile`, payload);
    onUpdate();
  };

  const patchExtra = async (key: string, value: string) => {
    await patch({ profile_extras: { ...extras, [key]: value || null } });
  };

  const filteredJobs = useMemo(() => {
    const q = jobSearch.toLowerCase();
    return jobs.filter((j) => j.status === "active" && (!q || j.title.toLowerCase().includes(q) || j.client_name?.toLowerCase().includes(q)));
  }, [jobs, jobSearch]);

  const assignedJob = jobs.find((j) => j.id === candidate.assigned_job_id);

  const saveStatus = async (status: CandidateStatus) => {
    await patch({ candidate_status: status });
    toast.success("Status updated");
  };

  const saveRating = async (rating: number) => {
    await patch({ candidate_rating: rating });
    toast.success("Rating saved");
  };

  const assignJob = async (jobId: number | null) => {
    await patch({ assigned_job_id: jobId });
    toast.success(jobId ? "Job assigned" : "Job removed");
    setJobOpen(false);
  };

  const saveSalary = async () => {
    const min = salaryMin ? Number(salaryMin) : null;
    const max = salaryMax ? Number(salaryMax) : null;
    if (min != null && (Number.isNaN(min) || min < 0)) { toast.error("Invalid minimum salary"); return; }
    if (max != null && (Number.isNaN(max) || max < 0)) { toast.error("Invalid maximum salary"); return; }
    if (min != null && max != null && min > max) { toast.error("Min salary cannot exceed max"); return; }
    setSavingSalary(true);
    try {
      await patch({ salary_min: min, salary_max: max, salary_currency: salaryCurrency });
      toast.success("Salary expectation saved");
    } catch {
      toast.error("Failed to save salary");
    } finally {
      setSavingSalary(false);
    }
  };

  const saveTimezone = async (tz: string) => {
    setSavingTz(true);
    try {
      await patch({ timezone: tz || null });
      toast.success("Timezone saved");
    } catch {
      toast.error("Failed to save timezone");
    } finally {
      setSavingTz(false);
    }
  };

  const openEnrollModal = async () => {
    setEnrollOpen(true);
    try {
      const res = await api.get<ApiResponse<{ items: { id: number; name: string; status: string }[] }>>("/outreach/sequences");
      setSequences(res.data.data.items.filter((s) => s.status === "active"));
    } catch {
      setSequences([]);
    }
  };

  const enrollInSequence = async () => {
    if (!selectedSequence) return;
    try {
      await api.post(`/outreach/sequences/${selectedSequence}/enrollments`, { candidate_id: candidate.id });
      toast.success("Enrolled in sequence");
      setEnrollOpen(false);
      setSelectedSequence("");
      fetchEnrollments();
    } catch {
      toast.error("Failed to enroll candidate");
    }
  };

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      <ProfileSectionCard title="Additional Information" bodyClassName="py-2">
        <dl>
          <SummaryRow label="Industry" value={extras.industry || ""} onSave={(v) => patchExtra("industry", v)} />
          <SummaryRow label="Department" value={extras.current_department || ""} onSave={(v) => patchExtra("current_department", v)} />
          <SummaryRow label="Years of Experience" value={candidate.experience_years != null ? String(candidate.experience_years) : ""} onSave={(v) => patch({ experience_years: v ? Number(v) : null })} />
          <SummaryRow label="Current Salary" value={extras.current_salary || ""} onSave={(v) => patchExtra("current_salary", v)} />
          <SummaryRow label="Expected Salary" value={candidate.expected_salary ? String(candidate.expected_salary) : ""} onSave={(v) => patch({ expected_salary: v ? Number(v) : null })} />
          <SummaryRow label="Notice Period" value={candidate.notice_period || ""} onSave={(v) => patch({ notice_period: v })} />
          <SummaryRow label="Benefits" value={extras.benefits || ""} onSave={(v) => patchExtra("benefits", v)} type="textarea" />
          <SummaryRow label="Nationality" value={extras.nationality || ""} onSave={(v) => patchExtra("nationality", v)} />
          <SummaryRow label="Languages" value={extras.languages || ""} onSave={(v) => patchExtra("languages", v)} />
          <SummaryRow label="GDPR Consent" value={extras.gdpr_consent || "Pending"} onSave={(v) => patchExtra("gdpr_consent", v)} />
          <SummaryRow label="Email Consent" value={extras.email_consent || ""} onSave={(v) => patchExtra("email_consent", v)} />
        </dl>
      </ProfileSectionCard>

      <ProfileSectionCard title="Status">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(({ id, label }) => {
            const active = (candidate.candidate_status || "new") === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => saveStatus(id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary/40 hover:bg-primary-50 hover:text-primary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard title="Rating">
        <div className="flex items-center gap-1" role="group" aria-label="Candidate rating">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => saveRating(star)}
              className="rounded p-0.5 transition hover:scale-110"
              aria-label={`Rate ${star} stars`}
            >
              <Star
                className={cn(
                  "h-6 w-6 transition",
                  (candidate.candidate_rating || 0) >= star
                    ? "fill-amber-400 text-amber-400"
                    : "text-gray-300 hover:text-amber-300",
                )}
              />
            </button>
          ))}
        </div>
        {candidate.candidate_rating ? (
          <p className="mt-2 text-xs text-gray-500">{candidate.candidate_rating} of 5 stars</p>
        ) : (
          <p className="mt-2 text-xs text-gray-400">Click to rate this candidate</p>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard title="Job Opening">
        <button
          type="button"
          onClick={() => setJobOpen(true)}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-sm transition hover:border-primary/30 hover:bg-primary-50/50"
        >
          <span className={assignedJob ? "font-medium text-gray-900" : "text-gray-500"}>
            {assignedJob ? `${assignedJob.title} (${assignedJob.client_name})` : "No Job Assigned"}
          </span>
          <span className="text-gray-400">▼</span>
        </button>
      </ProfileSectionCard>

      <ProfileSectionCard title="Salary Expectation">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-500">Min Salary</label>
            <input
              type="number"
              min={0}
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Max Salary</label>
            <input
              type="number"
              min={0}
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
              placeholder="e.g. 80000"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-500">Currency</label>
            <select
              value={salaryCurrency}
              onChange={(e) => setSalaryCurrency(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {SALARY_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={saveSalary}
            disabled={savingSalary}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
          >
            {savingSalary ? "Saving…" : "Save Salary"}
          </button>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard title="Timezone">
        <select
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            saveTimezone(e.target.value);
          }}
          disabled={savingTz}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Select timezone</option>
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
          {timezone && !COMMON_TIMEZONES.includes(timezone) && (
            <option value={timezone}>{timezone}</option>
          )}
        </select>
        <p className="mt-2 text-xs leading-relaxed text-gray-400">
          IANA timezone used for scheduling and outreach.
        </p>
        {!candidate.timezone && candidate.location && (
          <button
            type="button"
            onClick={() => {
              const guessed = guessTimezoneFromLocation(candidate.location);
              if (guessed) { setTimezone(guessed); saveTimezone(guessed); }
            }}
            className="mt-2 text-xs font-medium text-primary hover:underline"
          >
            Auto-detect from location ({candidate.location})
          </button>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard title="Sequences">
        {loadingEnrollments ? (
          <p className="text-sm text-gray-400">Loading sequences…</p>
        ) : enrollments.length ? (
          <div className="space-y-3">
            {enrollments.map((en) => (
              <div key={en.id} className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{en.sequence_name}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-gray-500 border border-gray-200">
                    {en.enrollment_status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Step {en.current_step} of {en.total_steps}
                  {en.current_step_name ? ` · ${en.current_step_name}` : ""}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${en.progress_percent}%` }} />
                </div>
                {en.next_send_at && (
                  <p className="mt-1.5 text-[11px] text-gray-400">Next: {new Date(en.next_send_at).toLocaleString()}</p>
                )}
                <Link href={`/outreach/sequences/${en.sequence_id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                  View sequence
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Not enrolled in any sequences.</p>
        )}
        <button
          type="button"
          onClick={openEnrollModal}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Plus className="h-4 w-4" />
          Enroll in Sequence
        </button>
      </ProfileSectionCard>

      <Modal open={jobOpen} onClose={() => setJobOpen(false)} title="Assign Job Opening">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            placeholder="Search jobs…"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => assignJob(null)}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            No Job Assigned
          </button>
          {filteredJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => assignJob(job.id)}
              className={cn(
                "w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-primary-50",
                candidate.assigned_job_id === job.id && "bg-primary-50 font-medium text-primary",
              )}
            >
              {job.title}
              <span className="block text-xs text-gray-500">{job.client_name}</span>
            </button>
          ))}
          {!filteredJobs.length && <p className="py-4 text-center text-sm text-gray-400">No active jobs found</p>}
        </div>
      </Modal>

      <Modal open={enrollOpen} onClose={() => setEnrollOpen(false)} title="Enroll in Sequence">
        <Select
          label="Sequence"
          placeholder="Select active sequence"
          options={sequences.map((s) => ({ value: String(s.id), label: s.name }))}
          value={selectedSequence}
          onChange={(e) => setSelectedSequence(e.target.value)}
        />
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={enrollInSequence} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
            Enroll
          </button>
          <button type="button" onClick={() => setEnrollOpen(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </Modal>
    </aside>
  );
}
