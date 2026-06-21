import type { CandidateEducation, CandidateExperience } from "@/types";

export function getCurrentExperienceIndex(experiences: CandidateExperience[]): number {
  const idx = experiences.findIndex((e) => e.is_current);
  return idx >= 0 ? idx : 0;
}

export function syncCompanyToExperiences(
  experiences: CandidateExperience[],
  company: string,
): CandidateExperience[] {
  if (!experiences.length) return experiences;
  const idx = getCurrentExperienceIndex(experiences);
  const next = [...experiences];
  next[idx] = { ...next[idx], company };
  return next;
}

export function syncTitleToExperiences(
  experiences: CandidateExperience[],
  title: string,
): CandidateExperience[] {
  if (!experiences.length) return experiences;
  const idx = getCurrentExperienceIndex(experiences);
  const next = [...experiences];
  next[idx] = { ...next[idx], title };
  return next;
}

export function profileFieldsFromExperiences(experiences: CandidateExperience[]) {
  if (!experiences.length) return {};
  const current = experiences[getCurrentExperienceIndex(experiences)];
  return {
    current_job_title: current.title || null,
    current_company: current.company && current.company !== "Unknown" ? current.company : null,
  };
}

export function emptyExperience(): CandidateExperience {
  return {
    title: "",
    company: "",
    start_date: "",
    end_date: "",
    location: "",
    description: "",
    is_current: false,
  };
}

export function emptyEducation(): CandidateEducation {
  return {
    school: "",
    degree: "",
    start_date: "",
    end_date: "",
    location: "",
  };
}

export function parseSkillsInput(input: string): string[] {
  return input
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function skillsToInput(skills: string[]): string {
  return skills.join(", ");
}
