"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, FileUp, Files, Table2, Upload, CloudUpload,
} from "lucide-react";
import toast from "react-hot-toast";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import ResumeProcessingPanel from "@/components/candidates/ResumeProcessingPanel";
import api from "@/lib/api";
import { RESUME_PROCESS_STEPS, runWithProcessingSteps } from "@/lib/resumeProcessing";
import { cn } from "@/lib/utils";
import type { ApiResponse, Job, PaginatedData, ParsedResume } from "@/types";

type Step = "menu" | "upload" | "review";

const MENU_OPTIONS = [
  {
    id: "form",
    label: "Complete a Form",
    icon: ClipboardList,
    iconClass: "text-primary",
    bg: "bg-primary-50",
  },
  {
    id: "upload",
    label: "Upload a Resume",
    icon: FileUp,
    iconClass: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    id: "multi",
    label: "Upload multiple Resumes",
    icon: Files,
    iconClass: "text-teal-600",
    bg: "bg-teal-50",
  },
  {
    id: "import",
    label: "Import a JSON or CSV file",
    icon: Table2,
    iconClass: "text-primary-600",
    bg: "bg-primary-50",
  },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  defaultFolderId?: number;
}

function buildFormData(data: ParsedResume, cvFile: File): FormData {
  const fd = new FormData();
  fd.append("name", data.name || "Unknown Candidate");
  fd.append("email", data.email || "");
  if (data.phone) fd.append("phone", data.phone);
  if (data.location) fd.append("location", data.location);
  if (data.current_job_title) fd.append("current_job_title", data.current_job_title);
  if (data.current_company) fd.append("current_company", data.current_company);
  if (data.experience_years != null) fd.append("experience_years", String(data.experience_years));
  if (data.linkedin_url) fd.append("linkedin_url", data.linkedin_url);
  if (data.skills?.length) fd.append("skills", data.skills.join(", "));
  fd.append("cv_file", cvFile);
  return fd;
}

