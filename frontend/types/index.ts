export type UserRole = "admin" | "manager" | "recruiter";
export type UserStatus = "active" | "inactive";
export type ClientStatus = "active" | "inactive";
export type ClientStage = "prospect" | "lead" | "active" | "on_hold" | "customer" | "inactive";
export type JobType = "full-time" | "part-time" | "contract";
export type JobStatus = "active" | "pending" | "on-hold" | "closed" | "filled";
export type PipelineStage =
  | "applied"
  | "cv_reviewed"
  | "shortlisted"
  | "phone_screening"
  | "interview_scheduled"
  | "interview_completed"
  | "client_review"
  | "offer_sent"
  | "hired"
  | "rejected";
export type InterviewType = "phone" | "online" | "in-person";
export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";
export type EntityType = "candidate" | "job" | "client";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  assigned_jobs_count?: number;
  assigned_jobs?: { id: number; title: string; status: string; created_at: string }[];
}

export interface TeamMemberStats {
  candidates_created: number;
  candidates_owned: number;
  resumes_added: number;
  added_to_job: number;
  shortlisted: number;
  interviewed: number;
  interviews_scheduled: number;
  offers: number;
  hired: number;
  jobs: {
    total: number;
    active: number;
    pending: number;
    on_hold: number;
    closed: number;
    filled: number;
  };
  clients_count: number;
}

export interface TeamPipelineCard {
  assignment_id: number;
  candidate_id: number;
  name: string;
  current_job_title?: string;
  current_company?: string;
  job_id?: number;
  job_title?: string;
  status: string;
  created_at?: string;
}

export interface TeamMemberOverview {
  user: User;
  stats: TeamMemberStats;
  pipeline: Record<string, TeamPipelineCard[]>;
  clients: { id: number; company_name: string; jobs_count: number; active_jobs: number }[];
  jobs: { id: number; title: string; status: string; client_name?: string; candidate_count: number; created_at: string }[];
  history: { id: number; description: string; action: string; entity_type: string; created_at: string }[];
  filter?: { date_from?: string | null; date_to?: string | null };
}

export interface Client {
  id: number;
  company_name: string;
  contact_person: string;
  email: string;
  phone?: string;
  industry?: string;
  location?: string;
  address?: string;
  website?: string;
  description?: string;
  notes?: string;
  status: ClientStatus;
  stage: ClientStage;
  owner_id?: number;
  owner_name?: string;
  team_member_name?: string;
  job_count: number;
  created_at: string;
  updated_at: string;
  jobs?: JobSummary[];
  contacts?: ClientContact[];
  team?: ClientTeamMember[];
  guests?: ClientGuest[];
  attachments?: ClientAttachment[];
  activities?: ClientActivity[];
  tags?: string[];
  custom_tags?: { id: string; label: string; color: string; icon?: string }[];
  visibility?: string;
}

export interface ClientAttachment {
  id: number;
  client_id: number;
  filename: string;
  file_path: string;
  file_size?: number;
  uploaded_by: number;
  uploaded_by_name?: string;
  created_at: string;
}

export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
  created_at: string;
}

export interface ClientTeamMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  status: string;
}

export interface ClientGuest {
  id: number;
  client_id: number;
  name: string;
  email?: string;
  created_at: string;
}

export interface JobSummary {
  id: number;
  title: string;
  status: JobStatus;
  location?: string;
  candidate_count: number;
  created_at: string;
  salary_min?: number;
  salary_max?: number;
  number_of_positions?: number;
  assigned_recruiter_id?: number;
  assigned_recruiter_name?: string;
}

export interface Job {
  id: number;
  title: string;
  client_id: number;
  client_name?: string;
  location?: string;
  job_type: JobType;
  salary_min?: number;
  salary_max?: number;
  required_skills?: string;
  experience_required?: string;
  description?: string;
  number_of_positions: number;
  status: JobStatus;
  assigned_recruiter_id?: number;
  assigned_recruiter_name?: string;
  candidate_count: number;
  activities?: ScheduledActivity[];
  created_at: string;
  updated_at: string;
}

export interface CandidateExperience {
  title: string;
  company: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  description?: string;
  is_current?: boolean;
}

export interface CandidateEducation {
  school: string;
  degree?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
}

export interface CandidateSkillLevel {
  name: string;
  level: number;
}

