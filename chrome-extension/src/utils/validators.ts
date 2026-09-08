import { normalizeLinkedInUrl } from "./normalizeUrl";
import { cleanText } from "./text";
import { debugLog, normalizeCandidateProfile } from "./normalizeProfile";
import type { CandidateProfile, ImportPayload } from "../types";

// Lightweight, Unicode-aware email check. We keep this permissive on purpose
// — the backend performs authoritative validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof CandidateProfile, string>>;
}

export function validateProfile(profile: CandidateProfile): ValidationResult {
  const errors: ValidationResult["errors"] = {};

  if (!cleanText(profile.fullName)) {
    errors.fullName = "Full name is required.";
  }
  if (profile.email && !isValidEmail(profile.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (profile.linkedinUrl && !normalizeLinkedInUrl(profile.linkedinUrl)) {
    errors.linkedinUrl = "Enter a valid LinkedIn profile URL.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** Builds the sanitized payload sent to the backend from a preview profile. */
export function toImportPayload(
  profile: CandidateProfile,
  extras: {
    jobId?: number | null;
    ownerId?: number | null;
    stage?: string | null;
    tags?: string[];
    importedVia?: ImportPayload["importedVia"];
    currentJobTitle?: string;
    currentCompany?: string;
  },
): ImportPayload {
  const normalized = normalizeCandidateProfile(profile);
  const normalizedUrl = normalizeLinkedInUrl(normalized.linkedinUrl);
  const experiences = normalized.experiences;
  const educations = normalized.educations;
  const skills = normalized.skills;
  const certifications = normalized.certifications;
  const languages = normalized.languages;
  const current = experiences.find((e) => e.is_current) || experiences[0];

  const payload: ImportPayload = {
    fullName: cleanText(normalized.fullName),
    headline: cleanText(normalized.headline) || undefined,
    location: cleanText(normalized.location) || undefined,
    summary: normalized.summary ? normalized.summary.trim() : undefined,
    linkedinUrl: normalizedUrl ?? "",
    profileImageUrl: normalized.profileImageUrl?.trim() || undefined,
    email: normalized.email ? cleanText(normalized.email).toLowerCase() : undefined,
    phone: cleanText(normalized.phone) || undefined,
    // PRD: candidate source recorded as Chrome Extension
    source: "Chrome Extension",
    importedVia: extras.importedVia || "chrome_extension",
    jobId: extras.jobId ?? null,
    ownerId: extras.ownerId ?? null,
    stage: extras.stage ?? null,
    tags: extras.tags && extras.tags.length ? extras.tags : undefined,
    experiences: experiences.length ? experiences : undefined,
    educations: educations.length ? educations : undefined,
    skills: skills.length ? skills : undefined,
    certifications: certifications.length ? certifications : undefined,
    languages: languages.length ? languages : undefined,
    currentJobTitle:
      cleanText(extras.currentJobTitle) ||
      (current?.title ? cleanText(current.title) : cleanText(normalized.headline)) ||
      undefined,
    currentCompany:
      cleanText(extras.currentCompany) ||
      (current?.company ? cleanText(current.company) : undefined),
  };

  debugLog("import payload", {
    fullName: payload.fullName,
    source: payload.source,
    importedVia: payload.importedVia,
    experiences: payload.experiences?.length ?? 0,
    educations: payload.educations?.length ?? 0,
    skills: payload.skills?.length ?? 0,
    certifications: payload.certifications?.length ?? 0,
    languages: payload.languages?.length ?? 0,
    jobId: payload.jobId,
    stage: payload.stage,
  });

  try {
    // Always log final experience JSON sent to backend (no tokens/secrets)
    // eslint-disable-next-line no-console
    console.info("[RecruitPro] final experiences for API", {
      count: payload.experiences?.length ?? 0,
      experiences: payload.experiences ?? [],
    });
  } catch {
    /* ignore */
  }

  return payload;
}
