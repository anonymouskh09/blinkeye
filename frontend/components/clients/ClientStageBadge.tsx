import { cn } from "@/lib/utils";
import type { ClientStage } from "@/types";

const STAGE_STYLES: Record<ClientStage, string> = {
  prospect: "bg-primary-500 text-white",
  lead: "bg-indigo-500 text-white",
  active: "bg-green-500 text-white",
  customer: "bg-emerald-600 text-white",
  inactive: "bg-gray-400 text-white",
};

const STAGE_LABELS: Record<ClientStage, string> = {
  prospect: "PROSPECT",
  lead: "LEAD",
  active: "ACTIVE",
  customer: "CUSTOMER",
  inactive: "INACTIVE",
};

export default function ClientStageBadge({ stage }: { stage?: ClientStage | null }) {
  const safeStage = stage && STAGE_STYLES[stage] ? stage : "prospect";
  return (
    <span className={cn("inline-flex px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase", STAGE_STYLES[safeStage])}>
      {STAGE_LABELS[safeStage]}
    </span>
  );
}

export { STAGE_LABELS, STAGE_STYLES };
