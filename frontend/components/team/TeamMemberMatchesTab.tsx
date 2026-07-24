"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import ClientAvatar from "@/components/clients/ClientAvatar";
import type { TeamPipelineCard } from "@/types";

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: "new", label: "New Candidates", color: "border-t-indigo-500" },
  { key: "shortlisted", label: "Shortlisted", color: "border-t-emerald-500" },
  { key: "interview", label: "Interview", color: "border-t-blue-500" },
  { key: "client_review", label: "Client Review", color: "border-t-violet-500" },
  { key: "offered", label: "Offered", color: "border-t-amber-500" },
  { key: "hired", label: "Hired", color: "border-t-green-500" },
];

interface Props {
  pipeline: Record<string, TeamPipelineCard[]>;
}

export default function TeamMemberMatchesTab({ pipeline }: Props) {
  const total = COLUMNS.reduce((n, c) => n + (pipeline[c.key]?.length ?? 0), 0);

  if (!total) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#374151]">No pipeline matches yet</p>
        <p className="mt-1 text-sm text-[#6B7280]">Candidates assigned to this member&apos;s jobs will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {COLUMNS.map(({ key, label, color }) => {
          const cards = pipeline[key] ?? [];
          return (
            <div
              key={key}
              className={`w-[260px] shrink-0 rounded-xl border border-[#E5E7EB] border-t-[3px] bg-[#F8FAFC]/80 ${color}`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <h4 className="text-sm font-semibold text-[#111827]">{label}</h4>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#6B7280] ring-1 ring-[#E5E7EB]">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-2 px-3 pb-3">
                {cards.map((card) => (
                  <article
                    key={card.assignment_id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-2.5">
                      <ClientAvatar name={card.name} size="sm" className="!bg-indigo-100 !text-indigo-700" />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/candidates/${card.candidate_id}`}
                          className="block truncate text-sm font-semibold text-[#111827] hover:text-primary"
                        >
                          {card.name}
                        </Link>
                        <p className="truncate text-xs text-[#6B7280]">
                          {card.current_job_title || "—"}
                        </p>
                        {card.job_title && (
                          <p className="mt-1 truncate rounded-md bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-medium text-[#6B7280]">
                            {card.job_title}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/candidates/${card.candidate_id}`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-indigo-50 hover:text-primary"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                ))}
                {!cards.length && (
                  <p className="px-1 py-6 text-center text-xs text-[#9CA3AF]">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
