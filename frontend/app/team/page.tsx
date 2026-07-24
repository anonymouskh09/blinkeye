"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, MoreVertical, Pencil, Power, Trash2 } from "lucide-react";
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
import { useAuth, useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse, User, PaginatedData, UserRole } from "@/types";

const ROLE_OPTIONS = [
  { value: "recruiter", label: "Recruiter" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const emptyAddForm = { name: "", email: "", password: "", role: "recruiter" };

export default function TeamPage() {
  useRequireRole("admin");
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<PaginatedData<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "recruiter" as UserRole, password: "" });
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
      setForm(emptyAddForm);
      fetchTeam();
    } catch {
      toast.error("Failed to add team member");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role, password: "" });
    setEditOpen(true);
    setMenuId(null);
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
      };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await api.put(`/users/${editingUser.id}`, payload);
      toast.success("Team member updated");
      setEditOpen(false);
      setEditingUser(null);
      fetchTeam();
    } catch {
      toast.error("Failed to update team member");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot change your own status");
      return;
    }
    setMenuId(null);
    try {
      await api.put(`/users/${user.id}`, { status: user.status === "active" ? "inactive" : "active" });
      toast.success(user.status === "active" ? "Member deactivated" : "Member activated");
      fetchTeam();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    setMenuId(null);
    if (!confirm(`Delete ${user.name}? This will deactivate their account.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success("Team member deleted");
      fetchTeam();
    } catch {
      toast.error("Failed to delete team member");
    }
  };

  return (
    <PageWrapper>
      <Header
        title="Team"
        subtitle="Manage recruiters, managers and admins"
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Member
          </Button>
        }
      />

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : !data?.items?.length ? (
        <EmptyState title="No team members" actionLabel="Add Member" onAction={() => setAddOpen(true)} />
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u) => (
                <Tr key={u.id} className="group">
                  <Td>
                    <Link href={`/team/${u.id}`} className="font-medium text-[#111827] transition hover:text-primary">
                      {u.name}
                    </Link>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td className="capitalize">{u.role}</Td>
                  <Td>
                    <Badge className={u.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                      {u.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <div className="relative inline-block" ref={menuId === u.id ? menuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setMenuId(menuId === u.id ? null : u.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {menuId === u.id && (
                        <div className="absolute right-0 top-9 z-30 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50"
                          >
                            <Pencil className="h-4 w-4 text-gray-500" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleStatus(u)}
                            disabled={u.id === currentUser?.id}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Power className="h-4 w-4 text-gray-500" />
                            {u.status === "active" ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={u.id === currentUser?.id}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
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
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <div className="flex gap-3">
            <Button onClick={handleAdd} loading={saving}>Add Member</Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Team Member">
        <div className="space-y-4">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
          />
          <Input
            label="New Password (optional)"
            type="password"
            value={editForm.password}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            placeholder="Leave blank to keep current password"
          />
          <div className="flex gap-3">
            <Button onClick={handleEdit} loading={saving}>Save Changes</Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
