import { cleanText } from "./text";
import type {
  CandidateProfile,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  FieldConflict,
  LanguageItem,
  ParsedResumeData,
} from "../types";

function norm(value: string | null | undefined): string {
  return cleanText(value || "").toLowerCase();
}

function nonEmpty(value: string | null | undefined): string {
  return cleanText(value || "");
}

function valuesConflict(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left !== right);
}

function mergeExperiences(linkedin: ExperienceItem[], cv: ExperienceItem[]): ExperienceItem[] {
  const out = [...linkedin];
  const keys = new Set(
    linkedin.map((e) => `${norm(e.title)}|${norm(e.company)}|${norm(e.start_date)}|${norm(e.end_date)}`),
  );
  for (const item of cv) {
    const key = `${norm(item.title)}|${norm(item.company)}|${norm(item.start_date)}|${norm(item.end_date)}`;
    if (!item.title || !item.company) continue;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(item);
  }
  return out;
}

function mergeEducations(linkedin: EducationItem[], cv: EducationItem[]): EducationItem[] {
  const out = [...linkedin];
  const keys = new Set(
    linkedin.map((e) => `${norm(e.school)}|${norm(e.degree)}|${norm(e.start_date)}|${norm(e.end_date)}`),
  );
  for (const item of cv) {
    const key = `${norm(item.school)}|${norm(item.degree)}|${norm(item.start_date)}|${norm(item.end_date)}`;
    if (!item.school) continue;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(item);
  }
  return out;
}

function mergeSkills(linkedin: string[], cv: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of [...linkedin, ...cv]) {
    const text = cleanText(s);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function mergeCerts(linkedin: CertificationItem[], cv: CertificationItem[]): CertificationItem[] {
  const out = [...linkedin];
  const keys = new Set(linkedin.map((c) => `${norm(c.name)}|${norm(c.issuing_organization)}`));
  for (const item of cv) {
    if (!item.name) continue;
    const key = `${norm(item.name)}|${norm(item.issuing_organization)}`;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(item);
  }
  return out;
}

function mergeLanguages(linkedin: LanguageItem[], cv: LanguageItem[]): LanguageItem[] {
  const out = [...linkedin];
  const keys = new Set(linkedin.map((l) => norm(l.language)));
  for (const item of cv) {
    if (!item.language) continue;
    const key = norm(item.language);
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(item);
  }
  return out;
}

function certsFromExtras(extras: Record<string, unknown> | undefined): CertificationItem[] {
  const raw = extras?.certifications;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      if (!c || typeof c !== "object") return null;
      const row = c as Record<string, unknown>;
      const name = cleanText(String(row.name || ""));
      if (!name) return null;
      return {
        name,
        issuing_organization: cleanText(String(row.issuing_organization || row.organization || "")) || undefined,
        issue_date: cleanText(String(row.issue_date || "")) || undefined,
        expiry_date: cleanText(String(row.expiry_date || "")) || undefined,
        credential_id: cleanText(String(row.credential_id || "")) || undefined,
      } satisfies CertificationItem;
    })
    .filter(Boolean) as CertificationItem[];
}

function langsFromExtras(extras: Record<string, unknown> | undefined): LanguageItem[] {
  const raw = extras?.languages;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l) => {
      if (!l || typeof l !== "object") return null;
      const row = l as Record<string, unknown>;
      const language = cleanText(String(row.language || row.name || ""));
      if (!language) return null;
      return {
        language,
        proficiency: cleanText(String(row.proficiency || "")) || undefined,
      } satisfies LanguageItem;
    })
    .filter(Boolean) as LanguageItem[];
}

export interface MergeResult {
  profile: CandidateProfile;
  conflicts: FieldConflict[];
  /** Current title/company as resolved from LinkedIn vs CV before conflict UI. */
  linkedinTitle: string;
  linkedinCompany: string;
  cvTitle: string;
  cvCompany: string;
}

/**
 * Merge LinkedIn-extracted profile with parsed CV/PDF data.
 * Prefer LinkedIn for URL/image/headline/visible title/company/location when present;
 * prefer CV for email/phone and list completeness. Conflicts are listed for UI.
 */
