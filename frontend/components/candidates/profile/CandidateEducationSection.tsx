"use client";

import { GraduationCap, MapPin } from "lucide-react";
import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import { EducationEditor } from "@/components/candidates/profile/ProfileSectionEditors";
import type { CandidateEducation } from "@/types";

interface Props {
  educations: CandidateEducation[];
  onSave: (educations: CandidateEducation[]) => Promise<void>;
}

export default function CandidateEducationSection({ educations, onSave }: Props) {
  return (
    <ProfileSectionCard
      title="Education"
      bodyClassName="py-5"
      action={<EducationEditor educations={educations} onSave={onSave} />}
    >
      {!educations.length ? (
        <p className="py-6 text-center text-sm text-gray-400">No education records yet. Click Edit to add.</p>
      ) : (
        <div className="space-y-0">
          {educations.map((edu, i) => {
            const isLast = i === educations.length - 1;
            return (
              <div key={`${edu.school}-${i}`} className="relative flex gap-4 pb-8 last:pb-0">
                {!isLast && <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-gray-200" aria-hidden />}
                <div className="relative z-10 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-200 bg-emerald-50">
                  <GraduationCap className="h-3 w-3 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  {edu.degree && <h4 className="text-sm font-semibold text-gray-900">{edu.degree}</h4>}
                  <p className={edu.degree ? "mt-0.5 text-sm font-medium text-primary" : "text-sm font-semibold text-gray-900"}>
                    {edu.school}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {edu.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {edu.location}
                      </span>
                    )}
                    {[edu.start_date, edu.end_date].filter(Boolean).join(" – ") && (
                      <span>{[edu.start_date, edu.end_date].filter(Boolean).join(" – ")}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ProfileSectionCard>
  );
}
