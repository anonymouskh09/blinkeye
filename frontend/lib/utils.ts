import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import type { JobStatus, PipelineStage } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string, timeStr?: string) {
  try {
    const d = format(parseISO(dateStr), "MMM d, yyyy");
    return timeStr ? `${d} at ${timeStr.slice(0, 5)}` : d;
  } catch {
    return dateStr;
  }
}

export function formatDateTimeBullet(dateStr: string) {
  try {
    const d = parseISO(dateStr);
    return `${format(d, "yyyy-MM-dd")} • ${format(d, "H:mm")}`;
  } catch {
    return dateStr;
  }
}

export function jobStatusColor(status: JobStatus): string {
  const colors: Record<JobStatus, string> = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    "on-hold": "bg-gray-100 text-gray-800",
    closed: "bg-red-100 text-red-800",
    filled: "bg-primary-100 text-primary-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function pipelineStageColor(stage: PipelineStage): string {
  if (stage === "hired") return "bg-green-100 text-green-800";
  if (stage === "rejected") return "bg-red-100 text-red-800";
  if (stage.includes("interview")) return "bg-primary-100 text-primary-800";
  return "bg-primary-100 text-primary-800";
}

export function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
