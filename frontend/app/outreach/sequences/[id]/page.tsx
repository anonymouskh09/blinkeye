"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Pause, Play, Eye } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { CardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type {
  ApiResponse,
  OutreachCandidateOption,
  OutreachEmailLog,
  OutreachSequenceDetail,
  PaginatedData,
} from "@/types";

type Tab = "steps" | "audience" | "logs";

const VARIABLES = [
  "{{first_name}}", "{{last_name}}", "{{full_name}}", "{{company}}",
  "{{current_title}}", "{{job_title}}", "{{location}}", "{{sender_name}}", "{{sender_first_name}}",
];

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-primary-100 text-primary-700",
  };
  return map[status] || map.draft;
};

export default function OutreachSequenceDetailPage() {
  const { id } = useParams();
  const sequenceId = String(id);
  const [sequence, setSequence] = useState<OutreachSequenceDetail | null>(null);
  const [logs, setLogs] = useState<OutreachEmailLog[]>([]);
  const [candidates, setCandidates] = useState<OutreachCandidateOption[]>([]);
  const [tab, setTab] = useState<Tab>("steps");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{ subject: string; body: string; warnings: string[] } | null>(null);

  const fetchSequence = useCallback(async () => {
    const res = await api.get<ApiResponse<OutreachSequenceDetail>>(`/outreach/sequences/${sequenceId}`);
    setSequence(res.data.data);
  }, [sequenceId]);

  const fetchLogs = useCallback(async () => {
    const res = await api.get<ApiResponse<{ items: OutreachEmailLog[] }>>(`/outreach/sequences/${sequenceId}/logs`);
    setLogs(res.data.data.items);
  }, [sequenceId]);

  const fetchCandidates = useCallback(async (q?: string) => {
    const res = await api.get<ApiResponse<PaginatedData<OutreachCandidateOption>>>("/outreach/candidates", {
      params: { search: q || undefined, page_size: 100 },
    });
    setCandidates(res.data.data.items);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchSequence(), fetchLogs(), fetchCandidates()])
      .catch(() => toast.error("Failed to load sequence"))
      .finally(() => setLoading(false));
  }, [fetchSequence, fetchLogs, fetchCandidates]);

  const refresh = async () => {
    await fetchSequence();
    await fetchLogs();
  };

  const saveMeta = async () => {
    if (!sequence) return;
    await api.put(`/outreach/sequences/${sequenceId}`, {
      name: sequence.name,
      description: sequence.description,
    });
    toast.success("Sequence saved");
    fetchSequence();
  };

  const addStep = async () => {
    await api.post(`/outreach/sequences/${sequenceId}/steps`, {
      step_name: `Step ${(sequence?.steps.length || 0) + 1}`,
      subject: "Quick introduction",
      body: "Hi {{first_name}},\n\nI came across your profile and noticed your experience as {{current_title}}.",
      delay_days: sequence?.steps.length ? 2 : 0,
    });
    toast.success("Step added");
    refresh();
  };

  const updateStep = async (stepId: number, data: Record<string, unknown>) => {
    await api.put(`/outreach/sequences/${sequenceId}/steps/${stepId}`, data);
    fetchSequence();
  };

  const deleteStep = async (stepId: number) => {
    if (!confirm("Delete this step?")) return;
    await api.delete(`/outreach/sequences/${sequenceId}/steps/${stepId}`);
    toast.success("Step deleted");
    refresh();
  };

  const toggleActivate = async () => {
    try {
      if (sequence?.status === "active") {
        await api.post(`/outreach/sequences/${sequenceId}/pause`);
        toast.success("Sequence paused");
      } else {
        await api.post(`/outreach/sequences/${sequenceId}/activate`);
        toast.success("Sequence activated");
      }
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Action failed");
    }
  };

  const enrollCandidate = async (candidateId: number) => {
    try {
      await api.post(`/outreach/sequences/${sequenceId}/enrollments`, { candidate_id: candidateId });
      toast.success("Candidate enrolled");
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Could not enroll candidate");
    }
  };

  const removeEnrollment = async (enrollmentId: number) => {
    await api.delete(`/outreach/sequences/${sequenceId}/enrollments/${enrollmentId}`);
    toast.success("Candidate removed");
    refresh();
  };

  const runPreview = async (candidateId: number) => {
    const res = await api.post<ApiResponse<{ subject: string; body: string; warnings: string[] }>>(
      `/outreach/sequences/${sequenceId}/preview`,
      { candidate_id: candidateId, step_number: 1 },
    );
    setPreview(res.data.data);
  };

  if (loading || !sequence) {
    return <PageWrapper><CardSkeleton /></PageWrapper>;
  }

  const enrolledIds = new Set(sequence.enrollments.map((e) => e.candidate_id));

  return (
    <PageWrapper>
      <div className="mb-6">
        <Link href="/outreach/sequences" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to sequences
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{sequence.name}</h1>
              <Badge className={statusBadge(sequence.status)}>{sequence.status}</Badge>
            </div>
            <p className="text-sm text-gray-500">
              Sender: {sequence.sender_email || "Connect Gmail in Outreach settings"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveMeta}>Save</Button>
            {sequence.status !== "completed" && (
              <Button onClick={toggleActivate}>
                {sequence.status === "active" ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Activate</>}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="content-panel p-5 mb-6 space-y-4">
        <Input
          label="Sequence name"
          value={sequence.name}
          onChange={(e) => setSequence({ ...sequence, name: e.target.value })}
        />
        <Textarea
          label="Description"
          value={sequence.description || ""}
          onChange={(e) => setSequence({ ...sequence, description: e.target.value })}
          rows={2}
        />
        <p className="text-xs text-gray-400">
          Variables: {VARIABLES.join(", ")}
        </p>
      </div>

      <div className="sub-tabs px-2 mb-4">
        {(["steps", "audience", "logs"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("sub-tab capitalize", tab === t ? "sub-tab-active" : "sub-tab-inactive")}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "steps" && (
        <div className="space-y-4">
          <Button size="sm" onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Add step</Button>
          {sequence.steps.map((step) => (
            <div key={step.id} className="content-panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Step {step.step_number}</h3>
                <button type="button" onClick={() => deleteStep(step.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Input
                label="Step name"
                defaultValue={step.step_name}
                onBlur={(e) => updateStep(step.id, { step_name: e.target.value })}
              />
              <Input
                label="Delay (days before this step)"
                type="number"
                defaultValue={String(step.delay_days)}
                onBlur={(e) => updateStep(step.id, { delay_days: Number(e.target.value) })}
              />
              <Input
                label="Subject"
                defaultValue={step.subject}
                onBlur={(e) => updateStep(step.id, { subject: e.target.value })}
              />
              <Textarea
                label="Body"
                defaultValue={step.body}
                onBlur={(e) => updateStep(step.id, { body: e.target.value })}
                rows={6}
              />
            </div>
          ))}
          {!sequence.steps.length && (
            <p className="text-sm text-gray-400">No steps yet. Add your first email step.</p>
          )}
        </div>
      )}

      {tab === "audience" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="content-panel p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Enrolled candidates</h3>
            <div className="space-y-2">
              {sequence.enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                  <div>
                    <p className="font-medium">{e.candidate_name}</p>
                    <p className="text-gray-500">{e.candidate_email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => runPreview(e.candidate_id)} className="text-primary text-xs inline-flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <button type="button" onClick={() => removeEnrollment(e.id)} className="text-red-500 text-xs">Remove</button>
                  </div>
                </div>
              ))}
              {!sequence.enrollments.length && <p className="text-sm text-gray-400">No candidates enrolled yet.</p>}
            </div>
          </div>

          <div className="content-panel p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Add candidates</h3>
            <Input
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={() => fetchCandidates(search)}
              placeholder="Search by name"
            />
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
              {candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-gray-500">{c.email || "No email"}</p>
                    <p className="text-xs text-gray-400">{c.current_job_title}{c.current_company ? ` @ ${c.current_company}` : ""}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!c.email || enrolledIds.has(c.id)}
                    onClick={() => enrollCandidate(c.id)}
                  >
                    {enrolledIds.has(c.id) ? "Added" : "Add"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="content-panel p-1 overflow-x-auto">
          <TableWrapper>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Sender</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th>Sent</Th>
                <Th>Error</Th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Tr key={log.id}>
                  <Td className="text-sm">{log.recipient_email}</Td>
                  <Td className="text-sm">{log.sender_email}</Td>
                  <Td className="text-sm max-w-xs truncate">{log.rendered_subject}</Td>
                  <Td><Badge className={log.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{log.status}</Badge></Td>
                  <Td className="text-sm text-gray-500">{log.sent_at ? formatDateTime(log.sent_at) : "—"}</Td>
                  <Td className="text-xs text-red-600 max-w-xs truncate">{log.error_message || "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
          {!logs.length && <p className="p-6 text-sm text-gray-400 text-center">No email logs yet.</p>}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Email preview</h3>
            {preview.warnings.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                Missing variables: {preview.warnings.join(", ")}
              </p>
            )}
            <p className="text-sm font-medium text-gray-700 mb-1">Subject</p>
            <p className="text-sm text-gray-900 mb-3">{preview.subject}</p>
            <p className="text-sm font-medium text-gray-700 mb-1">Body</p>
            <pre className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{preview.body}</pre>
            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
