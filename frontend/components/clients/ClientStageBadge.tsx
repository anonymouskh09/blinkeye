import { cn } from "@/lib/utils";
import type { ClientStage } from "@/types";

const STAGE_STYLES: Record<ClientStage, string> = {
  prospect: "bg-primary-500 text-white",
  lead: "bg-primary-600 text-white",
  active: "bg-green-500 text-white",
  on_hold: "bg-amber-500 text-white",
  customer: "bg-amber-500 text-white",
  inactive: "bg-gray-400 text-white",
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
    <span className={cn("inline-flex px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase", STAGE_STYLES[safeStage])}>
      {STAGE_LABELS[safeStage]}
    </span>
  );
}

export { STAGE_LABELS, STAGE_STYLES };
