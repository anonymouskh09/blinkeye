"use client";

import { Briefcase, MapPin } from "lucide-react";
import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import { ExperienceEditor } from "@/components/candidates/profile/ProfileSectionEditors";
import type { CandidateExperience } from "@/types";

function formatDates(exp: CandidateExperience) {
  const end = exp.is_current ? "Present" : exp.end_date;
  return [exp.start_date, end].filter(Boolean).join(" – ");
}

function parseResponsibilities(description?: string): string[] {
  if (!description) return [];
  return description
    .split(/\n|•|·|-(?=\s)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

interface Props {
  experiences: CandidateExperience[];
  onSave: (experiences: CandidateExperience[]) => Promise<void>;
}

export default function CandidateExperienceTimeline({ experiences, onSave }: Props) {
  return (
    <ProfileSectionCard
      title="Experience"
      bodyClassName="py-5"
      action={<ExperienceEditor experiences={experiences} onSave={onSave} />}
    >
      {!experiences.length ? (
        <p className="py-6 text-center text-sm text-gray-400">
          No experience records yet. Click Edit to add or upload a resume.
        </p>
      ) : (
        <div className="relative space-y-0">
          {experiences.map((exp, i) => {
            const responsibilities = parseResponsibilities(exp.description);
            const isLast = i === experiences.length - 1;
            const company = exp.company && exp.company !== "Unknown" ? exp.company : exp.company || "Unknown";
            return (
              <div key={`${exp.company}-${exp.title}-${i}`} className="relative flex gap-4 pb-8 last:pb-0">
                {!isLast && <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-gray-200" aria-hidden />}
                <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-primary-50">
                  <Briefcase className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h4 className="text-sm font-semibold text-gray-900">{exp.title || "Untitled role"}</h4>
                  <p className="mt-0.5 text-sm font-medium text-primary">{company}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {exp.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {exp.location}
                      </span>
                    )}
                    {formatDates(exp) && <span>{formatDates(exp)}</span>}
                  </div>
                  {exp.description && !responsibilities.length && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">{exp.description}</p>
                  )}
                  {responsibilities.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Responsibilities</p>
                      <ul className="space-y-1.5">
                        {responsibilities.map((item) => (
                          <li key={item} className="flex gap-2 text-sm text-gray-600">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ProfileSectionCard>
  );
}
