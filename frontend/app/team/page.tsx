"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse, User, PaginatedData } from "@/types";

export default function TeamPage() {
  useRequireRole("admin");
  const [data, setData] = useState<PaginatedData<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "recruiter" });
  const [saving, setSaving] = useState(false);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<User>>>("/users", { params: { page, page_size: 20 } });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", form);
      toast.success("Team member added");
      setAddOpen(false);
      setForm({ name: "", email: "", password: "", phone: "", role: "recruiter" });
      fetchTeam();
    } catch {
      toast.error("Failed to add team member");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { status: user.status === "active" ? "inactive" : "active" });
      toast.success("Status updated");
      fetchTeam();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <PageWrapper>
      <Header title="Team" subtitle="Manage recruiters and admins"
        actions={<Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Member</Button>} />

      {loading ? <TableSkeleton rows={8} cols={6} /> : !data?.items?.length ? (
        <EmptyState title="No team members" actionLabel="Add Member" onAction={() => setAddOpen(true)} />
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th>Role</Th><Th>Status</Th><Th>Jobs</Th><Th>Actions</Th></tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <Tr key={u.id}>
                  <Td><span className="font-medium">{u.name}</span></Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone || "—"}</Td>
                  <Td className="capitalize">{u.role}</Td>
                  <Td>
                    <Badge className={u.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {u.status}
                    </Badge>
                  </Td>
                  <Td>{u.assigned_jobs_count ?? 0}</Td>
                  <Td>
                    <button onClick={() => toggleStatus(u)} className="text-primary hover:underline text-sm">
                      {u.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Team Member">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Temporary Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select label="Role" options={[
            { value: "recruiter", label: "Recruiter" }, { value: "admin", label: "Admin" },
          ]} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={handleAdd} loading={saving}>Add Member</Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
