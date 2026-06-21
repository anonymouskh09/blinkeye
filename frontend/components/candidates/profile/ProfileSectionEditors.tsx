"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import type { CandidateEducation, CandidateExperience } from "@/types";
import { emptyEducation, emptyExperience } from "@/lib/candidateProfileSync";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

interface ExperienceProps {
  experiences: CandidateExperience[];
  onSave: (experiences: CandidateExperience[]) => Promise<void>;
}

export function ExperienceEditor({ experiences, onSave }: ExperienceProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CandidateExperience[]>(experiences);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setItems(experiences.length ? experiences.map((e) => ({ ...e })) : [emptyExperience()]);
    setOpen(true);
  };

  const update = (index: number, field: keyof CandidateExperience, value: string | boolean) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addRow = () => setItems((prev) => [...prev, emptyExperience()]);

  const removeRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(items.filter((e) => e.title.trim() || e.company.trim()));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-primary/30 hover:text-primary"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit Experience" size="lg">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {items.map((exp, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Experience {i + 1}</p>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Job Title">
                  <input className={inputCls} value={exp.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="Full-Stack Developer" />
                </Field>
                <Field label="Company">
                  <input className={inputCls} value={exp.company} onChange={(e) => update(i, "company", e.target.value)} placeholder="Company name" />
                </Field>
                <Field label="Location">
                  <input className={inputCls} value={exp.location || ""} onChange={(e) => update(i, "location", e.target.value)} placeholder="City, Country" />
                </Field>
                <Field label="Start Date">
                  <input className={inputCls} value={exp.start_date || ""} onChange={(e) => update(i, "start_date", e.target.value)} placeholder="2022" />
                </Field>
                <Field label="End Date">
                  <input className={inputCls} value={exp.end_date || ""} onChange={(e) => update(i, "end_date", e.target.value)} placeholder="Present" disabled={exp.is_current} />
                </Field>
                <label className="flex items-center gap-2 pt-6 text-sm text-gray-600">
                  <input type="checkbox" checked={!!exp.is_current} onChange={(e) => update(i, "is_current", e.target.checked)} />
                  Current role
                </label>
              </div>
              <Field label="Description / Responsibilities">
                <textarea className={inputCls} rows={3} value={exp.description || ""} onChange={(e) => update(i, "description", e.target.value)} placeholder="One responsibility per line" />
              </Field>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={addRow} className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-primary hover:text-primary">
            + Add experience
          </button>
          <button type="button" onClick={save} disabled={saving} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </>
  );
}

interface EducationProps {
  educations: CandidateEducation[];
  onSave: (educations: CandidateEducation[]) => Promise<void>;
}

export function EducationEditor({ educations, onSave }: EducationProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CandidateEducation[]>(educations);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setItems(educations.length ? educations.map((e) => ({ ...e })) : [emptyEducation()]);
    setOpen(true);
  };

  const update = (index: number, field: keyof CandidateEducation, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addRow = () => setItems((prev) => [...prev, emptyEducation()]);
  const removeRow = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(items.filter((e) => e.school.trim() || e.degree?.trim()));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-primary/30 hover:text-primary"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit Education" size="lg">
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {items.map((edu, i) => (
            <div key={i} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Education {i + 1}</p>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Degree">
                  <input className={inputCls} value={edu.degree || ""} onChange={(e) => update(i, "degree", e.target.value)} placeholder="Bachelor of Science" />
                </Field>
                <Field label="Institution">
                  <input className={inputCls} value={edu.school} onChange={(e) => update(i, "school", e.target.value)} placeholder="University name" />
                </Field>
                <Field label="Location">
                  <input className={inputCls} value={edu.location || ""} onChange={(e) => update(i, "location", e.target.value)} placeholder="City, Country" />
                </Field>
                <Field label="Start Date">
                  <input className={inputCls} value={edu.start_date || ""} onChange={(e) => update(i, "start_date", e.target.value)} placeholder="2019" />
                </Field>
                <Field label="End Date">
                  <input className={inputCls} value={edu.end_date || ""} onChange={(e) => update(i, "end_date", e.target.value)} placeholder="2023" />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={addRow} className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-primary hover:text-primary">
            + Add education
          </button>
          <button type="button" onClick={save} disabled={saving} className="ml-auto rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </>
  );
}

interface SkillsProps {
  skills: string[];
  onSave: (skills: string[]) => Promise<void>;
}

export function SkillsEditor({ skills, onSave }: SkillsProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setDraft(skills.join(", "));
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const parsed = draft.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      await onSave(parsed);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-primary/30 hover:text-primary"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit Skills">
        <p className="mb-2 text-xs text-gray-500">Separate skills with commas or new lines.</p>
        <textarea
          className={`${inputCls} min-h-[120px]`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="JavaScript, React, Node.js, PHP"
        />
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export function SectionEditAction({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
