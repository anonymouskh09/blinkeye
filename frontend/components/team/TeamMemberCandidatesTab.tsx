"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ClientAvatar from "@/components/clients/ClientAvatar";
import { TableSkeleton } from "@/components/ui/Skeleton";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import api from "@/lib/api";
import { formatDateTimeBullet } from "@/lib/utils";
import type { ApiResponse, Candidate, PaginatedData } from "@/types";

interface Props {
  userId: number;
  dateFrom?: string;
  dateTo?: string;
}

export default function TeamMemberCandidatesTab({ userId, dateFrom, dateTo }: Props) {
  const [data, setData] = useState<PaginatedData<Candidate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api
      .get<ApiResponse<PaginatedData<Candidate>>>("/candidates", {
        params: {
          page,
          page_size: 15,
          created_by: userId,
          ...(dateFrom ? { date_from: dateFrom } : {}),
          ...(dateTo ? { date_to: dateTo } : {}),
        },
      })
      .then((res) => setData(res.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId, page, dateFrom, dateTo]);

  if (loading) return <TableSkeleton rows={5} cols={5} />;

  if (!data?.items?.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
        No candidates created by this team member.
      </div>
    );
  }

  return (
    <>
      <TableWrapper>
        <thead>
          <tr>
            <Th>Candidate Name</Th>
            <Th>Location</Th>
            <Th>Current Position</Th>
            <Th>Status</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((c) => (
            <Tr key={c.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <ClientAvatar name={c.name} size="sm" className="!bg-indigo-100 !text-indigo-700" />
                  <Link href={`/candidates/${c.id}`} className="font-medium text-[#111827] hover:text-primary">
                    {c.name}
                  </Link>
                </div>
              </Td>
              <Td>{c.location || "—"}</Td>
              <Td>{c.current_job_title || "—"}</Td>
              <Td className="capitalize">{c.candidate_status || "new"}</Td>
              <Td className="whitespace-nowrap text-[#6B7280]">{formatDateTimeBullet(c.created_at)}</Td>
            </Tr>
          ))}
        </tbody>
      </TableWrapper>
      <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
    </>
  );
}