export default function CreateCandidateModal({ open, onClose, onCreated, defaultFolderId }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const multiRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("menu");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedResume | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState(0);
  const [processingFileName, setProcessingFileName] = useState("");
  const [review, setReview] = useState({
    name: "", email: "", phone: "", location: "",
    current_job_title: "", current_company: "", experience_years: "",
    skills: "", linkedin_url: "", notes: "",
  });

  const reset = useCallback(() => {
    setStep("menu");
    setSelectedJob("");
    setCvFile(null);
    setParsed(null);
    setProcessing(false);
    setProcessStep(0);
    setProcessingFileName("");
    setReview({
      name: "", email: "", phone: "", location: "",
      current_job_title: "", current_company: "", experience_years: "",
      skills: "", linkedin_url: "", notes: "",
    });
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    api.get<ApiResponse<PaginatedData<Job>>>("/jobs", { params: { page_size: 100, status: "active" } })
      .then((r) => setJobs(r.data.data.items))
      .catch(() => setJobs([]));
  }, [open]);

  const applyParsedToReview = (p: ParsedResume) => {
    setReview({
      name: p.name || "",
      email: p.email || "",
      phone: p.phone || "",
      location: p.location || "",
      current_job_title: p.current_job_title || "",
      current_company: p.current_company || "",
      experience_years: p.experience_years != null ? String(p.experience_years) : "",
      skills: p.skills?.join(", ") || "",
      linkedin_url: p.linkedin_url || "",
      notes: "",
    });
  };

  const createCandidate = async (data: ParsedResume, file: File) => {
    const fd = buildFormData(data, file);
    if (!data.email) {
      fd.set("email", review.email);
      fd.set("name", review.name || data.name || "Unknown");
    }
    const res = await api.post<ApiResponse<{ id: number }>>("/candidates", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const candidateId = res.data.data.id;

    if (selectedJob) {
      await api.post(`/candidates/${candidateId}/assign-job`, { job_id: Number(selectedJob) });
    }

    if (defaultFolderId) {
      await api.post(`/folders/${defaultFolderId}/candidates`, { candidate_ids: [candidateId] });
    }

    return candidateId;
  };

  const processResumeFile = async (file: File) => {
    setProcessing(true);
    setProcessStep(0);
    setProcessingFileName(file.name);
    setCvFile(file);
    try {
      const p = await runWithProcessingSteps(
        RESUME_PROCESS_STEPS,
        (i) => setProcessStep(i),
        async () => {
          const fd = new FormData();
          fd.append("cv_file", file);
          const res = await api.post<ApiResponse<ParsedResume>>("/candidates/parse-resume", fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return res.data.data;
        },
      );

      setParsed(p);
      applyParsedToReview(p);

      if (!p.email || !p.name) {
        setStep("review");
        toast("Some fields missing — please review and save", { icon: "ℹ️" });
        return;
      }

      const id = await createCandidate(p, file);
      toast.success("Candidate created from resume");
      onCreated();
      handleClose();
      if (defaultFolderId) {
        router.push(`/candidates/folders/${defaultFolderId}`);
      } else {
        router.push(`/candidates/${id}?tab=social`);
      }
    } catch {
      toast.error("Failed to process resume");
    } finally {
      setProcessing(false);
    }
  };

  const handleReviewSubmit = async () => {
    if (!review.name.trim()) { toast.error("Name is required"); return; }
    if (!review.email.trim()) { toast.error("Email is required"); return; }
    if (!cvFile) { toast.error("Resume file missing"); return; }

    setProcessing(true);
    try {
      const data: ParsedResume = {
        ...parsed,
        name: review.name,
        email: review.email,
        phone: review.phone || undefined,
        location: review.location || undefined,
        current_job_title: review.current_job_title || undefined,
        current_company: review.current_company || undefined,
        experience_years: review.experience_years ? Number(review.experience_years) : undefined,
        skills: review.skills ? review.skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        linkedin_url: review.linkedin_url || undefined,
      };
      const fd = buildFormData(data, cvFile);
      if (review.notes) fd.append("notes", review.notes);
      const res = await api.post<ApiResponse<{ id: number }>>("/candidates", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const candidateId = res.data.data.id;
      if (selectedJob) {
        await api.post(`/candidates/${candidateId}/assign-job`, { job_id: Number(selectedJob) });
      }
      if (defaultFolderId) {
        await api.post(`/folders/${defaultFolderId}/candidates`, { candidate_ids: [candidateId] });
      }
      toast.success("Candidate created");
      onCreated();
      handleClose();
      if (defaultFolderId) {
        router.push(`/candidates/folders/${defaultFolderId}`);
      } else {
        router.push(`/candidates/${candidateId}?tab=resume`);
      }
    } catch {
      toast.error("Failed to create candidate");
    } finally {
      setProcessing(false);
    }
  };

  const handleMenuClick = (id: string) => {
    if (id === "form") {
      handleClose();
      router.push("/candidates/new");
      return;
    }
    if (id === "upload") {
      setStep("upload");
      return;
    }
    if (id === "multi") {
      multiRef.current?.click();
      return;
    }
    if (id === "import") {
      toast("JSON/CSV import coming soon", { icon: "ℹ️" });
    }
  };

  const handleMultiFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setProcessing(true);
    let created = 0;
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("cv_file", file);
        const res = await api.post<ApiResponse<ParsedResume>>("/candidates/parse-resume", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const p = res.data.data;
        if (!p.email || !p.name) continue;
        await createCandidate(p, file);
        created++;
      } catch { /* skip failed */ }
    }
    setProcessing(false);
    if (created) {
      toast.success(`${created} candidate(s) created`);
      onCreated();
      handleClose();
    } else {
      toast.error("Could not create candidates from files");
    }
  };

  const title = step === "menu" ? "Create Candidate" : step === "upload" ? "Create Candidate" : "Review Candidate Details";

  return (
    <>
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.rtf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processResumeFile(f); e.target.value = ""; }} />
      <input ref={multiRef} type="file" accept=".pdf,.doc,.docx,.rtf" multiple className="hidden"
        onChange={(e) => { handleMultiFiles(e.target.files); e.target.value = ""; }} />

      <AnimatedModal open={open} onClose={handleClose} title={title} size={step === "menu" ? "lg" : "lg"}>
        {step === "menu" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MENU_OPTIONS.map(({ id, label, icon: Icon, iconClass, bg }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleMenuClick(id)}
                className="flex flex-col items-center justify-center gap-4 p-8 border border-gray-200 rounded-xl hover:border-primary/40 hover:shadow-md transition-all bg-white min-h-[180px] group"
              >
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", bg)}>
                  <Icon className={cn("h-8 w-8", iconClass)} />
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-primary">{label}</span>
              </button>
            ))}
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">
              Select jobs and/or folders below to automatically add the candidate to jobs and folders.
            </p>

            <Select
              label="Select Jobs (Optional)"
              placeholder="Select Jobs (Optional)"
              options={jobs.map((j) => ({ value: String(j.id), label: `${j.title} — ${j.client_name || "Client"}` }))}
              value={selectedJob}
              onChange={(e) => setSelectedJob(e.target.value)}
            />

            <Select
              label="Select Folders (Optional)"
              placeholder="Select Folders (Optional)"
              options={[]}
              value=""
              onChange={() => {}}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) processResumeFile(f);
              }}
              className={cn(
                "border-2 border-dashed border-primary/20 rounded-xl bg-primary-50/40 p-10 text-center transition-colors",
                processing && "opacity-60 pointer-events-none"
              )}
            >
              {processing ? (
                <ResumeProcessingPanel
                  steps={RESUME_PROCESS_STEPS}
                  currentStep={processStep}
                  fileName={processingFileName}
                />
              ) : (
                <>
                  <CloudUpload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-primary mb-4">
                    Drop CV / resume here to upload or
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-700"
                  >
                    <Upload className="h-4 w-4" /> Select file to upload
                  </button>
                  <p className="text-xs text-gray-400 mt-4">
                    Supported file types (max 10MB): .pdf, .doc, .docx, .rtf
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("menu")}>Back</Button>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Resume parsed. Review the details below and click Create to add the candidate.
            </p>
            {cvFile && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">File: {cvFile.name}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="Full Name *" value={review.name} onChange={(e) => setReview({ ...review, name: e.target.value })} />
              <Input label="Email *" value={review.email} onChange={(e) => setReview({ ...review, email: e.target.value })} />
              <Input label="Phone" value={review.phone} onChange={(e) => setReview({ ...review, phone: e.target.value })} />
              <Input label="Location" value={review.location} onChange={(e) => setReview({ ...review, location: e.target.value })} />
              <Input label="Current Job Title" value={review.current_job_title} onChange={(e) => setReview({ ...review, current_job_title: e.target.value })} />
              <Input label="Current Company" value={review.current_company} onChange={(e) => setReview({ ...review, current_company: e.target.value })} />
              <Input label="Experience (years)" value={review.experience_years} onChange={(e) => setReview({ ...review, experience_years: e.target.value })} />
              <Input label="LinkedIn URL" value={review.linkedin_url} onChange={(e) => setReview({ ...review, linkedin_url: e.target.value })} />
            </div>
            <Input label="Skills" value={review.skills} onChange={(e) => setReview({ ...review, skills: e.target.value })} placeholder="React, Python, SQL" />
            <Textarea label="Notes" value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} />

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={handleReviewSubmit} loading={processing}>Create Candidate</Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </>
  );
}
