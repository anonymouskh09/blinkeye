"use client";

import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string;
  to: string;
}

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  {
    label: "All time",
    getRange: () => ({ from: "", to: "" }),
  },
  {
    label: "Today",
    getRange: () => {
      const t = toIsoDate(new Date());
      return { from: t, to: t };
    },
  },
  {
    label: "Last 7 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    },
  },
  {
    label: "Last 30 days",
    getRange: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: toIsoDate(from), to: toIsoDate(to) };
    },
  },
  {
    label: "This month",
    getRange: () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIsoDate(from), to: toIsoDate(now) };
    },
  },
];

function formatLabel(from: string, to: string) {
  if (!from && !to) return "All time";
  if (from && to && from === to) {
    return new Date(from).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  const f = from ? new Date(from).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "…";
  const t = to ? new Date(to).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "…";
  return `${f} – ${t}`;
}

export default function TeamMemberDateFilter({ value, onChange }: Props) {
  const hasFilter = Boolean(value.from || value.to);

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111827]">Progress by date</p>
            <p className="text-xs text-[#6B7280]">{formatLabel(value.from, value.to)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => {
            const range = preset.getRange();
            const active =
              range.from === value.from && range.to === value.to;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(range)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-primary text-white shadow-sm"
                    : "bg-[#F8FAFC] text-[#374151] ring-1 ring-[#E5E7EB] hover:bg-primary-50 hover:text-primary",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-[#F1F5F9] pt-4 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-medium text-[#6B7280]">From</span>
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-medium text-[#6B7280]">To</span>
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-sm text-[#111827] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        {hasFilter && (
          <button
            type="button"
            onClick={() => onChange({ from: "", to: "" })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-4 py-2 text-sm font-medium text-[#6B7280] transition hover:border-red-200 hover:text-red-600"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
