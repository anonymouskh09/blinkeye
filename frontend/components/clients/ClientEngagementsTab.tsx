"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Briefcase, Pencil, Plus } from "lucide-react";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ApiResponse,
  BillingModel,
  Engagement,
  EngagementStatus,
  ServiceModel,
  User,
} from "@/types";
import {
  BILLING_MODEL_LABELS,
  CUSTOM_RESPONSIBILITY_OPTIONS,
  ENGAGEMENT_STATUS_LABELS,
  SERVICE_MODEL_LABELS,
} from "@/types";

interface Props {
  clientId: string;
  engagements: Engagement[];
  users: User[];
  onRefresh: () => void;
}

type FormState = {
  engagement_name: string;
  start_date: string;
  end_date: string;
  status: EngagementStatus;
  service_model: ServiceModel;
  billing_model: BillingModel;
  currency: string;
  rate: string;
  hourly_rate: string;
  billing_period: string;
  monthly_fee: string;
  included_hours: string;
  additional_hourly_rate: string;
  placement_fee_percent: string;
  flat_placement_fee: string;
  guarantee_period_days: string;
  payment_terms: string;
  contract_reference: string;
  notes: string;
  sla: string;
  target_kpis: string;
  custom_responsibilities: string[];
  assigned_recruiter_id: string;
};

const emptyForm = (): FormState => ({
  engagement_name: "",
  start_date: "",
  end_date: "",
  status: "active",
  service_model: "full_cycle",
  billing_model: "success_based",
  currency: "USD",
  rate: "",
  hourly_rate: "",
  billing_period: "monthly",
  monthly_fee: "",
  included_hours: "",
  additional_hourly_rate: "",
  placement_fee_percent: "",
  flat_placement_fee: "",
  guarantee_period_days: "",
  payment_terms: "",
  contract_reference: "",
  notes: "",
  sla: "",
  target_kpis: "",
  custom_responsibilities: [],
  assigned_recruiter_id: "",
});

