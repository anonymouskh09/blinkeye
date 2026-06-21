"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import {
  FileText, Mail, Share2, Briefcase, Sparkles, Activity, StickyNote,
  Paperclip, History, Plus,
} from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import EntityActivitiesTab from "@/components/activities/EntityActivitiesTab";
import CandidateDetailHeader from "@/components/candidates/CandidateDetailHeader";
import CandidateSummaryTab from "@/components/candidates/CandidateSummaryTab";
import CandidateNotesTab from "@/components/candidates/CandidateNotesTab";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { CardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { syncCompanyToExperiences } from "@/lib/candidateProfileSync";
import { getCandidateSocialLinks } from "@/lib/socialLinks";
import { RESUME_PROCESS_STEPS, runWithProcessingSteps } from "@/lib/resumeProcessing";
import { cn } from "@/lib/utils";
import type { ApiResponse, Candidate, ActivityLog, Note, Job, PaginatedData, User, ScheduledActivity } from "@/types";

const CandidateResumeTab = dynamic(() => import("@/components/candidates/CandidateResumeTab"), {
  ssr: false,
  loading: () => <CardSkeleton />,
});

const CandidateSocialTab = dynamic(() => import("@/components/candidates/CandidateSocialTab"), {
  ssr: false,
  loading: () => <CardSkeleton />,
});

const CandidateInboxTab = dynamic(() => import("@/components/candidates/CandidateInboxTab"), {
  ssr: false,
  loading: () => <CardSkeleton />,
});

type Tab = "summary" | "resume" | "inbox" | "social" | "jobs" | "recommendation" | "activities" | "notes" | "attachments" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType; countKey?: string }[] = [
  { id: "summary", label: "Summary", icon: FileText },
  { id: "resume", label: "Resume", icon: FileText, countKey: "resume" },
  { id: "inbox", label: "Inbox", icon: Mail, countKey: "inbox" },
  { id: "social", label: "Social", icon: Share2, countKey: "social" },
  { id: "jobs", label: "Jobs", icon: Briefcase, countKey: "jobs" },
  { id: "recommendation", label: "Recommendation", icon: Sparkles },
  { id: "activities", label: "Activities", icon: Activity, countKey: "activities" },
  { id: "notes", label: "Notes", icon: StickyNote, countKey: "notes" },
  { id: "attachments", label: "Attachments", icon: Paperclip },
  { id: "history", label: "History", icon: History },
];

