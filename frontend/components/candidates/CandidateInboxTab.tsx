"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Pause, Play, GripVertical, Sparkles, Eye, Mail, Clock, Send,
} from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { CardSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn, formatDateTime } from "@/lib/utils";
import type { ApiResponse, Candidate, GmailStatus, OutreachEmailLog, OutreachSequenceDetail } from "@/types";

const VARIABLES = [
  "{{first_name}}", "{{last_name}}", "{{full_name}}", "{{company}}",
  "{{current_title}}", "{{job_title}}", "{{location}}", "{{sender_name}}", "{{sender_first_name}}",
];

const NEXT_STEP_TEMPLATES = [
  {
    step_name: "Follow-up",
    subject: "Re: quick note about {{company}}",
    body: "Hi {{first_name}},\n\nBumping this in case it got buried. Would love to hear your thoughts when you have a minute.",
    delay_days: 3,
  },
  {
    step_name: "Nudge",
    subject: "Last thought, {{first_name}}",
    body: "Hi {{first_name}},\n\nLast nudge from me. If now isn't the right time, no worries and I won't reach out again.",
    delay_days: 3,
  },
] as const;

const MAX_STEPS = 3;

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  paused: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  completed: "bg-primary-50 text-primary-700 ring-1 ring-primary/20",
};

interface Props {
  candidate: Candidate;
  candidateId: string;
}