function numOrNull(v: string) {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function engagementToForm(e: Engagement): FormState {
  return {
    engagement_name: e.engagement_name || "",
    start_date: e.start_date ? String(e.start_date).slice(0, 10) : "",
    end_date: e.end_date ? String(e.end_date).slice(0, 10) : "",
    status: e.status,
    service_model: e.service_model,
    billing_model: e.billing_model,
    currency: e.currency || "USD",
    rate: e.rate != null ? String(e.rate) : "",
    hourly_rate: e.hourly_rate != null ? String(e.hourly_rate) : "",
    billing_period: e.billing_period || "monthly",
    monthly_fee: e.monthly_fee != null ? String(e.monthly_fee) : "",
    included_hours: e.included_hours != null ? String(e.included_hours) : "",
    additional_hourly_rate: e.additional_hourly_rate != null ? String(e.additional_hourly_rate) : "",
    placement_fee_percent: e.placement_fee_percent != null ? String(e.placement_fee_percent) : "",
    flat_placement_fee: e.flat_placement_fee != null ? String(e.flat_placement_fee) : "",
    guarantee_period_days: e.guarantee_period_days != null ? String(e.guarantee_period_days) : "",
    payment_terms: e.payment_terms || "",
    contract_reference: e.contract_reference || "",
    notes: e.notes || "",
    sla: e.sla || "",
    target_kpis: e.target_kpis || "",
    custom_responsibilities: e.custom_responsibilities || [],
    assigned_recruiter_id: e.assigned_recruiter_id ? String(e.assigned_recruiter_id) : "",
  };
}

function statusBadge(status: EngagementStatus) {
  const map: Record<EngagementStatus, string> = {
    prospect: "bg-amber-100 text-amber-800",
    active: "bg-emerald-100 text-emerald-800",
    paused: "bg-slate-100 text-slate-700",
    completed: "bg-primary-100 text-primary-800",
    cancelled: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

export default function ClientEngagementsTab({ clientId, engagements, users, onRefresh }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Engagement | null>(null);
  const [selected, setSelected] = useState<Engagement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const recruiters = useMemo(
    () => users.filter((u) => ["recruiter", "manager", "admin"].includes(u.role)),
    [users],
  );

  useEffect(() => {
    if (!selected) return;
    const latest = engagements.find((e) => e.id === selected.id);
    if (latest) setSelected(latest);
  }, [engagements, selected]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (e: Engagement) => {
    setEditing(e);
    setForm(engagementToForm(e));
    setModalOpen(true);
  };

  const openDetail = async (e: Engagement) => {
    try {
      const res = await api.get<ApiResponse<Engagement>>(`/engagements/${e.id}`);
      setSelected(res.data.data);
      setDetailOpen(true);
    } catch {
      setSelected(e);
      setDetailOpen(true);
    }
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      engagement_name: form.engagement_name.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
      service_model: form.service_model,
      billing_model: form.billing_model,
      currency: form.currency || "USD",
      rate: numOrNull(form.rate),
      hourly_rate: numOrNull(form.hourly_rate),
      billing_period: form.billing_period || null,
      monthly_fee: numOrNull(form.monthly_fee),
      included_hours: numOrNull(form.included_hours),
      additional_hourly_rate: numOrNull(form.additional_hourly_rate),
      placement_fee_percent: numOrNull(form.placement_fee_percent),
      flat_placement_fee: numOrNull(form.flat_placement_fee),
      guarantee_period_days: numOrNull(form.guarantee_period_days),
      payment_terms: form.payment_terms.trim() || null,
      contract_reference: form.contract_reference.trim() || null,
      notes: form.notes.trim() || null,
      sla: form.sla.trim() || null,
      target_kpis: form.target_kpis.trim() || null,
      custom_responsibilities:
        form.service_model === "custom" ? form.custom_responsibilities : [],
      assigned_recruiter_id: form.assigned_recruiter_id
        ? Number(form.assigned_recruiter_id)
        : null,
    };
    return payload;
  };

  const handleSave = async () => {
    if (!form.engagement_name.trim()) {
      toast.error("Engagement name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await api.put(`/engagements/${editing.id}`, payload);
        toast.success("Engagement updated");
      } else {
        await api.post("/engagements", { ...payload, client_id: Number(clientId) });
        toast.success("Engagement created");
      }
      setModalOpen(false);
      onRefresh();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to save engagement";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (engagementId: number, status: EngagementStatus) => {
    try {
      await api.patch(`/engagements/${engagementId}/status`, null, { params: { status } });
      toast.success("Status updated");
      onRefresh();
      if (selected?.id === engagementId) {
        const res = await api.get<ApiResponse<Engagement>>(`/engagements/${engagementId}`);
        setSelected(res.data.data);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const toggleResponsibility = (item: string) => {
    setForm((prev) => {
      const exists = prev.custom_responsibilities.includes(item);
      return {
        ...prev,
        custom_responsibilities: exists
          ? prev.custom_responsibilities.filter((x) => x !== item)
          : [...prev.custom_responsibilities, item],
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Engagements</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Jobs must belong to an Engagement with Service and Billing models.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Create Engagement
        </Button>
      </div>

      {!engagements.length ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center">
          <p className="text-sm text-gray-600 mb-3">No engagements yet for this client.</p>
          <Button size="sm" onClick={openCreate}>
            Create first Engagement
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {engagements.map((e) => (
            <div
              key={e.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:border-primary/30 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => openDetail(e)} className="text-left flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-sm text-gray-900 truncate">{e.engagement_name}</p>
                    <Badge className={cn("text-[10px] uppercase", statusBadge(e.status))}>
                      {ENGAGEMENT_STATUS_LABELS[e.status]}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500">
                    {SERVICE_MODEL_LABELS[e.service_model]} · {BILLING_MODEL_LABELS[e.billing_model]}
                    {e.currency ? ` · ${e.currency}` : ""}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> {e.job_count} job{e.job_count === 1 ? "" : "s"}
                    {e.assigned_recruiter_name ? ` · ${e.assigned_recruiter_name}` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <Select
                    value={e.status}
                    onChange={(ev) => changeStatus(e.id, ev.target.value as EngagementStatus)}
                    options={Object.entries(ENGAGEMENT_STATUS_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    className="!h-8 !text-xs !py-0 min-w-[120px]"
                  />
                  <button
                    type="button"
                    onClick={() => openEdit(e)}
                    className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:text-primary hover:border-primary/30"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Engagement" : "Create Engagement"}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            label="Engagement Name *"
            value={form.engagement_name}
            onChange={(e) => setForm({ ...form, engagement_name: e.target.value })}
            placeholder="e.g. Q3 Engineering Hiring"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EngagementStatus })}
              options={Object.entries(ENGAGEMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="Assigned Recruiter"
              placeholder="Optional"
              value={form.assigned_recruiter_id}
              onChange={(e) => setForm({ ...form, assigned_recruiter_id: e.target.value })}
              options={recruiters.map((r) => ({ value: String(r.id), label: r.name }))}
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Service Model</p>
            <Select
              label="Service Model *"
              value={form.service_model}
              onChange={(e) => setForm({ ...form, service_model: e.target.value as ServiceModel })}
              options={Object.entries(SERVICE_MODEL_LABELS).map(([value, label]) => ({ value, label }))}
            />
            {form.service_model === "custom" && (
              <div className="mt-3">
                <p className="text-xs text-gray-600 mb-2">Custom responsibilities</p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_RESPONSIBILITY_OPTIONS.map((item) => {
                    const active = form.custom_responsibilities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleResponsibility(item)}
                        className={cn(
                          "px-2.5 py-1 text-[11px] rounded-md border transition",
                          active
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-gray-600 border-gray-200 hover:border-primary/40",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Billing Model</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Billing Model *"
                value={form.billing_model}
                onChange={(e) => setForm({ ...form, billing_model: e.target.value as BillingModel })}
                options={Object.entries(BILLING_MODEL_LABELS).map(([value, label]) => ({ value, label }))}
              />
              <Input
                label="Currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </div>

            {(form.billing_model === "hourly" || form.billing_model === "hybrid") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Input
                  label="Hourly Rate"
                  type="number"
                  value={form.hourly_rate}
                  onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
                />
                <Select
                  label="Billing Period"
                  value={form.billing_period}
                  onChange={(e) => setForm({ ...form, billing_period: e.target.value })}
                  options={[
                    { value: "weekly", label: "Weekly" },
                    { value: "biweekly", label: "Bi-weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                />
              </div>
            )}

            {(form.billing_model === "monthly_retainer" || form.billing_model === "hybrid") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Input
                  label="Monthly Fee"
                  type="number"
                  value={form.monthly_fee}
                  onChange={(e) => setForm({ ...form, monthly_fee: e.target.value })}
                />
                <Input
                  label="Included Hours"
                  type="number"
                  value={form.included_hours}
                  onChange={(e) => setForm({ ...form, included_hours: e.target.value })}
                />
                <Input
                  label="Additional Hourly Rate"
                  type="number"
                  value={form.additional_hourly_rate}
                  onChange={(e) => setForm({ ...form, additional_hourly_rate: e.target.value })}
                />
              </div>
            )}

            {(form.billing_model === "success_based" || form.billing_model === "hybrid") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <Input
                  label="Placement Fee %"
                  type="number"
                  value={form.placement_fee_percent}
                  onChange={(e) => setForm({ ...form, placement_fee_percent: e.target.value })}
                />
                <Input
                  label="Flat Placement Fee"
                  type="number"
                  value={form.flat_placement_fee}
                  onChange={(e) => setForm({ ...form, flat_placement_fee: e.target.value })}
                />
                <Input
                  label="Guarantee Period (days)"
                  type="number"
                  value={form.guarantee_period_days}
                  onChange={(e) => setForm({ ...form, guarantee_period_days: e.target.value })}
                />
                <Input
                  label="Payment Terms"
                  value={form.payment_terms}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  placeholder="e.g. Net 30"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            <Input
              label="Contract / Reference"
              value={form.contract_reference}
              onChange={(e) => setForm({ ...form, contract_reference: e.target.value })}
            />
            <Input
              label="Generic Rate (optional)"
              type="number"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
            />
          </div>
          <Textarea
            label="SLA"
            value={form.sla}
            onChange={(e) => setForm({ ...form, sla: e.target.value })}
            rows={2}
          />
          <Textarea
            label="Target KPIs"
            value={form.target_kpis}
            onChange={(e) => setForm({ ...form, target_kpis: e.target.value })}
            rows={2}
          />
          <Textarea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save Changes" : "Create Engagement"}
            </Button>
          </div>
        </div>
      </AnimatedModal>

      <AnimatedModal
        open={detailOpen && !!selected}
        onClose={() => setDetailOpen(false)}
        title={selected?.engagement_name || "Engagement"}
        size="lg"
      >
        {selected && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2">
              <Badge className={cn("text-[10px] uppercase", statusBadge(selected.status))}>
                {ENGAGEMENT_STATUS_LABELS[selected.status]}
              </Badge>
              <Badge className="bg-primary-50 text-primary text-[10px]">
                {SERVICE_MODEL_LABELS[selected.service_model]}
              </Badge>
              <Badge className="bg-slate-100 text-slate-700 text-[10px]">
                {BILLING_MODEL_LABELS[selected.billing_model]}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Client</dt>
                <dd className="font-medium">{selected.client_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Recruiter</dt>
                <dd className="font-medium">{selected.assigned_recruiter_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Dates</dt>
                <dd className="font-medium">
                  {(selected.start_date || "—") + " → " + (selected.end_date || "—")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Currency</dt>
                <dd className="font-medium">{selected.currency}</dd>
              </div>
              {selected.hourly_rate != null && (
                <div>
                  <dt className="text-xs text-gray-500">Hourly Rate</dt>
                  <dd className="font-medium">{selected.hourly_rate}</dd>
                </div>
              )}
              {selected.monthly_fee != null && (
                <div>
                  <dt className="text-xs text-gray-500">Monthly Fee</dt>
                  <dd className="font-medium">{selected.monthly_fee}</dd>
                </div>
              )}
              {selected.placement_fee_percent != null && (
                <div>
                  <dt className="text-xs text-gray-500">Placement Fee %</dt>
                  <dd className="font-medium">{selected.placement_fee_percent}%</dd>
                </div>
              )}
              {selected.flat_placement_fee != null && (
                <div>
                  <dt className="text-xs text-gray-500">Flat Placement Fee</dt>
                  <dd className="font-medium">{selected.flat_placement_fee}</dd>
                </div>
              )}
              {selected.contract_reference && (
                <div>
                  <dt className="text-xs text-gray-500">Contract Ref</dt>
                  <dd className="font-medium">{selected.contract_reference}</dd>
                </div>
              )}
            </dl>
            {!!selected.custom_responsibilities?.length && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Custom responsibilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.custom_responsibilities.map((r) => (
                    <span key={r} className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(selected.notes || selected.sla || selected.target_kpis) && (
              <div className="space-y-2 text-sm">
                {selected.notes && (
                  <div>
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
                {selected.sla && (
                  <div>
                    <p className="text-xs text-gray-500">SLA</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{selected.sla}</p>
                  </div>
                )}
                {selected.target_kpis && (
                  <div>
                    <p className="text-xs text-gray-500">Target KPIs</p>
                    <p className="text-gray-800 whitespace-pre-wrap">{selected.target_kpis}</p>
                  </div>
                )}
              </div>
            )}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900">Jobs under this Engagement</p>
                <Link
                  href={`/jobs/new?client_id=${clientId}&engagement_id=${selected.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  + Create Job
                </Link>
              </div>
              {!selected.jobs?.length ? (
                <p className="text-xs text-gray-500">No jobs yet.</p>
              ) : (
                <div className="space-y-2">
                  {selected.jobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:border-primary/30"
                    >
                      <span className="text-sm font-medium text-gray-800">{j.title}</span>
                      <span className="text-xs text-gray-500 capitalize">{j.status}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => openEdit(selected)}>
                Edit
              </Button>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
}
