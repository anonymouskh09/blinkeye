"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Filter, MoreVertical, Eye, ArrowUpDown, Play, RefreshCw,
  Pencil, GitBranch,
} from "lucide-react";
import ClientAvatar, { UserAvatar } from "@/components/clients/ClientAvatar";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Job, JobStatus } from "@/types";

const JOB_STAGES: Record<string, string> = {
  active: "NEW CANDIDATES",
  pending: "PENDING",
  "on-hold": "ON HOLD",
  closed: "CLOSED",
  filled: "FILLED",
};

const STATUS_OPTIONS: { value: JobStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "on-hold", label: "On Hold" },
  { value: "closed", label: "Closed" },
  { value: "filled", label: "Filled" },
];

function formatSalaryValue(val?: number) {
  return val ? val.toLocaleString() : "Negotiable";
}

function formatDateShort(dateStr: string) {
  return dateStr.slice(0, 10);
}

interface Props {
  jobs: Job[];
  onRefresh: () => void;
  showClient?: boolean;
  hideToolbar?: boolean;
  onFiltersClick?: () => void;
}

export default function JobsListTable({ jobs, onRefresh, showClient = true, hideToolbar = false, onFiltersClick }: Props) {
  const [menuId, setMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateStatus = async (jobId: number, status: JobStatus) => {
    try {
      await api.put(`/jobs/${jobId}`, { status });
      toast.success("Status updated");
      onRefresh();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {!hideToolbar && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-b border-gray-100">
          <button type="button" onClick={onFiltersClick} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-primary text-primary text-sm rounded-md hover:bg-primary-50 transition-colors">
            <Filter className="h-4 w-4" /> Filters
          </button>
          <button type="button" onClick={onRefresh} className="p-2 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button type="button" className="p-2 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50">
            <MoreVertical className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-[#F1F4F8] border-b border-gray-200">
              <th className="w-10 px-3 py-3 rounded-l-xl"><input type="checkbox" className="rounded border-gray-300" /></th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Position Name <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              {showClient && (
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">Job Client <ArrowUpDown className="h-3 w-3" /></span>
                </th>
              )}
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Job Location <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Headcount</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Job Stage <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Minimum Salary</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Maximum Salary</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Job Owner</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Job Team</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                <span className="inline-flex items-center gap-1">Job Status <ArrowUpDown className="h-3 w-3" /></span>
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap rounded-r-xl">
                <span className="inline-flex items-center gap-1">Job Created Date <ArrowUpDown className="h-3 w-3" /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.length ? jobs.map((j, idx) => {
              const recruiter = j.assigned_recruiter_name || "—";
              return (
                <tr key={j.id} className={cn(
                  "border-b border-gray-100 hover:bg-primary-50/40 transition-colors",
                  idx % 2 === 1 ? "bg-primary-50/20" : "bg-white"
                )}>
                  <td className="px-3 py-3"><input type="checkbox" className="rounded border-gray-300" /></td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link href={`/jobs/${j.id}`} className="text-primary hover:underline text-sm font-medium">{j.title}</Link>
                      <Link href={`/jobs/${j.id}`} className="text-gray-400 hover:text-primary"><Eye className="h-3.5 w-3.5" /></Link>
                      <div className="relative" ref={menuId === j.id ? menuRef : undefined}>
                        <button type="button" onClick={() => setMenuId(menuId === j.id ? null : j.id)}
                          className="text-gray-400 hover:text-gray-600">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                        {menuId === j.id && (
                          <div className="absolute right-0 top-6 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 animate-slide-down">
                            <Link href={`/jobs/${j.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <Eye className="h-3.5 w-3.5" /> View
                            </Link>
                            <Link href={`/jobs/${j.id}/pipeline`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <GitBranch className="h-3.5 w-3.5" /> Pipeline
                            </Link>
                            <Link href={`/jobs/${j.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {showClient && (
                    <td className="px-3 py-3 whitespace-nowrap">
                      {j.client_name ? (
                        <div className="flex items-center gap-2">
                          <ClientAvatar name={j.client_name} size="sm" className="!bg-amber-400 !text-amber-900" />
                          <Link href={`/clients/${j.client_id}`} className="text-sm text-primary hover:underline">{j.client_name}</Link>
                        </div>
                      ) : "—"}
                    </td>
                  )}
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{j.location || ""}</td>
                  <td className="px-3 py-3 text-sm text-gray-800 whitespace-nowrap">
                    {j.candidate_count} - {j.number_of_positions ?? 1}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase bg-primary text-white">
                      {JOB_STAGES[j.status] || j.status.replace("-", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatSalaryValue(j.salary_min)}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatSalaryValue(j.salary_max)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {recruiter !== "—" ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={recruiter} />
                        <span className="text-sm text-primary truncate max-w-[80px]" title={recruiter}>{recruiter}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {recruiter !== "—" ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={recruiter} />
                        <span className="text-sm text-primary truncate max-w-[80px]" title={recruiter}>{recruiter}</span>
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 border border-gray-200 rounded-md px-2 py-1 bg-white">
                      <Play className="h-3 w-3 text-primary fill-primary" />
                      <select
                        value={j.status}
                        onChange={(e) => updateStatus(j.id, e.target.value as JobStatus)}
                        className="text-xs text-gray-700 bg-transparent border-none outline-none cursor-pointer pr-1"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateShort(j.created_at)}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={showClient ? 12 : 11} className="px-4 py-16 text-center text-sm text-gray-400">No jobs found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { JOB_STAGES, STATUS_OPTIONS };
