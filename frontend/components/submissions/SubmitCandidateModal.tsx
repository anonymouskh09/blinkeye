"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import api from "@/lib/api";
import type { ApiResponse, Candidate, Job, Submission } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  assignmentId: number;
  candidateId: number;
  jobId: number;
  onSuccess?: (submission: Submission) => void;
}

export default function SubmitCandidateModal({
  open,
  onClose,
  assignmentId,
  candidateId,
  jobId,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [form, setForm] = useState({
    candidate_summary: "",
    expected_compensation: "",
    availability: "",
    recruiter_notes: "",
    resume_file_path: "",
  });

  useEffect(() => {
    if (!open) return;
    setBootstrapping(true);
    Promise.all([
      api.get<ApiResponse<Candidate>>(`/candidates/${candidateId}`),
      api.get<ApiResponse<Job>>(`/jobs/${jobId}`),
    ])
      .then(([cRes, jRes]) => {
        const c = cRes.data.data;
        const j = jRes.data.data;
        setCandidate(c);
        setJob(j);
        setForm({
          candidate_summary: c.summary || c.notes || "",
          expected_compensation:
            c.expected_salary != null
              ? String(c.expected_salary)
              : c.salary_min || c.salary_max
                ? `${c.salary_min ?? ""}-${c.salary_max ?? ""} ${c.salary_currency || "USD"}`.trim()
                : "",
          availability: c.notice_period || "",
          recruiter_notes: "",
          resume_file_path: c.cv_file_path || "",
        });
      })
      .catch(() => toast.error("Failed to load submission context"))
      .finally(() => setBootstrapping(false));
  }, [open, candidateId, jobId]);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await api.post<ApiResponse<Submission>>("/submissions", {
        candidate_job_assignment_id: assignmentId,
        candidate_summary: form.candidate_summary || null,
        expected_compensation: form.expected_compensation || null,
        availability: form.availability || null,
        recruiter_notes: form.recruiter_notes || null,
        resume_file_path: form.resume_file_path || null,
      });
      toast.success("Candidate submitted");
      onSuccess?.(res.data.data);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to submit candidate";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatedModal open={open} onClose={onClose} title="Submit Candidate" size="lg">
      {bootstrapping ? (
        <p className="text-sm text-gray-500 py-8 text-center">Loading...</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 space-y-1">
            <p><span className="font-semibold text-gray-900">Candidate:</span> {candidate?.name || "—"}</p>
            <p><span className="font-semibold text-gray-900">Job:</span> {job?.title || "—"}</p>
            <p><span className="font-semibold text-gray-900">Client:</span> {job?.client_name || "—"}</p>
            <p><span className="font-semibold text-gray-900">Engagement:</span> {job?.engagement_name || "—"}</p>
          </div>

          <Input
            label="Resume / Document"
            value={form.resume_file_path}
            onChange={(e) => setForm({ ...form, resume_file_path: e.target.value })}
            placeholder="CV path or leave default"
          />
          <Textarea
            label="Candidate Summary"
            value={form.candidate_summary}
            onChange={(e) => setForm({ ...form, candidate_summary: e.target.value })}
            rows={4}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Compensation / Expected Salary"
              value={form.expected_compensation}
              onChange={(e) => setForm({ ...form, expected_compensation: e.target.value })}
            />
            <Input
              label="Availability"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              placeholder="e.g. 2 weeks notice"
            />
          </div>
          <Textarea
            label="Recruiter Notes"
            value={form.recruiter_notes}
            onChange={(e) => setForm({ ...form, recruiter_notes: e.target.value })}
            rows={3}
          />

          <div className="flex gap-2 pt-2">
            <Button onClick={submit} loading={loading}>Submit to Client</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </AnimatedModal>
  );
}
