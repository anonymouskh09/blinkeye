"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { Plus, MoreVertical, Pencil, Power, Trash2, Shield } from "lucide-react";
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
import TeamPermissionMatrix, {
  DEFAULT_PERMISSIONS,
  type PermissionFlags,
} from "@/components/team/TeamPermissionMatrix";
import { useAuth, useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import type { ApiResponse, User, PaginatedData, UserRole } from "@/types";

const ROLE_OPTIONS = [
  { value: "recruiter", label: "Recruiter" },
  { value: "manager", label: "Manager" },
  { value: "admin", label: "Admin" },
];

const emptyAddForm = {
  name: "",
  email: "",
  password: "",
  role: "recruiter",
  ...DEFAULT_PERMISSIONS,
};

function permsFromUser(user: User): PermissionFlags {
  return {
    can_view_clients: user.can_view_clients ?? true,
    can_add_clients: user.can_add_clients ?? true,
    can_edit_clients: user.can_edit_clients ?? true,
    can_view_jobs: user.can_view_jobs ?? true,
    can_add_jobs: user.can_add_jobs ?? true,
    can_edit_jobs: user.can_edit_jobs ?? true,
    can_view_candidates: user.can_view_candidates ?? true,
    can_add_candidates: user.can_add_candidates ?? true,
    can_edit_candidates: user.can_edit_candidates ?? true,
  };
}

export default function TeamPage() {
  useRequireRole("admin");
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<PaginatedData<User> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permsUser, setPermsUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyAddForm);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "recruiter" as UserRole,
    password: "",
    ...DEFAULT_PERMISSIONS,
  });
  const [permsForm, setPermsForm] = useState<PermissionFlags>({ ...DEFAULT_PERMISSIONS });
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

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

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
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      password: "",
      ...permsFromUser(user),
    });
    setEditOpen(true);
    setMenuId(null);
  };

  const openPermissions = (user: User) => {
    if (user.role === "admin") {
      toast.error("Admins always have full access");
      setMenuId(null);
      return;
    }
    setPermsUser(user);
    setPermsForm(permsFromUser(user));
    setPermsOpen(true);
    setMenuId(null);
  };

  const handleSavePermissions = async () => {
    if (!permsUser) return;
    setSaving(true);
    try {
      await api.put(`/users/${permsUser.id}`, { ...permsForm });
      toast.success("Permissions updated");
      setPermsOpen(false);
      setPermsUser(null);
      fetchTeam();
    } catch {
      toast.error("Failed to update permissions");
    } finally {
      setSaving(false);
    }
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
      const payload: Record<string, string | boolean> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        can_view_clients: editForm.can_view_clients,
        can_add_clients: editForm.can_add_clients,
        can_edit_clients: editForm.can_edit_clients,
        can_view_jobs: editForm.can_view_jobs,
        can_add_jobs: editForm.can_add_jobs,
        can_edit_jobs: editForm.can_edit_jobs,
        can_view_candidates: editForm.can_view_candidates,
        can_add_candidates: editForm.can_add_candidates,
        can_edit_candidates: editForm.can_edit_candidates,
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
    if (!confirm(`Archive ${user.name}? You can restore them later from Archive.`)) return;
    try {
      await api.delete(`/users/${user.id}`);
      toast.success("Team member archived");
      fetchTeam();
    } catch {
      toast.error("Failed to archive team member");
    }
  };

  const formPerms: PermissionFlags = {
    can_view_clients: form.can_view_clients,
    can_add_clients: form.can_add_clients,
    can_edit_clients: form.can_edit_clients,
    can_view_jobs: form.can_view_jobs,
    can_add_jobs: form.can_add_jobs,
    can_edit_jobs: form.can_edit_jobs,
    can_view_candidates: form.can_view_candidates,
    can_add_candidates: form.can_add_candidates,
    can_edit_candidates: form.can_edit_candidates,
  };

  const editPerms: PermissionFlags = {
    can_view_clients: editForm.can_view_clients,
    can_add_clients: editForm.can_add_clients,
    can_edit_clients: editForm.can_edit_clients,
    can_view_jobs: editForm.can_view_jobs,
    can_add_jobs: editForm.can_add_jobs,
    can_edit_jobs: editForm.can_edit_jobs,
    can_view_candidates: editForm.can_view_candidates,
    can_add_candidates: editForm.can_add_candidates,
    can_edit_candidates: editForm.can_edit_candidates,
  };

  return (
    <PageWrapper>
      <Header
        title="Team"
        subtitle="Manage recruiters, managers and permissions"
        actions={
          <Button
            onClick={() => {
              setForm(emptyAddForm);
              setAddOpen(true);
            }}
          >
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
                            onClick={() => openPermissions(u)}
                            disabled={u.role === "admin"}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Shield className="h-4 w-4 text-gray-500" />
                            Permissions
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
                            Archive
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Team Member" size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            label="Temporary Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          {form.role !== "admin" && (
            <TeamPermissionMatrix
              value={formPerms}
              onChange={(perms) => setForm({ ...form, ...perms })}
            />
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleAdd} loading={saving}>
              Add Member
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Team Member" size="lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input
            label="Email"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
          />
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
          {editForm.role !== "admin" && (
            <TeamPermissionMatrix
              value={editPerms}
              onChange={(perms) => setEditForm({ ...editForm, ...perms })}
            />
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleEdit} loading={saving}>
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={permsOpen}
        onClose={() => {
          setPermsOpen(false);
          setPermsUser(null);
        }}
        title={permsUser ? `Permissions — ${permsUser.name}` : "Permissions"}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Update what this member can view, add, and edit. Changes apply immediately after save.
          </p>
          <TeamPermissionMatrix value={permsForm} onChange={setPermsForm} />
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSavePermissions} loading={saving}>
              Save Permissions
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setPermsOpen(false);
                setPermsUser(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
