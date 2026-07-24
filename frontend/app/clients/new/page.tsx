"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Card, { CardBody } from "@/components/ui/Card";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse, PaginatedData, User } from "@/types";

export default function NewClientPage() {
  useRequireRole("admin");
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [teamUserId, setTeamUserId] = useState("");
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page_size: 100, status: "active" } })
      .then((res) => setTeamUsers(res.data.data.items))
      .catch(() => toast.error("Failed to load team members"))
      .finally(() => setLoadingTeam(false));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      toast.error("Client name is required");
      return;
    }
    if (!teamUserId) {
      toast.error("Select a team member");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/clients", {
        company_name: companyName.trim(),
        team_user_ids: [Number(teamUserId)],
      });
      toast.success("Client created");
      router.push(`/clients/${res.data.data.id}`);
    } catch {
      toast.error("Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <Header title="Add Client" subtitle="Create a new client company" />
      <Card className="max-w-xl">
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-5">
            <Input
              label="Client Name *"
              value={companyName}
              placeholder="Enter client company name"
              onChange={(e) => setCompanyName(e.target.value)}
            />

            <Select
              label="Team *"
              placeholder={loadingTeam ? "Loading team members..." : "Select team member"}
              disabled={loadingTeam || !teamUsers.length}
              options={teamUsers.map((u) => ({
                value: String(u.id),
                label: `${u.name} (${u.role})`,
              }))}
              value={teamUserId}
              onChange={(e) => setTeamUserId(e.target.value)}
            />

            <div className="flex gap-3 pt-1">
              <Button type="submit" loading={saving}>Create</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </PageWrapper>
  );
}
