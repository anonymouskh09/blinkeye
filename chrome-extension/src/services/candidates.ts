import { apiRequest, apiUpload } from "./api";
import type { DuplicateInfo, ImportPayload, ParsedResumeData } from "../types";

// Backend request bodies use snake_case; map from the camelCase payload here.

function toRequestBody(payload: ImportPayload) {
  return {
    full_name: payload.fullName,
    headline: payload.headline,
    location: payload.location,
    summary: payload.summary,
    linkedin_url: payload.linkedinUrl,
    profile_image_url: payload.profileImageUrl,
    email: payload.email,
    phone: payload.phone,
    source: payload.source,
    imported_via: payload.importedVia || "chrome_extension",
    job_id: payload.jobId,
    owner_id: payload.ownerId,
    stage: payload.stage,
    tags: payload.tags,
    experiences: payload.experiences,
    educations: payload.educations,
    skills: payload.skills,
    certifications: payload.certifications,
    languages: payload.languages,
    current_job_title: payload.currentJobTitle,
    current_company: payload.currentCompany,
  };
}

export interface CheckDuplicateResult {
  duplicate: boolean;
  existing: DuplicateInfo | null;
}

export async function checkDuplicate(linkedinUrl: string, email?: string): Promise<CheckDuplicateResult> {
  const params = new URLSearchParams({ linkedin_url: linkedinUrl });
  if (email) params.set("email", email);
  return apiRequest<CheckDuplicateResult>(`/candidates/check-duplicate?${params.toString()}`);
}

export interface ImportResult {
  id: number;
  name: string;
  detailUrl: string;
}

export async function importCandidate(payload: ImportPayload): Promise<ImportResult> {
  return apiRequest<ImportResult>("/candidates", {
    method: "POST",
    body: toRequestBody(payload),
  });
}

export async function parseResumeFile(file: File): Promise<ParsedResumeData> {
  const form = new FormData();
  form.append("cv_file", file, file.name);
  return apiUpload<ParsedResumeData>("/resumes/parse", form);
}

export interface AttachFileResult {
  id: number;
  cvFilePath: string | null;
  parsed: boolean;
  parseError: string | null;
  detailUrl: string;
}

export async function attachFileToCandidate(
  candidateId: number,
  file: File,
  opts: { applyParsed?: boolean; fileKind?: "cv" | "linkedin_pdf" } = {},
): Promise<AttachFileResult> {
  const params = new URLSearchParams();
  params.set("apply_parsed", opts.applyParsed === false ? "false" : "true");
  if (opts.fileKind === "linkedin_pdf") params.set("file_kind", "linkedin_profile_pdf");
  else params.set("file_kind", "cv");
  const form = new FormData();
  form.append("cv_file", file, file.name);
  return apiUpload<AttachFileResult>(`/candidates/${candidateId}/attach-file?${params}`, form);
}

export interface UpdateMissingResult {
  id: number;
  updatedFields: string[];
  detailUrl: string;
}

export async function updateMissingFields(
  candidateId: number,
  body: Record<string, unknown>,
): Promise<UpdateMissingResult> {
  return apiRequest<UpdateMissingResult>(`/candidates/${candidateId}/update-missing-fields`, {
    method: "PATCH",
    body,
  });
}
