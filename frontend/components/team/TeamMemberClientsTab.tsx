"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";

interface ClientRow {
  id: number;
  company_name: string;
  jobs_count: number;
  active_jobs: number;
}

interface Props {
  clients: ClientRow[];
}

export default function TeamMemberClientsTab({ clients }: Props) {
  if (!clients.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
        No clients linked through assigned jobs.
      </div>
    );
  }

  return (
    <TableWrapper>
      <thead>
        <tr>
          <Th>Client</Th>
          <Th>Total Jobs</Th>
          <Th>Active Jobs</Th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <Tr key={client.id}>
            <Td>
              <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-2 font-medium text-[#111827] hover:text-primary">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                  <Building2 className="h-4 w-4" />
                </span>
                {client.company_name}
              </Link>
            </Td>
            <Td>{client.jobs_count}</Td>
            <Td>{client.active_jobs}</Td>
          </Tr>
        ))}
      </tbody>
    </TableWrapper>
  );
}
