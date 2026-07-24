import { normalizeLinkedInUrl } from "./normalizeUrl";
import { cleanText } from "./text";
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
  const normalizedUrl = normalizeLinkedInUrl(profile.linkedinUrl);
  const experiences = profile.experiences || [];
  const educations = profile.educations || [];
  const skills = (profile.skills || []).map((s) => cleanText(s)).filter(Boolean);
  const certifications = profile.certifications || [];
  const languages = profile.languages || [];
  const current = experiences.find((e) => e.is_current) || experiences[0];

  return {
    fullName: cleanText(profile.fullName),
    headline: cleanText(profile.headline) || undefined,
    location: cleanText(profile.location) || undefined,
    summary: profile.summary ? profile.summary.trim() : undefined,
    linkedinUrl: normalizedUrl ?? "",
    profileImageUrl: profile.profileImageUrl?.trim() || undefined,
    email: profile.email ? cleanText(profile.email).toLowerCase() : undefined,
    phone: cleanText(profile.phone) || undefined,
    source: "linkedin_extension",
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
      (current?.title ? cleanText(current.title) : cleanText(profile.headline)) ||
      undefined,
    currentCompany:
      cleanText(extras.currentCompany) ||
      (current?.company ? cleanText(current.company) : undefined),
  };
}
