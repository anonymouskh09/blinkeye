"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, PaginatedData, PlacementItem } from "@/types";

export default function PlacementsPage() {
  const [data, setData] = useState<PaginatedData<PlacementItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<PlacementItem>>>("/recruitment/placements", {
        params: { page, page_size: 20 },
      });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load placements");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPlacements(); }, [fetchPlacements]);

  return (
    <PageWrapper>
      <Header title="Placements" subtitle="Candidates successfully placed in jobs" />

      {loading ? <TableSkeleton rows={8} cols={5} /> : !data?.items?.length ? (
        <EmptyState
          title="No placements yet"
          description="Candidates marked as Hired in the pipeline will appear here."
          icon={<BadgeCheck className="w-8 h-8" />}
        />
      ) : (
        <div className="content-panel p-1">
          <TableWrapper>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Job</Th>
                <Th>Client</Th>
                <Th>Recruiter</Th>
                <Th>Placed On</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => (
                <Tr key={p.assignment_id}>
                  <Td>
                    <Link href={`/candidates/${p.candidate_id}`} className="text-primary hover:underline font-medium">
                      {p.candidate_name}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/jobs/${p.job_id}`} className="text-primary hover:underline">
                      {p.job_title}
                    </Link>
                  </Td>
                  <Td>{p.client_name || "—"}</Td>
                  <Td>{p.recruiter_name || "—"}</Td>
                  <Td>{p.placed_at ? formatDateTime(p.placed_at.split("T")[0], p.placed_at.split("T")[1]?.slice(0, 5)) : "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </div>
      )}
    </PageWrapper>
  );
}
