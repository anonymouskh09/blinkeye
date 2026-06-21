"use client";

import ProfileSectionCard from "@/components/candidates/profile/ProfileSectionCard";
import { SkillsEditor } from "@/components/candidates/profile/ProfileSectionEditors";

interface Props {
  skills: string[];
  onSave: (skills: string[]) => Promise<void>;
}

export default function CandidateSkillsBadges({ skills, onSave }: Props) {
  return (
    <ProfileSectionCard
      title="Skills"
      bodyClassName="py-4"
      action={<SkillsEditor skills={skills} onSave={onSave} />}
    >
      {!skills.length ? (
        <p className="py-4 text-center text-sm text-gray-400">No skills yet. Click Edit to add or upload a resume.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:border-primary/30 hover:bg-primary-50 hover:text-primary"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </ProfileSectionCard>
  );
}
