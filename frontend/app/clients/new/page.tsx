"use client";

import { useRouter } from "next/navigation";
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

const schema = z.object({
  company_name: z.string().min(1, "Required"),
  contact_person: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  industry: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

type FormData = z.infer<typeof schema>;

export default function NewClientPage() {
  useRequireRole("admin");
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active" },
  });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post("/clients", data);
      toast.success("Client created");
      router.push(`/clients/${res.data.data.id}`);
    } catch {
      toast.error("Failed to create client");
    }
  };

  return (
    <PageWrapper>
      <Header title="Add Client" subtitle="Create a new client company" />
      <Card className="max-w-2xl">
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Company Name *" error={errors.company_name?.message} {...register("company_name")} />
              <Input label="Contact Person *" error={errors.contact_person?.message} {...register("contact_person")} />
              <Input label="Email *" type="email" error={errors.email?.message} {...register("email")} />
              <Input label="Phone *" error={errors.phone?.message} {...register("phone")} />
              <Input label="Industry" {...register("industry")} />
              <Input label="Location" {...register("location")} />
              <Input label="Website" {...register("website")} />
              <Select label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]}
                {...register("status")} />
            </div>
            <Textarea label="Notes" {...register("notes")} />
            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={isSubmitting}>Create Client</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
