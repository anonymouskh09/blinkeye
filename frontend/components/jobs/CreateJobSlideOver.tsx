"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import SlideOver from "@/components/ui/SlideOver";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import api from "@/lib/api";
import type { ApiResponse, Client, Engagement, PaginatedData, User } from "@/types";
import { BILLING_MODEL_LABELS, SERVICE_MODEL_LABELS } from "@/types";

const schema = z.object({
  title: z.string().min(1, "Required"),
  client_id: z.string().min(1, "Required"),
  engagement_id: z.string().optional(),
  location: z.string().optional(),
  job_type: z.enum(["full-time", "part-time", "contract"]),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
  required_skills: z.string().optional(),
  experience_required: z.string().optional(),
  description: z.string().optional(),
  number_of_positions: z.string().min(1, "Required"),
  assigned_recruiter_id: z.string().optional(),
  status: z.enum(["active", "pending", "on-hold", "closed", "filled"]),
});

type FormData = z.infer<typeof schema>;

interface CreateJobSlideOverProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
  prefillClientId?: string;
  prefillEngagementId?: string;
  prefillRecruiterId?: string;
}

export default function CreateJobSlideOver({
  open,
  onClose,
  onCreated,
  prefillClientId = "",
  prefillEngagementId = "",
  prefillRecruiterId = "",
}: CreateJobSlideOverProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [recruiters, setRecruiters] = useState<User[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingEngagements, setLoadingEngagements] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      job_type: "full-time",
      status: "active",
      number_of_positions: "1",
      client_id: "",
      engagement_id: "",
      title: "",
      location: "",
      salary_min: "",
      salary_max: "",
      required_skills: "",
      experience_required: "",
      description: "",
      assigned_recruiter_id: "",
    },
  });

  const selectedClientId = watch("client_id");
  const selectedEngagementId = watch("engagement_id");

  useEffect(() => {
    if (!open) return;
    reset({
      job_type: "full-time",
      status: "active",
      number_of_positions: "1",
      client_id: prefillClientId,
      engagement_id: prefillEngagementId,
      title: "",
      location: "",
      salary_min: "",
      salary_max: "",
      required_skills: "",
      experience_required: "",
      description: "",
      assigned_recruiter_id: prefillRecruiterId,
    });
    Promise.all([
      api.get<ApiResponse<PaginatedData<Client>>>("/clients", {
        params: { page_size: 100, status: "active" },
      }),
      api.get<ApiResponse<PaginatedData<User>>>("/users", {
        params: { page_size: 100, status: "active" },
      }),
    ]).then(([c, u]) => {
      setClients(c.data.data.items);
      setRecruiters(
        u.data.data.items.filter((x) => ["recruiter", "manager", "admin"].includes(x.role))
      );
    });
  }, [open, prefillClientId, prefillEngagementId, prefillRecruiterId, reset]);

  useEffect(() => {
    if (!open || !selectedClientId) {
      setEngagements([]);
      return;
    }
    setLoadingEngagements(true);
    api
      .get<ApiResponse<PaginatedData<Engagement>>>("/engagements", {
        params: { client_id: selectedClientId, page_size: 100 },
      })
      .then((res) => {
        const items = res.data.data.items || [];
        setEngagements(items);
        const stillValid = items.some((e) => String(e.id) === selectedEngagementId);
        if (!stillValid) {
          const prefillOk =
            prefillEngagementId && items.some((e) => String(e.id) === prefillEngagementId);
          setValue("engagement_id", prefillOk ? prefillEngagementId : "");
        }
      })
      .catch(() => {
        setEngagements([]);
        toast.error("Failed to load engagements for this client");
      })
      .finally(() => setLoadingEngagements(false));
  }, [open, selectedClientId, selectedEngagementId, setValue, prefillEngagementId]);

  const selectedEngagement = useMemo(
    () => engagements.find((e) => String(e.id) === selectedEngagementId),
    [engagements, selectedEngagementId]
  );

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/jobs", {
        ...data,
        client_id: Number(data.client_id),
        engagement_id: data.engagement_id ? Number(data.engagement_id) : null,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        number_of_positions: Number(data.number_of_positions),
        assigned_recruiter_id: data.assigned_recruiter_id
          ? Number(data.assigned_recruiter_id)
          : null,
      });
      toast.success("Job created");
      onClose();
      onCreated?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create job";
      toast.error(message);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Create Job"
      subtitle="Link to a client — engagement is optional"
      width="xl"
      footer={
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-job-form" loading={isSubmitting}>
            Create Job
          </Button>
        </div>
      }
    >
      <form id="create-job-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Job Title *" error={errors.title?.message} {...register("title")} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Client *"
            placeholder="Select client"
            options={clients.map((c) => ({ value: String(c.id), label: c.company_name }))}
            error={errors.client_id?.message}
            {...register("client_id")}
          />
          <Select
            label="Engagement (optional)"
            placeholder={
              !selectedClientId
                ? "Select a client first"
                : loadingEngagements
                  ? "Loading engagements..."
                  : engagements.length
                    ? "None — optional"
                    : "No engagements yet (optional)"
            }
            disabled={!selectedClientId || loadingEngagements}
            options={[
              { value: "", label: "None" },
              ...engagements.map((e) => ({
                value: String(e.id),
                label: `${e.engagement_name} (${e.status})`,
              })),
            ]}
            error={errors.engagement_id?.message}
            {...register("engagement_id")}
          />
        </div>

        {selectedEngagement && (
          <div className="rounded-lg border border-primary/20 bg-primary-50/50 px-3 py-2 text-xs text-slate-700">
            <span className="font-semibold text-primary">Service:</span>{" "}
            {SERVICE_MODEL_LABELS[selectedEngagement.service_model]}
            {" · "}
            <span className="font-semibold text-primary">Billing:</span>{" "}
            {BILLING_MODEL_LABELS[selectedEngagement.billing_model]}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Location" {...register("location")} />
          <Select
            label="Job Type"
            options={[
              { value: "full-time", label: "Full Time" },
              { value: "part-time", label: "Part Time" },
              { value: "contract", label: "Contract" },
            ]}
            {...register("job_type")}
          />
          <Select
            label="Status"
            options={[
              { value: "active", label: "Active" },
              { value: "pending", label: "Pending" },
              { value: "on-hold", label: "On Hold" },
            ]}
            {...register("status")}
          />
          <Input label="Salary Min" type="number" {...register("salary_min")} />
          <Input label="Salary Max" type="number" {...register("salary_max")} />
          <Input label="Experience Required" {...register("experience_required")} />
          <Input label="Number of Positions" type="number" {...register("number_of_positions")} />
          <Select
            label="Assign Recruiter"
            placeholder="Select recruiter"
            options={recruiters.map((r) => ({ value: String(r.id), label: r.name }))}
            {...register("assigned_recruiter_id")}
          />
        </div>

        <Textarea label="Required Skills" {...register("required_skills")} />
        <Textarea label="Description" {...register("description")} />
      </form>
    </SlideOver>
  );
}