export default function CandidateDetailContent() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("summary");
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState("");
  const [uploading, setUploading] = useState(false);
  const [resumeVersion, setResumeVersion] = useState(0);
  const [processStep, setProcessStep] = useState(0);
  const [processingResume, setProcessingResume] = useState(false);
  const [inboxSteps, setInboxSteps] = useState(0);

  useEffect(() => {
    const t = searchParams.get("tab") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [searchParams]);

  const fetchAll = useCallback(async () => {
    const [c, a, n] = await Promise.all([
      api.get<ApiResponse<Candidate>>(`/candidates/${id}`),
      api.get<ApiResponse<{ items: ActivityLog[] }>>("/activity", { params: { entity_type: "candidate", entity_id: id } }),
      api.get<ApiResponse<{ items: Note[] }>>("/notes", { params: { entity_type: "candidate", entity_id: id } }),
    ]);
    setCandidate(c.data.data);
    setScheduledActivities(c.data.data.activities || []);
    setActivity(a.data.data.items);
    setNotes(n.data.data.items);
  }, [id]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    api.get<ApiResponse<PaginatedData<Job>>>("/jobs", { params: { page_size: 100 } })
      .then((r) => setJobs(r.data.data.items));
    api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, status: "active" } })
      .then((r) => setUsers(r.data.data.items))
      .catch(() => setUsers([]));
    api.get<ApiResponse<{ steps: { id: number }[] }>>(`/outreach/candidates/${id}/inbox`)
      .then((r) => setInboxSteps(r.data.data.steps?.length || 0))
      .catch(() => setInboxSteps(0));
  }, [fetchAll]);

  const switchTab = (t: Tab) => {
    setTab(t);
    router.replace(`/candidates/${id}?tab=${t}`, { scroll: false });
  };

  const handleResumeUpload = async (file: File) => {
    setProcessingResume(true);
    setProcessStep(0);
    setUploading(true);
    try {
      await runWithProcessingSteps(
        RESUME_PROCESS_STEPS,
        (i) => setProcessStep(i),
        async () => {
          const formData = new FormData();
          formData.append("cv_file", file);
          await api.put(`/candidates/${id}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
        },
      );
      toast.success("Resume uploaded — profile & social links updated");
      await fetchAll();
      setResumeVersion((v) => v + 1);
      switchTab("resume");
    } catch {
      toast.error("Failed to upload resume");
    } finally {
      setUploading(false);
      setProcessingResume(false);
    }
  };

  const handleAssignJob = async () => {
    await api.post(`/candidates/${id}/assign-job`, { job_id: Number(selectedJob) });
    toast.success("Assigned to job");
    setAssignOpen(false);
    fetchAll();
  };

  const getCount = (key?: string) => {
    if (!candidate || !key) return 0;
    if (key === "resume") return candidate.cv_file_path ? 1 : 0;
    if (key === "social") return getCandidateSocialLinks(candidate).length;
    if (key === "jobs") return candidate.assignments?.length || 0;
    if (key === "notes") return notes.length;
    if (key === "activities") return scheduledActivities.length;
    if (key === "inbox") return inboxSteps;
    return 0;
  };

  if (loading) return <PageWrapper><CardSkeleton /></PageWrapper>;
  if (!candidate) return <PageWrapper><p className="p-6">Candidate not found</p></PageWrapper>;

  return (
    <PageWrapper>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); e.target.value = ""; }} />

      <div className="content-panel overflow-hidden">
        <CandidateDetailHeader
          candidate={candidate}
          onViewCv={() => {
            if (candidate.cv_file_path) {
              window.open(`/api/candidates/${candidate.id}/cv?v=${resumeVersion}`, "_blank");
            } else {
              switchTab("resume");
            }
          }}
          onAddContact={() => fileRef.current?.click()}
          onSaveLocation={async (location) => {
            await api.patch(`/candidates/${candidate.id}/profile`, { location: location || null });
            toast.success("Location updated");
            await fetchAll();
          }}
          onSaveCompany={async (company) => {
            await api.patch(`/candidates/${candidate.id}/profile`, {
              current_company: company || null,
              experiences: syncCompanyToExperiences(candidate.experiences || [], company),
            });
            toast.success("Company updated");
            await fetchAll();
          }}
          onSaveEmail={async (email) => {
            await api.patch(`/candidates/${candidate.id}/profile`, { email });
            toast.success("Email updated");
            await fetchAll();
          }}
        />

        <div className="sub-tabs px-2">
          {TABS.map(({ id: tabId, label, icon: Icon, countKey }) => {
            const count = getCount(countKey);
            const active = tab === tabId;
            return (
              <button key={tabId} onClick={() => switchTab(tabId)}
                className={cn("sub-tab", active ? "sub-tab-active" : "sub-tab-inactive")}>
                <Icon className="h-4 w-4" />{label}
                {countKey && count > 0 && (
                  <span className="ml-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{count}</span>
                )}              </button>
            );
          })}
        </div>

        <div className="p-6 bg-surface-muted/50 min-h-[400px]">
          {tab === "summary" && (
            <CandidateSummaryTab
              candidate={candidate}
              notes={notes}
              history={activity}
              jobs={jobs}
              onUpdate={fetchAll}
              onAddNote={() => switchTab("notes")}
            />
          )}

          {tab === "resume" && (
            <CandidateResumeTab
              candidateId={candidate.id}
              cvFilePath={candidate.cv_file_path}
              uploading={uploading}
              processing={processingResume}
              processStep={processStep}
              version={resumeVersion}
              onUpload={handleResumeUpload}
            />
          )}

          {tab === "jobs" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-3xl">
              <Button size="sm" className="mb-4" onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4 mr-1" /> Assign Job</Button>
              {(candidate.assignments || []).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div><p className="font-medium text-sm text-primary">{a.job_title}</p><p className="text-xs text-gray-500">{a.client_name}</p></div>
                  <span className="text-xs bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-lg font-medium uppercase">{a.status.replace("_", " ")}</span>
                </div>
              ))}
              {!candidate.assignments?.length && <p className="text-sm text-gray-400">Not assigned to any jobs</p>}
            </div>
          )}

          {tab === "notes" && (
            <CandidateNotesTab
              candidateId={String(id)}
              candidateName={candidate.name}
              notes={notes}
              onRefresh={fetchAll}
            />
          )}

          {tab === "activities" && (
            <EntityActivitiesTab
              entityType="candidate"
              entityId={String(id)}
              relatedLabel={candidate.name}
              activities={scheduledActivities}
              users={users}
              onRefresh={fetchAll}
            />
          )}

          {tab === "history" && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden max-w-3xl">
              <div className="px-5 py-3 bg-gray-50 border-b text-sm text-gray-600">{activity.length} actions taken</div>
              {activity.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
                  <UserAvatar name={a.created_by_name || "U"} size="md" />
                  <div className="flex-1"><p className="text-sm text-gray-800">{a.description}</p></div>
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                </div>
              ))}
              {!activity.length && <p className="px-5 py-12 text-sm text-gray-400 text-center">No activity yet</p>}
            </div>
          )}

          {tab === "social" && (
            <CandidateSocialTab candidate={candidate} onUpdate={fetchAll} />
          )}

          {tab === "inbox" && (
            <CandidateInboxTab candidate={candidate} candidateId={String(id)} />
          )}

          {(tab === "recommendation" || tab === "attachments") && (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center max-w-lg mx-auto">
              <h3 className="text-lg font-semibold text-gray-700 capitalize">{tab}</h3>
              <p className="text-sm text-gray-500 mt-2">This section will be available soon.</p>
            </div>
          )}
        </div>
      </div>

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign to Job">
        <Select label="Job" placeholder="Select job"
          options={jobs.map((j) => ({ value: String(j.id), label: `${j.title} (${j.client_name})` }))}
          value={selectedJob} onChange={(e) => setSelectedJob(e.target.value)} />
        <div className="flex gap-3 mt-4">
          <Button onClick={handleAssignJob}>Assign</Button>
          <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