export default function CandidateInboxTab({ candidate, candidateId }: Props) {
  const [sequence, setSequence] = useState<OutreachSequenceDetail | null>(null);
  const [logs, setLogs] = useState<OutreachEmailLog[]>([]);
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingStep, setAddingStep] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleteStepId, setDeleteStepId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inboxRes, gmailRes] = await Promise.all([
        api.get<ApiResponse<OutreachSequenceDetail>>(`/outreach/candidates/${candidateId}/inbox`),
        api.get<ApiResponse<GmailStatus>>("/gmail/status"),
      ]);
      setSequence(inboxRes.data.data);
      setGmail(gmailRes.data.data);
      const logRes = await api.get<ApiResponse<{ items: OutreachEmailLog[] }>>(
        `/outreach/sequences/${inboxRes.data.data.id}/logs`,
      );
      setLogs(logRes.data.data.items);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    const inboxRes = await api.get<ApiResponse<OutreachSequenceDetail>>(`/outreach/candidates/${candidateId}/inbox`);
    setSequence(inboxRes.data.data);
    const logRes = await api.get<ApiResponse<{ items: OutreachEmailLog[] }>>(
      `/outreach/sequences/${inboxRes.data.data.id}/logs`,
    );
    setLogs(logRes.data.data.items);
  };

  const nextStepTemplate = sequence && sequence.steps.length < MAX_STEPS
    ? NEXT_STEP_TEMPLATES[sequence.steps.length - 1]
    : null;

  const addStep = async () => {
    if (!sequence || !nextStepTemplate) return;
    setAddingStep(true);
    try {
      await api.post(`/outreach/sequences/${sequence.id}/steps`, { ...nextStepTemplate });
      toast.success(`${nextStepTemplate.step_name} step added`);
      await refresh();
    } catch {
      toast.error("Could not add step");
    } finally {
      setAddingStep(false);
    }
  };

  const updateStep = async (stepId: number, data: Record<string, unknown>) => {
    if (!sequence) return;
    await api.put(`/outreach/sequences/${sequence.id}/steps/${stepId}`, data);
    await refresh();
  };

  const confirmDeleteStep = async () => {
    if (!sequence || deleteStepId === null) return;
    if (sequence.steps.length <= 1) {
      toast.error("At least one step is required");
      setDeleteStepId(null);
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/outreach/sequences/${sequence.id}/steps/${deleteStepId}`);
      toast.success("Step removed");
      setDeleteStepId(null);
      await refresh();
    } catch {
      toast.error("Could not delete step");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActivate = async () => {
    if (!sequence) return;
    setActivating(true);
    try {
      if (sequence.status === "active") {
        await api.post(`/outreach/sequences/${sequence.id}/pause`);
        toast.success("Outreach paused");
      } else {
        await api.post(`/outreach/sequences/${sequence.id}/activate`);
        toast.success("Outreach activated — emails will send from your Gmail");
      }
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Could not update status");
    } finally {
      setActivating(false);
    }
  };

  const runPreview = async () => {
    if (!sequence) return;
    setPreviewLoading(true);
    try {
      const res = await api.post<ApiResponse<{ subject: string; body: string }>>(
        `/outreach/sequences/${sequence.id}/preview`,
        { candidate_id: candidate.id, step_number: 1 },
      );
      setPreview(res.data.data);
    } catch {
      toast.error("Could not generate preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const connectGmail = () => {
    const hostname = window.location.hostname || "localhost";
    window.location.href = `http://${hostname}:8000/gmail/connect`;
  };

  const insertVariable = (variable: string) => {
    const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      el.value = el.value.slice(0, start) + variable + el.value.slice(end);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.focus();
    }
  };

  const stepTiming = (stepNumber: number, delayDays: number) => {
    if (stepNumber === 1 && delayDays === 0) {
      return "Sends immediately when outreach is activated";
    }
    return `Wait ${delayDays} day${delayDays !== 1 ? "s" : ""} after previous step`;
  };

  if (loading) return <CardSkeleton />;

  if (!sequence) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500">
        Could not load inbox.
      </div>
    );
  }

  if (!candidate.email) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm">
        <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-800">Email required</p>
        <p className="text-sm text-gray-500 mt-1">Add an email to this candidate before starting outreach.</p>
      </div>
    );
  }

  const deleteTarget = sequence.steps.find((s) => s.id === deleteStepId);

  return (
    <div className="w-full space-y-5">
      {/* Toolbar */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary flex items-center justify-center">
                <Send className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Email Outreach</h3>
            </div>
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide px-2.5 py-0.5 rounded-full", statusBadge[sequence.status])}>
              {sequence.status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>To: <span className="text-gray-800 font-medium">{candidate.email}</span></span>
            {sequence.sender_email && (
              <span>From: <span className="text-gray-800 font-medium">{sequence.sender_email}</span></span>
            )}
            <span>{sequence.steps.length} of {MAX_STEPS} steps</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!gmail?.connected && (
            <Button size="sm" variant="outline" onClick={connectGmail}>
              <Mail className="h-4 w-4 mr-1.5" /> Connect Gmail
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={runPreview} loading={previewLoading}>
            <Eye className="h-4 w-4 mr-1.5" /> Preview
          </Button>
          {sequence.status !== "completed" && (
            <Button size="sm" onClick={toggleActivate} loading={activating}>
              {sequence.status === "active"
                ? <><Pause className="h-4 w-4 mr-1.5" /> Pause</>
                : <><Play className="h-4 w-4 mr-1.5" /> Activate</>}
            </Button>
          )}
        </div>
      </div>

      {!gmail?.connected && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          Connect Gmail in{" "}
          <Link href="/outreach" className="text-primary font-semibold hover:underline">Outreach settings</Link>
          {" "}before activating this sequence.
        </div>
      )}

      {/* Steps */}
      <div className="space-y-4">
        {sequence.steps.map((step) => (
          <div
            key={step.id}
            className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden"
          >
            <div className="flex">
              <div className="w-1 bg-primary shrink-0" />
              <div className="flex-1 p-5 sm:p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-gray-300 mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-primary bg-primary-50 border border-primary/15 px-2.5 py-1 rounded-lg shrink-0">
                          Step {step.step_number}
                        </span>
                        <input
                          type="text"
                          defaultValue={step.step_name}
                          onBlur={(e) => {
                            if (e.target.value.trim() && e.target.value !== step.step_name) {
                              updateStep(step.id, { step_name: e.target.value.trim() });
                            }
                          }}
                          className="text-sm font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-primary focus:outline-none min-w-0"
                        />
                      </div>
                      {sequence.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDeleteStepId(step.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                          title="Remove step"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {stepTiming(step.step_number, step.delay_days)}
                    </p>
                  </div>
                </div>

                {step.step_number > 1 && (
                  <div className="flex items-center gap-2 text-sm pl-8 flex-wrap">
                    <span className="text-gray-500">Wait</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={step.delay_days}
                      onBlur={(e) => updateStep(step.id, { delay_days: Number(e.target.value) })}
                      className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                    <span className="text-gray-500">days after previous step</span>
                  </div>
                )}

                <div className="pl-8 space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Subject</label>
                    <input
                      type="text"
                      defaultValue={step.subject}
                      onBlur={(e) => updateStep(step.id, { subject: e.target.value })}
                      className="mt-1.5 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Body</label>
                    <textarea
                      defaultValue={step.body}
                      rows={5}
                      onBlur={(e) => updateStep(step.id, { body: e.target.value })}
                      className="mt-1.5 w-full border border-gray-200 rounded-xl px-3.5 py-3 text-sm text-gray-900 resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
                    />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Insert variable</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIABLES.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:bg-primary-50 hover:border-primary/20 hover:text-primary font-mono transition-colors"
                        >
                          {v}
                        </button>
                      ))}
                      <span className="text-[11px] px-2.5 py-1 rounded-lg bg-primary-50 border border-primary-100 text-primary-500 flex items-center gap-1 opacity-50 cursor-not-allowed">
                        <Sparkles className="h-3 w-3" /> AI
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {nextStepTemplate && (
          <button
            type="button"
            onClick={addStep}
            disabled={addingStep}
            className="w-full rounded-2xl border-2 border-dashed border-gray-200 bg-white/60 py-5 text-sm font-medium text-gray-600 hover:border-primary/30 hover:text-primary hover:bg-primary-50/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {addingStep ? "Adding..." : `Add ${nextStepTemplate.step_name} step`}
          </button>
        )}

        {!nextStepTemplate && sequence.steps.length >= MAX_STEPS && (
          <p className="text-center text-xs text-gray-400 py-2">Maximum {MAX_STEPS} steps reached for this sequence.</p>
        )}
      </div>

      {logs.length > 0 && (
        <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm p-5">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">Sent emails</h4>
          <div className="divide-y divide-gray-100">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{log.rendered_subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{log.sent_at ? formatDateTime(log.sent_at) : "Scheduled"}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0",
                  log.status === "sent" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                )}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={deleteStepId !== null}
        onClose={() => !deleting && setDeleteStepId(null)}
        title="Remove step"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Remove <span className="font-semibold text-gray-900">{deleteTarget?.step_name}</span> from this outreach sequence? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" size="sm" onClick={() => setDeleteStepId(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={confirmDeleteStep} loading={deleting}>
            Remove step
          </Button>
        </div>
      </Modal>

      {/* Preview modal */}
      <Modal open={preview !== null} onClose={() => setPreview(null)} title="Email preview" size="lg">
        {preview && (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-sm text-gray-900 bg-gray-50 rounded-xl px-4 py-3">{preview.subject}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Body</p>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3 font-sans">{preview.body}</pre>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setPreview(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
