import { cn } from "@/lib/utils";
import type { ClientStage } from "@/types";

const STAGE_STYLES: Record<ClientStage, string> = {
  prospect: "bg-primary-50 text-primary-600 ring-primary-200",
  lead: "bg-primary-100 text-primary-800 ring-primary-300",
  active: "bg-green-50 text-green-700 ring-green-200",
  on_hold: "bg-amber-50 text-amber-700 ring-amber-200",
  customer: "bg-amber-50 text-amber-700 ring-amber-200",
  inactive: "bg-slate-100 text-slate-600 ring-slate-200",
};

const STAGE_DOTS: Record<ClientStage, string> = {
  prospect: "bg-primary-500",
  lead: "bg-primary-700",
  active: "bg-green-500",
  on_hold: "bg-amber-500",
  customer: "bg-amber-500",
  inactive: "bg-slate-400",
};

const STAGE_LABELS: Record<ClientStage, string> = {
  prospect: "PROSPECT",
  lead: "LEAD",
  active: "ACTIVE",
  on_hold: "ON HOLD",
  customer: "ON HOLD",
  inactive: "INACTIVE",
};

/** Status options shown in Change Status UI (excludes legacy customer). */
export const CLIENT_STATUS_OPTIONS: { value: ClientStage; label: string }[] = [
  { value: "prospect", label: "Prospect" },
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "inactive", label: "Inactive" },
];

export default function ClientStageBadge({ stage }: { stage?: ClientStage | null }) {
  const safeStage = stage && STAGE_STYLES[stage] ? stage : "prospect";
  return (
    <span className={cn("status-pill", STAGE_STYLES[safeStage])}>
      <span className={cn("status-dot", STAGE_DOTS[safeStage])} />
      {STAGE_LABELS[safeStage]}
    </span>
  );
}

export { STAGE_LABELS, STAGE_STYLES };
