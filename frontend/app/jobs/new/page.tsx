"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Card, { CardBody } from "@/components/ui/Card";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse, Client, User, PaginatedData } from "@/types";

const schema = z.object({
  title: z.string().min(1, "Required"),
  client_id: z.string().min(1, "Required"),
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

function NewJobForm() {
  useRequireRole("admin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillClientId = searchParams.get("client_id") || "";
  const [clients, setClients] = useState<Client[]>([]);
  const [recruiters, setRecruiters] = useState<User[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { job_type: "full-time", status: "active", number_of_positions: "1", client_id: prefillClientId },
  });

  useEffect(() => {
    Promise.all([
      api.get<ApiResponse<PaginatedData<Client>>>("/clients", { params: { page_size: 100, status: "active" } }),
      api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, role: "recruiter", status: "active" } }),
    ]).then(([c, u]) => {
      setClients(c.data.data.items);
      setRecruiters(u.data.data.items);
      if (prefillClientId) setValue("client_id", prefillClientId);
    });
  }, [prefillClientId, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.post("/jobs", {
        ...data,
        client_id: Number(data.client_id),
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        number_of_positions: Number(data.number_of_positions),
        assigned_recruiter_id: data.assigned_recruiter_id ? Number(data.assigned_recruiter_id) : null,
      });
      toast.success("Job created");
      router.push("/jobs");
    } catch {
      toast.error("Failed to create job");
    }
  };

  return (
    <PageWrapper>
      <Header title="Create Job" subtitle="Add a new job posting" />
      <Card className="max-w-3xl">
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Job Title *" error={errors.title?.message} {...register("title")} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Client *" placeholder="Select client"
                options={clients.map((c) => ({ value: String(c.id), label: c.company_name }))}
                error={errors.client_id?.message} {...register("client_id")} />
              <Input label="Location" {...register("location")} />
              <Select label="Job Type" options={[
                { value: "full-time", label: "Full Time" }, { value: "part-time", label: "Part Time" },
                { value: "contract", label: "Contract" },
              ]} {...register("job_type")} />
              <Select label="Status" options={[
                { value: "active", label: "Active" }, { value: "pending", label: "Pending" },
                { value: "on-hold", label: "On Hold" },
              ]} {...register("status")} />
              <Input label="Salary Min" type="number" {...register("salary_min")} />
              <Input label="Salary Max" type="number" {...register("salary_max")} />
              <Input label="Experience Required" {...register("experience_required")} />
              <Input label="Number of Positions" type="number" {...register("number_of_positions")} />
              <Select label="Assign Recruiter" placeholder="Select recruiter"
                options={recruiters.map((r) => ({ value: String(r.id), label: r.name }))}
                {...register("assigned_recruiter_id")} />
            </div>
            <Textarea label="Required Skills" {...register("required_skills")} />
            <Textarea label="Description" {...register("description")} />
            <div className="flex gap-3">
              <Button type="submit" loading={isSubmitting}>Create Job</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<PageWrapper><div className="p-8 text-gray-500">Loading...</div></PageWrapper>}>
      <NewJobForm />
    </Suspense>
  );
}
