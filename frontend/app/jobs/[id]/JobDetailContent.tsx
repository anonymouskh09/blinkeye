"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Users, FileText, Activity, StickyNote, Paperclip, Sparkles, Search, BarChart3,
  Briefcase, History, Upload,
} from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import EntityActivitiesTab from "@/components/activities/EntityActivitiesTab";
import JobDetailHeader from "@/components/jobs/JobDetailHeader";
import JobSummaryTab from "@/components/jobs/JobSummaryTab";
import JobCandidatesTab from "@/components/jobs/JobCandidatesTab";
import JobNotesTab from "@/components/jobs/JobNotesTab";
import { UserAvatar } from "@/components/clients/ClientAvatar";
import { CardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, Job, ActivityLog, Note, User, PaginatedData, PipelineData, ScheduledActivity } from "@/types";

type Tab = "candidates" | "summary" | "team" | "ai" | "activities" | "notes" | "attachments" | "sourcing" | "reports" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType; countKey?: string }[] = [
  { id: "candidates", label: "Candidates", icon: Briefcase, countKey: "candidates" },
  { id: "summary", label: "Summary", icon: FileText },
  { id: "team", label: "Team", icon: Users, countKey: "team" },
  { id: "ai", label: "AI Recommendations", icon: Sparkles },
  { id: "activities", label: "Activities", icon: Activity, countKey: "activities" },
  { id: "notes", label: "Notes", icon: StickyNote, countKey: "notes" },
  { id: "attachments", label: "Attachments", icon: Paperclip, countKey: "attachments" },
  { id: "sourcing", label: "Sourcing", icon: Search },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
];

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center max-w-lg mx-auto shadow-sm">
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