export function mergeLinkedInAndCv(
  linkedin: CandidateProfile,
  parsed: ParsedResumeData,
): MergeResult {
  const liExp = linkedin.experiences || [];
  const currentLi = liExp.find((e) => e.is_current) || liExp[0];
  const linkedinTitle = nonEmpty(currentLi?.title) || nonEmpty(linkedin.headline);
  const linkedinCompany = nonEmpty(currentLi?.company);
  const cvTitle = nonEmpty(parsed.current_job_title);
  const cvCompany = nonEmpty(parsed.current_company);

  const conflicts: FieldConflict[] = [];
  const maybeConflict = (
    field: FieldConflict["field"],
    linkedinValue: string,
    cvValue: string,
  ) => {
    if (valuesConflict(linkedinValue, cvValue)) {
      conflicts.push({
        field,
        linkedinValue,
        cvValue,
        choice: "linkedin",
      });
    }
  };

  maybeConflict("fullName", linkedin.fullName, parsed.name || "");
  maybeConflict("currentJobTitle", linkedinTitle, cvTitle);
  maybeConflict("currentCompany", linkedinCompany, cvCompany);
  maybeConflict("location", linkedin.location, parsed.location || "");
  maybeConflict("email", linkedin.email, parsed.email || "");
  maybeConflict("phone", linkedin.phone, parsed.phone || "");
  // Summary: LinkedIn About vs nothing from parser usually — only if CV somehow has summary-like text we skip (parser has none).

  const fill = (li: string, cv: string) => li || cv || "";

  const profile: CandidateProfile = {
    ...linkedin,
    fullName: fill(linkedin.fullName, parsed.name || ""),
    location: fill(linkedin.location, parsed.location || ""),
    email: fill(linkedin.email, parsed.email || ""),
    phone: fill(linkedin.phone, parsed.phone || ""),
    // Keep LinkedIn headline/image/url/summary as preferred when present.
    headline: linkedin.headline,
    summary: linkedin.summary,
    linkedinUrl: linkedin.linkedinUrl || nonEmpty(parsed.linkedin_url) || "",
    profileImageUrl: linkedin.profileImageUrl,
    experiences: mergeExperiences(liExp, parsed.experiences || []),
    educations: mergeEducations(linkedin.educations || [], parsed.educations || []),
    skills: mergeSkills(linkedin.skills || [], parsed.skills || []),
    certifications: mergeCerts(
      linkedin.certifications || [],
      certsFromExtras(parsed.profile_extras),
    ),
    languages: mergeLanguages(
      linkedin.languages || [],
      langsFromExtras(parsed.profile_extras),
    ),
  };

  // If no conflict on title/company, fill missing from CV into first experience / headline context via profile fields only.
  if (!conflicts.some((c) => c.field === "currentJobTitle") && !linkedinTitle && cvTitle) {
    // leave as-is; validators/import use experiences[0] or headline
  }

  return { profile, conflicts, linkedinTitle, linkedinCompany, cvTitle, cvCompany };
}

/** Apply conflict choices onto a merged profile. */
export function applyConflictChoices(
  profile: CandidateProfile,
  conflicts: FieldConflict[],
  meta: { linkedinTitle: string; linkedinCompany: string; cvTitle: string; cvCompany: string },
): CandidateProfile {
  const next = { ...profile };
  for (const c of conflicts) {
    const value =
      c.choice === "manual"
        ? nonEmpty(c.manualValue)
        : c.choice === "cv"
          ? c.cvValue
          : c.linkedinValue;
    switch (c.field) {
      case "fullName":
        next.fullName = value || next.fullName;
        break;
      case "location":
        next.location = value;
        break;
      case "email":
        next.email = value;
        break;
      case "phone":
        next.phone = value;
        break;
      case "summary":
        next.summary = value;
        break;
      case "currentJobTitle": {
        const title =
          value ||
          (c.choice === "cv" ? meta.cvTitle : meta.linkedinTitle) ||
          next.headline;
        if (next.experiences?.[0]) {
          next.experiences = [
            { ...next.experiences[0], title: title || next.experiences[0].title },
            ...next.experiences.slice(1),
          ];
        } else if (title) {
          next.headline = next.headline || title;
        }
        break;
      }
      case "currentCompany": {
        const company = value || (c.choice === "cv" ? meta.cvCompany : meta.linkedinCompany);
        if (next.experiences?.[0] && company) {
          next.experiences = [
            { ...next.experiences[0], company },
            ...next.experiences.slice(1),
          ];
        }
        break;
      }
      default:
        break;
    }
  }
  return next;
}
