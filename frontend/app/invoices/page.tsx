"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileText, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton, CardSkeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, Invoice, PaginatedData } from "@/types";

function money(v?: string | number | null, currency = "USD") {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { style: "currency", currency })
    : String(v);
}

function statusClass(status?: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "partial") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageWrapper><CardSkeleton /></PageWrapper>}>
      <InvoicesPageInner />
    </Suspense>
  );
}

function InvoicesPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const [data, setData] = useState<PaginatedData<Invoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<Invoice>>>("/invoices", {
        params: { page, page_size: 20 },
      });
      setData(res.data.data);
      if (focusId) {
        const match = res.data.data?.items?.find((i) => String(i.id) === focusId);
        if (match) setSelected(match);
      }
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, focusId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const openInvoice = async (id: number) => {
    try {
      const res = await api.get<ApiResponse<Invoice>>(`/invoices/${id}`);
      setSelected(res.data.data);
    } catch {
      toast.error("Failed to load invoice");
    }
  };

  const recordPayment = async () => {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<ApiResponse<{ invoice: Invoice }>>(`/invoices/${selected.id}/payments`, {
        amount,
        payment_method: payMethod,
        reference: payRef || null,
      });
      setSelected(res.data.data?.invoice || null);
      setPayOpen(false);
      setPayAmount("");
      setPayRef("");
      toast.success("Payment recorded");
      fetchInvoices();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <Header title="Invoices" subtitle="Track invoiced amounts and external client payments" />

      {loading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices are created from approved billable items (e.g. success fees)."
          icon={<FileText className="w-8 h-8" />}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3 content-panel p-1">
            <TableWrapper>
              <thead>
                <tr>
                  <Th>Invoice #</Th>
                  <Th>Client</Th>
                  <Th>Issue Date</Th>
                  <Th>Total</Th>
                  <Th>Outstanding</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((inv) => (
                  <Tr key={inv.id}>
                    <Td>
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() => openInvoice(inv.id)}
                      >
                        {inv.invoice_number}
                      </button>
                    </Td>
                    <Td>{inv.client_name || "—"}</Td>
                    <Td>{formatDate(inv.issue_date)}</Td>
                    <Td>{money(inv.total, inv.currency)}</Td>
                    <Td>{money(inv.amount_outstanding, inv.currency)}</Td>
                    <Td>
                      <Badge className={statusClass(inv.payment_status)}>{inv.payment_status}</Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrapper>
            <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
          </div>

          <div className="xl:col-span-2 content-panel p-5">
            {!selected ? (
              <p className="text-sm text-gray-500">Select an invoice to view line items and record payment.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selected.invoice_number}</h3>
                  <p className="text-sm text-gray-500">
                    {selected.client_name}
                    {selected.engagement_name ? ` · ${selected.engagement_name}` : ""}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Total</p>
                    <p className="font-semibold">{money(selected.total, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Paid</p>
                    <p className="font-semibold text-emerald-700">{money(selected.amount_paid, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Outstanding</p>
                    <p className="font-semibold">{money(selected.amount_outstanding, selected.currency)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <Badge className={statusClass(selected.payment_status)}>{selected.payment_status}</Badge>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Line items</p>
                  <ul className="space-y-2">
                    {selected.line_items?.map((l) => (
                      <li key={l.id} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                        <span className="text-gray-700 pr-3">{l.description}</span>
                        <span className="font-medium whitespace-nowrap">{money(l.amount, selected.currency)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selected.payments?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500 mb-2">Payments</p>
                    <ul className="space-y-2">
                      {selected.payments.map((p) => (
                        <li key={p.id} className="flex justify-between text-sm">
                          <span className="text-gray-600">
                            {formatDate(p.payment_date)} · {p.payment_method.replace(/_/g, " ")}
                            {p.reference ? ` · ${p.reference}` : ""}
                          </span>
                          <span className="font-medium">{money(p.amount, p.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.payment_status !== "paid" && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setPayAmount(String(selected.amount_outstanding || selected.total));
                      setPayOpen(true);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark Payment Received
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Clients pay the agency externally (e.g. bank transfer). Record the payment here to update status.
          </p>
          <Input label="Amount" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <Select
            label="Payment Method"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
            options={[
              { value: "bank_transfer", label: "Bank Transfer" },
              { value: "wire", label: "Wire" },
              { value: "check", label: "Check" },
              { value: "cash", label: "Cash" },
              { value: "other", label: "Other" },
            ]}
          />
          <Input
            label="Reference"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="Bank ref / transaction ID"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={recordPayment} disabled={saving}>
              {saving ? "Saving…" : "Save Payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
