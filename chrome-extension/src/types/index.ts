// Shared types used across the popup, content script and service worker.

export type PopupState =
  | "loading"
  | "not-connected"
  | "unsupported"
  | "extracting"
  | "preview"
  | "duplicate"
  | "saving"
  | "success"
  | "error"
  | "session-expired";

/** detected = section present with items; partial = present but sparse; not_available = missing. */
export type SectionAvailability = "detected" | "partial" | "not_available";

export interface ExperienceItem {
  title: string;
  company: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  duration?: string;
  location?: string;
  description?: string;
}

export interface EducationItem {
  school: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  description?: string;
}

export interface CertificationItem {
  name: string;
  issuing_organization?: string;
  issue_date?: string;
  expiry_date?: string;
  credential_id?: string;
}

export interface LanguageItem {
  language: string;
  proficiency?: string;
}

export interface SectionStatuses {
  experience: SectionAvailability;
  education: SectionAvailability;
  skills: SectionAvailability;
  certifications: SectionAvailability;
  languages: SectionAvailability;
  about: SectionAvailability;
}

export interface CandidateProfile {
  fullName: string;
  headline: string;
  location: string;
  summary: string;
  linkedinUrl: string;
  profileImageUrl: string;
  email: string;
  phone: string;
  experiences: ExperienceItem[];
  educations: EducationItem[];
  skills: string[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  sectionStatuses?: SectionStatuses;
}

export interface ExtractionResult {
  profile: CandidateProfile;
  /** Fields the extractor could not confidently resolve. */
  missingFields: (keyof CandidateProfile)[];
  extractedAt: string;
}

/** Standard backend response envelope: { success, data, message }. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch millis when the access token expires. */
  expiresAt: number;
  user: ExtensionUser;
}

export interface ExtensionUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "manager" | "recruiter";
}

export interface JobOption {
  id: number;
  title: string;
  clientName: string | null;
}

export interface TeamMemberOption {
  id: number;
  name: string;
  role: string;
}

export interface StageOption {
  id: string;
  name: string;
  order: number;
}

export interface TagOption {
  id: string;
  name: string;
}

export interface DropdownData {
  jobs: JobOption[];
  team: TeamMemberOption[];
  stages: StageOption[];
  tags: TagOption[];
  fetchedAt: number;
}

export interface DuplicateInfo {
  id: number;
  name: string;
  email: string | null;
  linkedinUrl: string | null;
  createdAt: string | null;
}

export type ImportedVia = "chrome_extension" | "chrome_extension_cv" | "linkedin_profile_pdf";

/** Payload sent to POST /api/v1/extension/candidates. */
export interface ImportPayload {
  fullName: string;
  headline?: string;
  location?: string;
  summary?: string;
  linkedinUrl: string;
  profileImageUrl?: string;
  email?: string;
  phone?: string;
  source: string;
  importedVia?: ImportedVia;
  jobId?: number | null;
  ownerId?: number | null;
  stage?: string | null;
  tags?: string[];
  experiences?: ExperienceItem[];
  educations?: EducationItem[];
  skills?: string[];
  certifications?: CertificationItem[];
  languages?: LanguageItem[];
  currentJobTitle?: string;
  currentCompany?: string;
}

/** Parsed resume shape returned by POST /api/v1/extension/resumes/parse. */
export interface ParsedResumeData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  current_job_title?: string | null;
  current_company?: string | null;
  skills?: string[];
  experiences?: ExperienceItem[];
  educations?: EducationItem[];
  linkedin_url?: string | null;
  profile_extras?: Record<string, unknown>;
}

export type ConflictField =
  | "fullName"
  | "currentJobTitle"
  | "currentCompany"
  | "location"
  | "email"
  | "phone"
  | "summary";

export type ConflictChoice = "linkedin" | "cv" | "manual";

export interface FieldConflict {
  field: ConflictField;
  linkedinValue: string;
  cvValue: string;
  choice: ConflictChoice;
  manualValue?: string;
}

// ---- Message passing contracts (content <-> popup/background) ----

export type RuntimeMessage =
  | { type: "PING_CONTENT" }
  | { type: "EXTRACT_PROFILE" }
  | { type: "GET_PAGE_STATUS" };

export type RuntimeResponse =
  | { ok: true; type: "PAGE_STATUS"; supported: boolean; url: string }
  | { ok: true; type: "EXTRACTION"; result: ExtractionResult }
  | { ok: false; error: string };
