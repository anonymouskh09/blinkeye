"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink, MoreVertical, Plus, Play, Pencil, GitBranch, Archive, UserPlus,
} from "lucide-react";
import toast from "react-hot-toast";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { JOB_STAGES } from "@/components/jobs/JobsListTable";
import api from "@/lib/api";
import type { ApiResponse, Engagement, Job, JobStatus, PaginatedData, PipelineData } from "@/types";
import { BILLING_MODEL_LABELS, SERVICE_MODEL_LABELS } from "@/types";

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "on-hold", label: "On Hold" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
];

function jobRef(id: number) {
  return `Y${id.toString(36).toUpperCase().padStart(7, "0").slice(0, 7)}`;
}

function formatSalary(min?: number, max?: number) {
  if (!min && !max) return "Negotiable";
  return `${min?.toLocaleString() ?? "—"} - ${max?.toLocaleString() ?? "—"}`;
}

interface Props {
  job: Job;
  pipeline: PipelineData | null;
  onUpdate: () => void;
  onArchive: () => void;
}

export default function JobDetailHeader({ job, pipeline, onUpdate, onArchive }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: job.title,
    location: job.location || "",
    engagement_id: String(job.engagement_id || ""),
  });
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [newStatus, setNewStatus] = useState<JobStatus>(job.status);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditForm({
      title: job.title,
      location: job.location || "",
      engagement_id: String(job.engagement_id || ""),
    });
    setNewStatus(job.status);
  }, [job]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!editOpen || !job.client_id) return;
    api
      .get<ApiResponse<PaginatedData<Engagement>>>("/engagements", {
        params: { client_id: job.client_id, page_size: 100 },
      })
      .then((res) => setEngagements(res.data.data.items || []))
      .catch(() => setEngagements([]));
  }, [editOpen, job.client_id]);

  const stages = pipeline?.stages;
  const inPipeline = stages
    ? Object.entries(stages).reduce((n, [k, cards]) => (k === "hired" || k === "rejected" ? n : n + cards.length), 0)
    : job.candidate_count;
  const hiredCount = stages?.hired?.length ?? 0;
  const droppedCount = stages?.rejected?.length ?? 0;

  const updateStatus = async (status: JobStatus) => {
    try {
      await api.put(`/jobs/${job.id}`, { status });
      toast.success("Status updated");
      onUpdate();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const saveEdit = async () => {
    try {
      await api.put(`/jobs/${job.id}`, {
        title: editForm.title,
        location: editForm.location,
        engagement_id: editForm.engagement_id ? Number(editForm.engagement_id) : undefined,
      });
      toast.success("Job updated");
      setEditOpen(false);
      onUpdate();
    } catch {
      toast.error("Failed to update job");
    }
  };

  const saveStatus = async () => {
    await updateStatus(newStatus);
    setStatusOpen(false);
  };

  return (
    <>
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <ClientAvatar name={job.client_name || job.title} size="xl" className="!bg-amber-400 !text-amber-900 shadow-sm shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold text-gray-900">{job.title}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-orange-100 text-orange-700 border border-orange-200">
                  NOT PUBLISHED
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary text-white">
                  {JOB_STAGES[job.status] || "NEW CANDIDATES"}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                {job.client_name && (
                  <Link href={`/clients/${job.client_id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline">
                    Client: {job.client_name} <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
                {job.engagement_name && (
                  <Link href={`/clients/${job.client_id}?tab=engagements`}
                    className="inline-flex items-center gap-1 text-primary hover:underline">
                    Engagement: {job.engagement_name}
                  </Link>
                )}
              </div>
              {(job.service_model || job.billing_model) && (
                <p className="mt-1 text-xs text-gray-500">
                  {job.service_model && (
                    <span>Service: {SERVICE_MODEL_LABELS[job.service_model]}</span>
                  )}
                  {job.service_model && job.billing_model && <span className="mx-1.5">·</span>}
                  {job.billing_model && (
                    <span>Billing: {BILLING_MODEL_LABELS[job.billing_model]}</span>
                  )}
                </p>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <div className="inline-flex items-center gap-1 border border-gray-200 rounded-md px-2 py-1 bg-white">
                  <Play className="h-3 w-3 text-primary fill-primary" />
                  <select
                    value={job.status}
                    onChange={(e) => updateStatus(e.target.value as JobStatus)}
                    className="text-xs font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <span className="text-sm text-gray-500">{formatSalary(job.salary_min, job.salary_max)}</span>
                <button type="button" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                  <Plus className="h-3.5 w-3.5" /> Tags
                </button>
                {job.assigned_recruiter_name && (
                  <span className="inline-flex items-center gap-1.5 ml-auto">
                    <UserAvatar name={job.assigned_recruiter_name} />
                    <span className="text-xs text-primary">{job.assigned_recruiter_name}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 shrink-0">
            <div className="flex gap-2">
              <div className="text-center px-3 py-2 rounded-lg border border-green-200 bg-green-50 min-w-[72px]">
                <p className="text-lg font-bold text-green-700">{hiredCount}</p>
                <p className="text-[10px] font-semibold text-green-600 uppercase">Hired</p>
              </div>
              <div className="text-center px-3 py-2 rounded-lg border border-primary/20 bg-primary-50 min-w-[72px]">
                <p className="text-lg font-bold text-primary-700">{inPipeline}</p>
                <p className="text-[10px] font-semibold text-primary uppercase">In pipeline</p>
              </div>
              <div className="text-center px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 min-w-[72px]">
                <p className="text-lg font-bold text-gray-600">{droppedCount}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase">Dropped</p>
              </div>
            </div>

            <div className="relative" ref={menuRef}>
              <button type="button" onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 rounded-md border border-gray-200 text-primary hover:bg-primary-50">
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-40 w-52 bg-white border border-gray-200 rounded-lg shadow-xl py-1 animate-slide-down">
                  {[
                    { label: "Add Candidate", icon: UserPlus, action: () => { router.push("/candidates"); setMenuOpen(false); } },
                    { label: "View Pipeline", icon: GitBranch, action: () => { router.push(`/jobs/${job.id}?tab=candidates`); setMenuOpen(false); } },
                    { label: "Edit", icon: Pencil, action: () => { setEditOpen(true); setMenuOpen(false); } },
                    { label: "Change Status", icon: Play, action: () => { setStatusOpen(true); setMenuOpen(false); } },
                    { label: "Close Job", icon: Archive, action: () => { setMenuOpen(false); onArchive(); } },
                  ].map(({ label, icon: Icon, action }) => (
                    <button key={label} type="button" onClick={action}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Icon className="h-4 w-4 text-gray-500" /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatedModal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Job" size="md">
        <div className="space-y-3">
          <Input label="Position Name" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
          <Input label="Location" value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          <Select
            label="Engagement"
            options={engagements.map((e) => ({
              value: String(e.id),
              label: `${e.engagement_name} (${e.status})`,
            }))}
            value={editForm.engagement_id}
            onChange={(e) => setEditForm({ ...editForm, engagement_id: e.target.value })}
          />
          <Button onClick={saveEdit}>Save Changes</Button>
        </div>
      </AnimatedModal>

      <AnimatedModal open={statusOpen} onClose={() => setStatusOpen(false)} title="Change Job Status" size="sm">
        <Select label="Status" options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          value={newStatus} onChange={(e) => setNewStatus(e.target.value as JobStatus)} />
        <Button className="mt-4" onClick={saveStatus}>Update</Button>
      </AnimatedModal>
    </>
  );
}

export { jobRef, formatSalary };
