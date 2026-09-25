"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown, Eye, MoreVertical, Pencil, GitBranch, FileText,
} from "lucide-react";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/types";

function candidateRef(id: number) {
  return id.toString(36).toUpperCase().padStart(9, "0").slice(0, 9);
}

function formatSalary(val?: number) {
  return val ? val.toLocaleString() : "NA";
}

function formatCreatedDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const date = d.toISOString().slice(0, 10);
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${date} - ${time}`;
  } catch {
    return dateStr.slice(0, 10);
  }
}

interface Props {
  candidates: Candidate[];
  selectedIds?: number[];
  onToggle?: (id: number) => void;
  onToggleAll?: () => void;
}

export default function CandidatesListTable({
  candidates,
  selectedIds = [],
  onToggle,
  onToggleAll,
}: Props) {
  const [menuId, setMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const allSelected = candidates.length > 0 && candidates.every((c) => selectedIds.includes(c.id));
  const someSelected = candidates.some((c) => selectedIds.includes(c.id));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="data-table-head">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={() => onToggleAll?.()}
                />
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap min-w-[220px]">
                <span className="inline-flex items-center gap-1">Candidate Name <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Candidate Reference <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Candidate Location <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Current Position <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Current Company <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
              <th className="px-3 py-3 text-left whitespace-nowrap">Notice Period</th>
              <th className="px-3 py-3 text-left whitespace-nowrap">Current Salary</th>
              <th className="px-3 py-3 text-left whitespace-nowrap">Expected Salary</th>
              <th className="px-3 py-3 text-left whitespace-nowrap">Candidate Owner</th>
              <th className="px-3 py-3 text-left whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Candidate Created Date <ArrowUpDown className="h-3 w-3 text-slate-400" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {candidates.length ? candidates.map((c, idx) => (
              <tr
                key={c.id}
                className={cn(
                  "data-table-row",
                  idx % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                )}
              >
                <td className="px-3 py-3.5">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => onToggle?.(c.id)}
                  />
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <ClientAvatar name={c.name} size="md" />
                    <Link href={`/candidates/${c.id}`} className="text-slate-900 hover:text-primary text-[13.5px] font-bold">
                      {c.name}
                    </Link>
                    {c.cv_file_path && (
                      <span className="text-gray-400" title="CV attached"><FileText className="h-3.5 w-3.5" /></span>
                    )}
                    <Link href={`/candidates/${c.id}`} className="text-gray-400 hover:text-primary">
                      <Eye className="h-3.5 w-3.5" />
                    </Link>
                    <div className="relative" ref={menuId === c.id ? menuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setMenuId(menuId === c.id ? null : c.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </button>
                      {menuId === c.id && (
                        <div className="absolute right-0 top-6 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-slide-down">
                          <Link href={`/candidates/${c.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                          <Link href={`/candidates/${c.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                          <Link href={`/candidates/${c.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <GitBranch className="h-3.5 w-3.5" /> Assign Job
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{candidateRef(c.id)}</span>
                </td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">{c.location || ""}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-800 font-medium whitespace-nowrap">{c.current_job_title || ""}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">{c.current_company || ""}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">{c.notice_period || ""}</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">NA</td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">{formatSalary(c.expected_salary)}</td>
                <td className="px-3 py-3.5 whitespace-nowrap">
                  {c.created_by_name ? (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar name={c.created_by_name} />
                      <span className="text-[13px] font-semibold text-slate-800 truncate max-w-[110px]" title={c.created_by_name}>
                        {c.created_by_name}
                      </span>
                    </div>
                  ) : "—"}
                </td>
                <td className="px-3 py-3.5 text-[13px] text-slate-600 whitespace-nowrap">{formatCreatedDate(c.created_at)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-sm text-gray-400">No candidates found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { candidateRef, formatCreatedDate };
