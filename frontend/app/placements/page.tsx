"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, DollarSign } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import api from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, PaginatedData, PlacementItem } from "@/types";
import { BILLING_MODEL_LABELS, type BillingModel } from "@/types";

function money(v?: string | number | null) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : String(v);
}

function statusClass(status?: string) {
  if (status === "paid") return "bg-emerald-50 text-emerald-700";
  if (status === "partial") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

export default function PlacementsPage() {
  const [data, setData] = useState<PaginatedData<PlacementItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<PlacementItem>>>("/placements", {
        params: { page, page_size: 20 },
      });
      setData(res.data.data);
    } catch {
      // Fallback to legacy hired-assignment view if new API unavailable
      try {
        const legacy = await api.get<ApiResponse<PaginatedData<PlacementItem>>>("/recruitment/placements", {
          params: { page, page_size: 20 },
        });
        setData(legacy.data.data);
      } catch {
        toast.error("Failed to load placements");
      }
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  return (
    <PageWrapper>
      <Header title="Placements" subtitle="Accepted offers with calculated fees and invoice status" />

      {loading ? (
        <TableSkeleton rows={8} cols={7} />
      ) : !data?.items?.length ? (
        <EmptyState
          title="No placements yet"
          description="Accept an offer to create a placement and generate a success fee."
          icon={<BadgeCheck className="w-8 h-8" />}
        />
      ) : (
        <div className="content-panel p-1">
          <TableWrapper>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Job / Client</Th>
                <Th>Engagement</Th>
                <Th>Salary</Th>
                <Th>Placement Fee</Th>
                <Th>Payment</Th>
                <Th>Invoice</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const key = p.id ?? p.assignment_id;
                return (
                  <Tr key={key}>
                    <Td>
                      <Link href={`/candidates/${p.candidate_id}`} className="text-primary hover:underline font-medium">
                        {p.candidate_name}
                      </Link>
                    </Td>
                    <Td>
                      <div>
                        <Link href={`/jobs/${p.job_id}`} className="text-primary hover:underline">
                          {p.job_title}
                        </Link>
                        <p className="text-xs text-gray-500">{p.client_name || "—"}</p>
                      </div>
                    </Td>
                    <Td>
                      <div>
                        <p className="text-sm">{p.engagement_name || "—"}</p>
                        {p.billing_model && (
                          <p className="text-xs text-gray-500">
                            {BILLING_MODEL_LABELS[p.billing_model as BillingModel] || p.billing_model}
                          </p>
                        )}
                      </div>
                    </Td>
                    <Td>{money(p.salary)}</Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-medium">{money(p.placement_fee)}</span>
                      </div>
                      {p.fee_percentage != null && (
                        <p className="text-xs text-gray-500">{p.fee_percentage}%</p>
                      )}
                    </Td>
                    <Td>
                      <Badge className={statusClass(p.payment_status)}>
                        {p.payment_status || "—"}
                      </Badge>
                    </Td>
                    <Td>
                      {p.invoice_id ? (
                        <Link href={`/invoices?id=${p.invoice_id}`} className="text-primary hover:underline text-sm">
                          View
                        </Link>
                      ) : p.placement_date || p.placed_at ? (
                        <span className="text-xs text-gray-400">
                          {formatDate((p.placement_date || p.placed_at || "").split("T")[0])}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </TableWrapper>
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}
    </PageWrapper>
  );
}