export interface CandidateSocialLink {
  id: string;
  platform: "linkedin" | "github" | "twitter" | string;
  url: string;
  username?: string;
  verified?: boolean;
  enriched?: boolean;
  enriched_at?: string;
  source?: "resume" | "manual";
}

export interface CandidateProfileExtras {
  first_name?: string;
  last_name?: string;
  gender?: string;
  diploma?: string;
  university?: string;
  skype?: string;
  other_contact?: string;
  source?: string;
  nationality?: string;
  languages?: string;
  graduation_date?: string;
  current_department?: string;
  industry?: string;
  current_salary?: string;
  benefits?: string;
  gdpr_consent?: string;
  email_consent?: string;
  resume_added_at?: string;
  summary?: string;
  social_links?: CandidateSocialLink[];
  [key: string]: string | CandidateSocialLink[] | undefined;
}

export interface CandidateFolder {
  id: number;
  name: string;
  description?: string | null;
  is_favorite: boolean;
  candidate_count: number;
  created_by: number;
  owner_name?: string | null;
  shared_to_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type CandidateStatus = "new" | "reviewed" | "shortlisted" | "interviewing" | "hired" | "rejected";

export interface OutreachEnrollmentSummary {
  id: number;
  sequence_id: number;
  sequence_name: string;
  sequence_status: string;
  enrollment_status: string;
  current_step: number;
  total_steps: number;
  current_step_name?: string | null;
  next_send_at?: string | null;
  progress_percent: number;
}

export interface Candidate {
  id: number;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  current_job_title?: string;
  current_company?: string;
  experience_years?: number;
  skills?: string[];
  expected_salary?: number;
  notice_period?: string;
  linkedin_url?: string;
  cv_file_path?: string;
  notes?: string;
  headline?: string | null;
  summary?: string | null;
  profile_image_url?: string | null;
  source?: string | null;
  imported_via?: string | null;
  created_by: number;
  created_by_name?: string;
  jobs_applied_count: number;
  profile_extras?: CandidateProfileExtras;
  experiences?: CandidateExperience[];
  educations?: CandidateEducation[];
  skill_levels?: CandidateSkillLevel[];
  candidate_status?: CandidateStatus;
  candidate_rating?: number | null;
  assigned_job_id?: number | null;
  assigned_job_title?: string | null;
  assigned_job_client?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  timezone?: string | null;
  created_at: string;
  updated_at: string;
  assignments?: CandidateJobAssignment[];
  activities?: ScheduledActivity[];
}

export interface ParsedResume {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  location?: string;
  current_job_title?: string;
  current_company?: string;
  experience_years?: number;
  skills?: string[];
  skill_levels?: CandidateSkillLevel[];
  experiences?: CandidateExperience[];
  educations?: CandidateEducation[];
  linkedin_url?: string;
  social_links?: CandidateSocialLink[];
  profile_extras?: CandidateProfileExtras;
}

export interface CandidateJobAssignment {
  id: number;
  candidate_id: number;
  job_id: number;
  job_title?: string;
  client_name?: string;
  status: PipelineStage;
  assigned_recruiter_id: number;
  assigned_recruiter_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Interview {
  id: number;
  candidate_job_id: number;
  candidate_name?: string;
  job_title?: string;
  client_name?: string;
  interview_date: string;
  interview_time: string;
  interview_type: InterviewType;
  interviewer_name: string;
  meeting_link?: string;
  location?: string;
  status: InterviewStatus;
  notes?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  action: string;
  description: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
}

export interface Note {
  id: number;
  entity_type: EntityType;
  entity_id: number;
  content: string;
  is_private?: boolean;
  category_type?: string;
  category_ref_id?: number | null;
  shared_with_guest?: boolean;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledActivity {
  id: number;
  title: string;
  activity_type: string;
  activity_date: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  location?: string;
  description?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  share_with_guests: boolean;
  created_by: number;
  created_by_name?: string;
  created_at: string;
}

export interface ClientActivity extends ScheduledActivity {
  client_id: number;
}

export interface DashboardStats {
  total_clients: number;
  total_active_jobs: number;
  total_candidates: number;
  total_team_members: number;
  interviews_this_week: number;
  offers_extended: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface DashboardCharts {
  pipeline_stages: ChartDataPoint[];
  jobs_by_status: ChartDataPoint[];
  recruiter_performance: ChartDataPoint[];
}

export interface RecruiterDashboardStats {
  assigned_jobs: number;
  candidates_added: number;
  interviews_scheduled: number;
  hired_candidates: number;
}

export interface RecruiterJobProgress {
  id: number;
  title: string;
  client_name: string;
  status: string;
  total_candidates: number;
  hired_count: number;
  progress_percent: number;
}

export interface TopJobItem {
  id: number;
  title: string;
  client_name: string;
  candidate_count: number;
}

export interface PipelineCard {
  assignment_id: number;
  candidate_id: number;
  name: string;
  current_job_title?: string;
  current_company?: string;
  experience_years?: number;
  status: PipelineStage;
  created_at?: string;
}

export interface PipelineData {
  job_id: number;
  job_title: string;
  stages: Record<PipelineStage, PipelineCard[]>;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  "applied",
  "cv_reviewed",
  "shortlisted",
  "phone_screening",
  "interview_scheduled",
  "interview_completed",
  "client_review",
  "offer_sent",
  "hired",
  "rejected",
];

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  applied: "New Candidates",
  cv_reviewed: "Interested",
  shortlisted: "Shortlisted",
  phone_screening: "Client Submission",
  interview_scheduled: "Client Interview",
  interview_completed: "Interview Completed",
  client_review: "Client Review",
  offer_sent: "Offered",
  hired: "Hired",
  rejected: "Dropped",
};

/** Manatal-style divider after this stage index (0-based) */
export const PIPELINE_DIVIDER_AFTER_INDEX = 2;

/** Stages with green success top border */
export const PIPELINE_SUCCESS_STAGES: PipelineStage[] = ["hired"];

export interface MatchItem {
  candidate_id: number;
  candidate_name: string;
  candidate_title?: string;
  job_id: number;
  job_title: string;
  client_name?: string;
  match_score: number;
  matched_skills: string[];
}

export interface PlacementItem {
  assignment_id: number;
  candidate_id: number;
  candidate_name: string;
  job_id: number;
  job_title: string;
  client_name?: string;
  recruiter_name?: string;
  placed_at?: string;
}

export interface ContactGuestItem {
  id: number;
  client_id: number;
  client_name?: string;
  name: string;
  email?: string;
  phone?: string;
  title?: string;
}

export interface RecruitmentActivityItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  entity_type: string;
  entity_id: number;
  client_name?: string;
  date?: string;
  created_by_name?: string;
  assigned_to_name?: string;
  created_at?: string;
}

export interface InboxItem {
  id: number;
  content: string;
  entity_type: string;
  entity_id: number;
  entity_label: string;
  shared_with_guest: boolean;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export type GmailConnectionStatus = "connected" | "not_connected" | "needs_reconnect";

export interface GmailStatus {
  connected: boolean;
  status: GmailConnectionStatus;
  email_address?: string | null;
  last_connected_at?: string | null;
  last_error?: string | null;
  sent_today: number;
  daily_limit: number;
}

export type OutreachSequenceStatus = "draft" | "active" | "paused" | "completed";

export interface OutreachSequenceListItem {
  id: number;
  name: string;
  description?: string | null;
  status: OutreachSequenceStatus;
  sender_email?: string | null;
  created_by_user_id: number;
  created_by_name?: string | null;
  enrolled_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachSequenceStep {
  id: number;
  step_number: number;
  step_name: string;
  subject: string;
  body: string;
  delay_days: number;
}

export interface OutreachEnrollment {
  id: number;
  candidate_id: number;
  candidate_name?: string | null;
  candidate_email?: string | null;
  current_title?: string | null;
  company?: string | null;
  status: string;
  current_step: number;
  next_send_at?: string | null;
}

export interface OutreachSequenceDetail extends OutreachSequenceListItem {
  steps: OutreachSequenceStep[];
  enrollments: OutreachEnrollment[];
}

export interface OutreachEmailLog {
  id: number;
  candidate_id: number;
  sender_email: string;
  recipient_email: string;
  rendered_subject: string;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  created_at: string;
  step_id?: number | null;
}

export interface OutreachCandidateOption {
  id: number;
  name: string;
  email: string;
  current_job_title?: string;
  current_company?: string;
  location?: string;
}
