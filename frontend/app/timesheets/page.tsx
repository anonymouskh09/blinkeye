"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle, Send } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type {
  ApiResponse,
  Engagement,
  PaginatedData,
  TimesheetEntry,
} from "@/types";

function money(v?: string | number | null, currency = "USD") {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency })
    : String(v);
}

function statusClass(status?: string) {
  if (status === "approved") return "bg-emerald-50 text-emerald-700";
  if (status === "submitted") return "bg-sky-50 text-sky-700";
  if (status === "rejected") return "bg-rose-50 text-rose-700";
  return "bg-gray-100 text-gray-600";
}

export default function TimesheetsPage() {
  const { user, isAdmin } = useAuth();
  const canApprove = isAdmin || user?.role === "manager";
  const [data, setData] = useState<PaginatedData<TimesheetEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    engagement_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    hours: "8",
    description: "",
    submit: true,
  });

  const fetchTimesheets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<TimesheetEntry>>>("/timesheets", {
        params: {
          page,
          page_size: 50,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      setData(res.data.data);
      setSelected([]);
    } catch {
      toast.error("Failed to load timesheets");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  const fetchEngagements = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<PaginatedData<Engagement>>>("/engagements", {
        params: { page: 1, page_size: 100 },
      });
      const items = res.data.data?.items || [];
      setEngagements(
        items.filter((e) => e.billing_model === "hourly" || e.billing_model === "hybrid")
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchTimesheets();
  }, [fetchTimesheets]);

  useEffect(() => {
    fetchEngagements();
  }, [fetchEngagements]);

  const selectedRows = useMemo(
    () => (data?.items || []).filter((i) => selected.includes(i.id)),
    [data, selected]
  );

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const createEntry = async () => {
    if (!form.engagement_id || !form.work_date || !form.hours) {
      toast.error("Engagement, date, and hours are required");
      return;
    }
    setSaving(true);
    try {
      await api.post("/timesheets", {
        engagement_id: Number(form.engagement_id),
        work_date: form.work_date,
        hours: form.hours,
        description: form.description || undefined,
        submit: form.submit,
      });
      toast.success(form.submit ? "Time submitted" : "Time saved as draft");
      setCreateOpen(false);
      fetchTimesheets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create timesheet";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const submitSelected = async () => {
    const ids = selectedRows
      .filter((r) => r.status === "pending" || r.status === "rejected")
      .map((r) => r.id);
    if (!ids.length) {
      toast.error("Select pending/rejected entries to submit");
      return;
    }
    setSaving(true);
    try {
      await api.post("/timesheets/submit", { entry_ids: ids });
      toast.success("Submitted for approval");
      fetchTimesheets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Submit failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const approveSelected = async () => {
    const ids = selectedRows.filter((r) => r.status === "submitted").map((r) => r.id);
    if (!ids.length) {
      toast.error("Select submitted entries to approve");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<
        ApiResponse<{ billable_item: { amount: string | number; quantity: string | number } }>
      >("/timesheets/approve", { entry_ids: ids });
      const b = res.data.data.billable_item;
      toast.success(`Approved — billable ${money(b.amount)} (${b.quantity}h)`);
      fetchTimesheets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Approve failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const rejectSelected = async () => {
    const ids = selectedRows.filter((r) => r.status === "submitted").map((r) => r.id);
    if (!ids.length) {
      toast.error("Select submitted entries to reject");
      return;
    }
    setSaving(true);
    try {
      await api.post("/timesheets/reject", { entry_ids: ids });
      toast.success("Rejected");
      fetchTimesheets();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Reject failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <Header
        title="Timesheets"
        subtitle="Log recruiting hours, submit for approval, and create hourly billables"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Clock className="h-4 w-4" />
            Log time
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            options={[
              { value: "", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "submitted", label: "Submitted" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ]}
          />
        </div>
        <Button variant="secondary" disabled={!selected.length || saving} onClick={submitSelected}>
          <Send className="h-4 w-4" />
          Submit
        </Button>
        {canApprove && (
          <>
            <Button variant="secondary" disabled={!selected.length || saving} onClick={approveSelected}>
              <CheckCircle2 className="h-4 w-4" />
              Approve & bill
            </Button>
            <Button variant="secondary" disabled={!selected.length || saving} onClick={rejectSelected}>
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <CardSkeleton />
      ) : !data?.items?.length ? (
        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          title="No timesheet entries"
          description="Log hours against an hourly or hybrid engagement to start billing."
        />
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>
                  <input
                    type="checkbox"
                    checked={selected.length > 0 && selected.length === data.items.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? data.items.map((i) => i.id) : [])
                    }
                  />
                </Th>
                <Th>Date</Th>
                <Th>Client / Engagement</Th>
                <Th>Recruiter</Th>
                <Th>Hours</Th>
                <Th>Rate</Th>
                <Th>Status</Th>
                <Th>Billable</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </Td>
                  <Td>{formatDate(row.work_date)}</Td>
                  <Td>
                    <div className="font-medium text-gray-900">{row.client_name || "—"}</div>
                    <div className="text-xs text-gray-500">{row.engagement_name}</div>
                    {row.job_title && <div className="text-xs text-gray-400">{row.job_title}</div>}
                  </Td>
                  <Td>{row.recruiter_name || "—"}</Td>
                  <Td>{Number(row.hours)}</Td>
                  <Td>{money(row.hourly_rate)}</Td>
                  <Td>
                    <Badge className={statusClass(row.status)}>{row.status}</Badge>
                  </Td>
                  <Td>
                    {row.billable_item_id ? (
                      <span className="text-emerald-700">#{row.billable_item_id}</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={data.page} totalPages={data.total_pages} onPageChange={setPage} />
        </>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Log time">
        <div className="space-y-4">
          <Select
            label="Engagement"
            value={form.engagement_id}
            onChange={(e) => setForm((f) => ({ ...f, engagement_id: e.target.value }))}
            options={[
              { value: "", label: "Select hourly/hybrid engagement" },
              ...engagements.map((e) => ({
                value: String(e.id),
                label: `${e.client_name ? `${e.client_name} — ` : ""}${e.engagement_name} (${e.billing_model})`,
              })),
            ]}
          />
          <Input
            label="Work date"
            type="date"
            value={form.work_date}
            onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
          />
          <Input
            label="Hours"
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={form.hours}
            onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.submit}
              onChange={(e) => setForm((f) => ({ ...f, submit: e.target.checked }))}
            />
            Submit immediately for approval
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createEntry} disabled={saving}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
