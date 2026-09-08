import { cleanText, cleanMultiline } from "./text";
import type {
  CandidateProfile,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  LanguageItem,
  SectionAvailability,
  SectionStatuses,
} from "../types";

/** Dev-only structured logging — never logs tokens/secrets. */
export function debugLog(label: string, data: unknown): void {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.info(`[RecruitPro] ${label}`, data);
    }
  } catch {
    /* ignore */
  }
}

function statusFor(count: number, sectionPresent: boolean): SectionAvailability {
  if (count > 0) return "detected";
  if (sectionPresent) return "partial";
  return "not_available";
}

/** Recompute sectionStatuses from actual array lengths after enrich/merge. */
export function recomputeSectionStatuses(
  profile: CandidateProfile,
  presence?: Partial<Record<keyof SectionStatuses, boolean>>,
): SectionStatuses {
  const prev = profile.sectionStatuses;
  const wasPresent = (s?: SectionAvailability) => s === "partial" || s === "detected";
  return {
    experience: statusFor(profile.experiences?.length ?? 0, presence?.experience ?? wasPresent(prev?.experience)),
    education: statusFor(profile.educations?.length ?? 0, presence?.education ?? wasPresent(prev?.education)),
    skills: statusFor(profile.skills?.length ?? 0, presence?.skills ?? wasPresent(prev?.skills)),
    certifications: statusFor(
      profile.certifications?.length ?? 0,
      presence?.certifications ?? wasPresent(prev?.certifications),
    ),
    languages: statusFor(profile.languages?.length ?? 0, presence?.languages ?? wasPresent(prev?.languages)),
    about: profile.summary
      ? "detected"
      : statusFor(0, presence?.about ?? wasPresent(prev?.about)),
  };
}

export function sanitizeExperience(raw: ExperienceItem): ExperienceItem | null {
  const title = cleanText(raw.title);
  const company = cleanText(raw.company);
  if (!title || !company) return null;
  if (/^(experience|about|education|skills)$/i.test(title)) return null;
  return {
    title,
    company,
    employment_type: cleanText(raw.employment_type) || undefined,
    start_date: cleanText(raw.start_date) || undefined,
    end_date: cleanText(raw.end_date) || undefined,
    is_current: raw.is_current === true ? true : raw.is_current === false ? false : undefined,
    duration: cleanText(raw.duration) || undefined,
    location: cleanText(raw.location) || undefined,
    description: cleanMultiline(raw.description) || undefined,
    company_url: cleanText((raw as ExperienceItem & { company_url?: string }).company_url) || undefined,
  };
}

export function sanitizeEducation(raw: EducationItem): EducationItem | null {
  const school = cleanText(raw.school);
  if (!school || /^education$/i.test(school)) return null;
  return {
    school,
    degree: cleanText(raw.degree) || undefined,
    field_of_study: cleanText(raw.field_of_study) || undefined,
    start_date: cleanText(raw.start_date) || undefined,
    end_date: cleanText(raw.end_date) || undefined,
    location: cleanText(raw.location) || undefined,
    description: cleanMultiline(raw.description) || undefined,
  };
}

export function sanitizeCertification(raw: CertificationItem): CertificationItem | null {
  const name = cleanText(raw.name);
  if (!name) return null;
  return {
    name,
    issuing_organization: cleanText(raw.issuing_organization) || undefined,
    issue_date: cleanText(raw.issue_date) || undefined,
    expiry_date: cleanText(raw.expiry_date) || undefined,
    credential_id: cleanText(raw.credential_id) || undefined,
  };
}

export function sanitizeLanguage(raw: LanguageItem | { name?: string; language?: string; proficiency?: string }): LanguageItem | null {
  const language = cleanText(
    (raw as LanguageItem).language || (raw as { name?: string }).name || "",
  );
  if (!language || /^languages?$/i.test(language)) return null;
  return {
    language,
    proficiency: cleanText((raw as LanguageItem).proficiency) || undefined,
  };
}

/**
 * Canonicalize a profile so popup / API always see arrays and clean nested rows.
 * Accepts common alias keys if a buggy path ever used them.
 */
export function normalizeCandidateProfile(input: CandidateProfile | Record<string, unknown>): CandidateProfile {
  const any = input as Record<string, unknown>;
  const experiencesRaw = (any.experiences ?? any.experience ?? any.workExperience ?? []) as ExperienceItem[];
  const educationsRaw = (any.educations ?? any.education ?? []) as EducationItem[];
  const skillsRaw = (any.skills ?? []) as string[];
  const certificationsRaw = (any.certifications ?? []) as CertificationItem[];
  const languagesRaw = (any.languages ?? []) as LanguageItem[];

  const experiences: ExperienceItem[] = [];
  const seenExp = new Set<string>();
  for (const row of Array.isArray(experiencesRaw) ? experiencesRaw : []) {
    const s = sanitizeExperience(row);
    if (!s) continue;
    const key = `${s.title}|${s.company}|${s.start_date || ""}`.toLowerCase();
    if (seenExp.has(key)) continue;
    seenExp.add(key);
    experiences.push(s);
  }

  const educations: EducationItem[] = [];
  const seenEdu = new Set<string>();
  for (const row of Array.isArray(educationsRaw) ? educationsRaw : []) {
    const s = sanitizeEducation(row);
    if (!s) continue;
    const key = `${s.school}|${s.degree || ""}`.toLowerCase();
    if (seenEdu.has(key)) continue;
    seenEdu.add(key);
    educations.push(s);
  }

  const skills: string[] = [];
  const seenSkill = new Set<string>();
  for (const s of Array.isArray(skillsRaw) ? skillsRaw : []) {
    const text = cleanText(typeof s === "string" ? s : String(s ?? ""));
    if (!text || text.length > 80) continue;
    const key = text.toLowerCase();
    if (seenSkill.has(key)) continue;
    seenSkill.add(key);
    skills.push(text);
  }

  const certifications: CertificationItem[] = [];
  const seenCert = new Set<string>();
  for (const row of Array.isArray(certificationsRaw) ? certificationsRaw : []) {
    const s = sanitizeCertification(row);
    if (!s) continue;
    const key = `${s.name}|${s.issuing_organization || ""}`.toLowerCase();
    if (seenCert.has(key)) continue;
    seenCert.add(key);
    certifications.push(s);
  }

  const languages: LanguageItem[] = [];
  const seenLang = new Set<string>();
  for (const row of Array.isArray(languagesRaw) ? languagesRaw : []) {
    const s = sanitizeLanguage(row);
    if (!s) continue;
    const key = s.language.toLowerCase();
    if (seenLang.has(key)) continue;
    seenLang.add(key);
    languages.push(s);
  }

  const base: CandidateProfile = {
    fullName: cleanText(String(any.fullName ?? "")),
    headline: cleanText(String(any.headline ?? "")),
    location: cleanText(String(any.location ?? "")),
    summary: cleanMultiline(String(any.summary ?? "")),
    linkedinUrl: cleanText(String(any.linkedinUrl ?? "")),
    profileImageUrl: cleanText(String(any.profileImageUrl ?? "")),
    email: cleanText(String(any.email ?? "")),
    phone: cleanText(String(any.phone ?? "")),
    experiences,
    educations,
    skills,
    certifications,
    languages,
    sectionStatuses: (any.sectionStatuses as SectionStatuses) || undefined,
  };
  base.sectionStatuses = recomputeSectionStatuses(base);
  return base;
}

export function cloneProfile(profile: CandidateProfile): CandidateProfile {
  return normalizeCandidateProfile(JSON.parse(JSON.stringify(profile)) as CandidateProfile);
}
