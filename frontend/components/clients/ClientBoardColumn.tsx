"use client";

import { useDroppable } from "@dnd-kit/core";
import ClientBoardCard from "./ClientBoardCard";
import type { Client, ClientStage } from "@/types";
import { cn } from "@/lib/utils";

const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  lead: "Lead",
  active: "Active",
  on_hold: "On Hold",
  inactive: "Inactive",
};

interface ClientBoardColumnProps {
  stage: ClientStage;
  clients: Client[];
}

export default function ClientBoardColumn({ stage, clients }: ClientBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-56 rounded-xl border bg-gray-50/70 transition-colors",
        isOver ? "border-primary/40 bg-primary-50/50" : "border-gray-200/70",
      )}
    >
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-200/60">
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
          {STAGE_LABELS[stage] || stage}
        </h3>
        <span className="text-[11px] font-semibold text-gray-500 tabular-nums">{clients.length}</span>
      </div>
      <div className="p-1.5 space-y-1.5 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {clients.map((client) => (
          <ClientBoardCard key={client.id} client={client} />
        ))}
        {!clients.length && (
          <p className="text-[11px] text-gray-400 text-center py-6">Drop here</p>
        )}
      </div>
    </div>
  );
}
