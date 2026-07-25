"use client";

import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { formatDateTimeBullet } from "@/lib/utils";

interface JobRow {
  id: number;
  title: string;
  status: string;
  client_name?: string;
  candidate_count: number;
  created_at: string;
}

interface Props {
  jobs: JobRow[];
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-sky-100 text-sky-800",
  "on-hold": "bg-amber-100 text-amber-800",
  closed: "bg-gray-100 text-gray-600",
  filled: "bg-primary-100 text-primary-800",
};

export default function TeamMemberJobsTab({ jobs }: Props) {
  if (!jobs.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
        No jobs assigned to this team member.
      </div>
    );
  }

  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>Job Title</Th>
          <Th>Client</Th>
          <Th>Status</Th>
          <Th>Candidates</Th>
          <Th>Created</Th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <Tr key={job.id}>
            <Td>
              <Link href={`/jobs/${job.id}`} className="font-medium text-[#111827] hover:text-primary">
                {job.title}
              </Link>
            </Td>
            <Td>{job.client_name || "—"}</Td>
            <Td>
              <Badge className={STATUS_STYLE[job.status] ?? STATUS_STYLE.pending}>
                {job.status.replace("-", " ")}
              </Badge>
            </Td>
            <Td>{job.candidate_count}</Td>
            <Td className="whitespace-nowrap text-[#6B7280]">{formatDateTimeBullet(job.created_at)}</Td>
          </Tr>
        ))}
      </tbody>
    </TableWrapper>
  );
}
