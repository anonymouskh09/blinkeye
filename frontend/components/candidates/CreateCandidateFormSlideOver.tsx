"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import FileUpload from "@/components/ui/FileUpload";
import api from "@/lib/api";
import type { ApiResponse, ParsedResume } from "@/types";

const schema = z.object({
  name: z.string().min(1, "Required"),
  email: z.union([z.literal(""), z.string().email("Invalid email")]).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  current_job_title: z.string().optional(),
  current_company: z.string().optional(),
  experience_years: z.string().optional(),
  skills: z.string().optional(),
  expected_salary: z.string().optional(),
  notice_period: z.string().optional(),
  linkedin_url: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateCandidateFormSlideOverProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (candidateId: number) => void;
  defaultFolderId?: number;
  assignJobId?: number | null;
}

export default function CreateCandidateFormSlideOver({
  open,
  onClose,
  onCreated,
  defaultFolderId,
  assignJobId,
}: CreateCandidateFormSlideOverProps) {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      location: "",
      current_job_title: "",
      current_company: "",
      experience_years: "",
      skills: "",
      expected_salary: "",
      notice_period: "",
      linkedin_url: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset();
    setCvFile(null);
    setParsing(false);
  }, [open, reset]);

  const handleCvChange = async (file: File | null) => {
    setCvFile(file);
    if (!file) return;
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("cv_file", file);
      const res = await api.post<ApiResponse<ParsedResume>>("/candidates/parse-resume", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const p = res.data.data;
      if (p.name) setValue("name", p.name);
      if (p.email) setValue("email", p.email);
      if (p.phone) setValue("phone", p.phone);
      if (p.location) setValue("location", p.location);
      if (p.current_job_title) setValue("current_job_title", p.current_job_title);
      if (p.current_company) setValue("current_company", p.current_company);
      if (p.experience_years != null) setValue("experience_years", String(p.experience_years));
      if (p.skills?.length) setValue("skills", p.skills.join(", "));
      if (p.linkedin_url) setValue("linkedin_url", p.linkedin_url);
      toast.success("Resume parsed — fields auto-filled");
    } catch {
      toast.error("Could not parse resume — fill fields manually");
    } finally {
      setParsing(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v != null && v !== "") formData.append(k, String(v));
      });
      if (cvFile) formData.append("cv_file", cvFile);
      const res = await api.post<ApiResponse<{ id: number }>>("/candidates", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const candidateId = res.data.data.id;

      if (assignJobId) {
        await api.post(`/candidates/${candidateId}/assign-job`, { job_id: assignJobId });
      }
      if (defaultFolderId) {
        await api.post(`/folders/${defaultFolderId}/candidates`, {
          candidate_ids: [candidateId],
        });
      }

      toast.success("Candidate created");
      onClose();
      onCreated?.(candidateId);
    } catch {
      toast.error("Failed to create candidate");
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Create Candidate"
      subtitle="Fill in candidate details — upload a resume to auto-fill fields"
      width="xl"
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-candidate-form" loading={isSubmitting}>
            Create Candidate
          </Button>
        </div>
      }
    >
      <form id="create-candidate-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FileUpload onChange={handleCvChange} value={cvFile} />
        {parsing && <p className="text-sm text-primary">Reading resume...</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name *" error={errors.name?.message} {...register("name")} />
          <Input
            label="Email"
            type="email"
            error={errors.email?.message}
            {...register("email")}
          />
          <Input label="Phone" {...register("phone")} />
          <Input label="Location" {...register("location")} />
          <Input label="Current Job Title" {...register("current_job_title")} />
          <Input label="Current Company" {...register("current_company")} />
          <Input label="Experience (years)" type="number" {...register("experience_years")} />
          <Input label="Expected Salary" type="number" {...register("expected_salary")} />
          <Input label="Notice Period" {...register("notice_period")} />
          <Input label="LinkedIn URL" {...register("linkedin_url")} />
        </div>
        <Input
          label="Skills (comma separated)"
          placeholder="React, Python, SQL"
          {...register("skills")}
        />
        <Textarea label="Notes" {...register("notes")} />
      </form>
    </SlideOver>
  );
}
