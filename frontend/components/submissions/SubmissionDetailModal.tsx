"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import api from "@/lib/api";
import type {
  ApiResponse,
  ClientFeedbackType,
  Submission,
} from "@/types";
import {
  CLIENT_FEEDBACK_TYPE_LABELS,
  SUBMISSION_STATUS_LABELS,
} from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  submissionId: number | null;
  onUpdated?: () => void;
}

const FEEDBACK_OPTIONS = (Object.keys(CLIENT_FEEDBACK_TYPE_LABELS) as ClientFeedbackType[]).map(
  (value) => ({ value, label: CLIENT_FEEDBACK_TYPE_LABELS[value] }),
);

export default function SubmissionDetailModal({ open, onClose, submissionId, onUpdated }: Props) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    feedback_type: "interested" as ClientFeedbackType,
    feedback_text: "",
    rejection_reason: "",
    notes: "",
    rating: "",
  });

  const load = async () => {
    if (!submissionId) return;
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<Submission>>(`/submissions/${submissionId}`);
      setSubmission(res.data.data);
    } catch {
      toast.error("Failed to load submission");
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && submissionId) load();
    if (!open) {
      setSubmission(null);
      setFeedbackOpen(false);
    }
  }, [open, submissionId]);

  const saveFeedback = async () => {
    if (!submissionId) return;
    setSaving(true);
    try {
      const res = await api.post<ApiResponse<Submission>>(`/submissions/${submissionId}/feedback`, {
        feedback_type: form.feedback_type,
        feedback_text: form.feedback_text || null,
        rejection_reason: form.rejection_reason || null,
        notes: form.notes || null,
        rating: form.rating ? Number(form.rating) : null,
      });
      setSubmission(res.data.data);
      setFeedbackOpen(false);
      setForm({
        feedback_type: "interested",
        feedback_text: "",
        rejection_reason: "",
        notes: "",
        rating: "",
      });
      toast.success("Client feedback recorded");
      onUpdated?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save feedback";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedModal open={open} onClose={onClose} title="Submission Detail" size="lg">
      {loading || !submission ? (
        <p className="text-sm text-gray-500 py-8 text-center">{loading ? "Loading..." : "Not found"}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-gray-700 space-y-1">
              <p><span className="font-semibold">Candidate:</span> {submission.candidate_name}</p>
              <p><span className="font-semibold">Job:</span> {submission.job_title}</p>
              <p><span className="font-semibold">Client:</span> {submission.client_name}</p>
              <p><span className="font-semibold">Engagement:</span> {submission.engagement_name || "—"}</p>
              <p><span className="font-semibold">Submitted by:</span> {submission.recruiter_name || "—"}</p>
              <p><span className="font-semibold">Date:</span> {submission.submission_date}</p>
            </div>
            <Badge>{SUBMISSION_STATUS_LABELS[submission.status]}</Badge>
          </div>

          <div className="rounded-lg border border-gray-200 p-3 text-sm space-y-2">
            <p><span className="font-semibold text-gray-800">Summary:</span> {submission.candidate_summary || "—"}</p>
            <p><span className="font-semibold text-gray-800">Compensation:</span> {submission.expected_compensation || "—"}</p>
            <p><span className="font-semibold text-gray-800">Availability:</span> {submission.availability || "—"}</p>
            <p><span className="font-semibold text-gray-800">Resume:</span> {submission.resume_file_path || "—"}</p>
            <p><span className="font-semibold text-gray-800">Recruiter notes:</span> {submission.recruiter_notes || "—"}</p>
            <p><span className="font-semibold text-gray-800">Pipeline stage:</span> {submission.assignment_status?.replace(/_/g, " ") || "—"}</p>
          </div>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800">Client Feedback</h4>
            <Button size="sm" onClick={() => setFeedbackOpen(true)}>Add Client Feedback</Button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(submission.feedback || []).map((fb) => (
              <div key={fb.id} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-primary">
                    {CLIENT_FEEDBACK_TYPE_LABELS[fb.feedback_type]}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(fb.feedback_date), { addSuffix: true })}
                  </span>
                </div>
                {fb.rejection_reason && (
                  <p className="text-xs text-red-600 mt-1">Reason: {fb.rejection_reason}</p>
                )}
                {(fb.feedback_text || fb.notes) && (
                  <p className="text-gray-700 mt-1">{fb.feedback_text || fb.notes}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Recorded by {fb.created_by_name || "User"}
                  {fb.rating ? ` · Rating ${fb.rating}/5` : ""}
                </p>
              </div>
            ))}
            {!submission.feedback?.length && (
              <p className="text-sm text-gray-400 text-center py-4">No client feedback yet</p>
            )}
          </div>
        </div>
      )}

      <AnimatedModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Add Client Feedback"
        size="md"
      >
        <div className="space-y-3">
          <Select
            label="Feedback Type"
            options={FEEDBACK_OPTIONS}
            value={form.feedback_type}
            onChange={(e) => setForm({ ...form, feedback_type: e.target.value as ClientFeedbackType })}
          />
          {form.feedback_type === "rejected" && (
            <Input
              label="Rejection Reason *"
              value={form.rejection_reason}
              onChange={(e) => setForm({ ...form, rejection_reason: e.target.value })}
            />
          )}
          <Textarea
            label="Feedback"
            value={form.feedback_text}
            onChange={(e) => setForm({ ...form, feedback_text: e.target.value })}
            rows={3}
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
          />
          <Input
            label="Rating (1-5)"
            type="number"
            min={1}
            max={5}
            value={form.rating}
            onChange={(e) => setForm({ ...form, rating: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={saveFeedback} loading={saving}>Save Feedback</Button>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
          </div>
        </div>
      </AnimatedModal>
    </AnimatedModal>
  );
}