export default function JobDetailPageContent() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = String(id);

  const [job, setJob] = useState<Job | null>(null);
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivity[]>([]);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [history, setHistory] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("candidates");

  useEffect(() => {
    const t = searchParams.get("tab") as Tab | null;
    if (t && TABS.some((x) => x.id === t)) setTab(t);
  }, [searchParams]);

  const fetchJob = useCallback(async () => {
    const r = await api.get<ApiResponse<Job>>(`/jobs/${id}`);
    setJob(r.data.data);
    setScheduledActivities(r.data.data.activities || []);
  }, [id]);

  const fetchPipeline = useCallback(async () => {
    const r = await api.get<ApiResponse<PipelineData>>(`/jobs/${id}/pipeline`);
    setPipeline(r.data.data);
  }, [id]);

  const fetchNotes = useCallback(async () => {
    const r = await api.get<ApiResponse<{ items: Note[] }>>("/notes", {
      params: { entity_type: "job", entity_id: id },
    });
    setNotes(r.data.data.items);
  }, [id]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchJob(), fetchPipeline(), fetchNotes()]);
  }, [fetchJob, fetchPipeline, fetchNotes]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchJob().catch(() => { toast.error("Failed to load job"); setJob(null); }),
      fetchPipeline().catch(() => setPipeline(null)),
      fetchNotes().catch(() => setNotes([])),
      api.get<ApiResponse<{ items: ActivityLog[] }>>("/activity", { params: { entity_type: "job", entity_id: id } })
        .catch(() => ({ data: { data: { items: [] } } })),
      api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, status: "active" } })
        .catch(() => ({ data: { data: { items: [] } } })),
    ]).then(([, , , h, u]) => {
      setHistory(h.data.data.items);
      setUsers(u.data.data.items);
    }).finally(() => setLoading(false));
  }, [id, fetchJob, fetchPipeline, fetchNotes]);

  const switchTab = (t: Tab) => {
    setTab(t);
    router.replace(`/jobs/${id}?tab=${t}`, { scroll: false });
  };

  const handleArchive = async () => {
    if (!confirm("Close this job?")) return;
    await api.delete(`/jobs/${id}`);
    toast.success("Job closed");
    router.push("/jobs");
  };

  const getCount = (key?: string) => {
    if (!key || !job) return 0;
    if (key === "candidates") return job.candidate_count;
    if (key === "notes") return notes.length;
    if (key === "activities") return scheduledActivities.length;
    if (key === "team") return job.assigned_recruiter_id ? 1 : 0;
    return 0;
  };

  if (loading) return <PageWrapper><CardSkeleton /></PageWrapper>;
  if (!job) return <PageWrapper><p className="p-6">Job not found</p></PageWrapper>;

  return (
    <PageWrapper>
      <div className="content-panel overflow-hidden">
        <JobDetailHeader
          job={job}
          pipeline={pipeline}
          onUpdate={refreshAll}
          onArchive={handleArchive}
        />

        <div className="sub-tabs px-2">
          {TABS.map(({ id: tabId, label, icon: Icon, countKey }) => {
            const count = getCount(countKey);
            const active = tab === tabId;
            return (
              <button
                key={tabId}
                onClick={() => switchTab(tabId)}
                className={cn("sub-tab", active ? "sub-tab-active" : "sub-tab-inactive")}
              >
                <Icon className="h-4 w-4" />
                {label}
                {countKey && count > 0 && (
                  <span className="ml-0.5 bg-green-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={cn("min-h-[400px]", tab === "candidates" ? "p-0 bg-surface-muted" : "p-6 bg-surface-muted/50")}>
          {tab === "candidates" && <JobCandidatesTab jobId={jobId} />}

          {tab === "summary" && (
            <JobSummaryTab job={job} users={users} onUpdate={refreshAll} />
          )}

          {tab === "team" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-2xl">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Job Team</h3>
              {job.assigned_recruiter_name ? (
                <div className="flex items-center gap-3 py-3 border-b border-gray-100">
                  <UserAvatar name={job.assigned_recruiter_name} size="md" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{job.assigned_recruiter_name}</p>
                    <p className="text-xs text-gray-500">Job Owner</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase font-semibold">Active</span>
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-4">No team members assigned.</p>
              )}
              <select className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 mt-2"
                value={job.assigned_recruiter_id || ""}
                onChange={async (e) => {
                  await api.put(`/jobs/${job.id}`, { assigned_recruiter_id: Number(e.target.value) });
                  toast.success("Team member assigned");
                  refreshAll();
                }}>
                <option value="">+ Add team member</option>
                {users.filter((u) => ["recruiter", "manager", "admin"].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          )}

          {tab === "ai" && (
            <PlaceholderTab title="AI Recommendations" description="AI-powered candidate matching will appear here based on job requirements." />
          )}

          {tab === "activities" && job && (
            <EntityActivitiesTab
              entityType="job"
              entityId={jobId}
              relatedLabel={job.title}
              activities={scheduledActivities}
              users={users}
              onRefresh={fetchJob}
            />
          )}

          {tab === "notes" && (
            <JobNotesTab jobId={jobId} notes={notes} onRefresh={fetchNotes} />
          )}

          {tab === "attachments" && (
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-2xl">
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary-700 cursor-pointer mb-4 shadow-sm transition-all">
                <Upload className="h-4 w-4" /> Upload File
                <input type="file" className="hidden" onChange={() => toast("Job attachments coming soon")} />
              </label>
              <p className="text-sm text-gray-400">No attachments yet. Upload job-related documents here.</p>
            </div>
          )}

          {tab === "sourcing" && (
            <PlaceholderTab title="Sourcing" description="Post this job to job boards and manage sourcing campaigns." />
          )}

          {tab === "reports" && (
            <PlaceholderTab title="Reports" description="View hiring metrics, time-to-fill, and pipeline analytics for this job." />
          )}

          {tab === "history" && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden max-w-3xl">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
                {history.length} action{history.length !== 1 ? "s" : ""} taken
              </div>
              {history.length ? history.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
                  <UserAvatar name={a.created_by_name || "U"} size="md" />
                  <div className="flex-1"><p className="text-sm text-gray-800">{a.description}</p></div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </div>
              )) : (
                <p className="px-5 py-12 text-sm text-gray-400 text-center">No history yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
