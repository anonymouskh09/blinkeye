"use client";

import Link from "next/link";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import ClientAvatar from "@/components/clients/ClientAvatar";
import type { Client } from "@/types";
import { cn } from "@/lib/utils";

interface ClientBoardCardProps {
  client: Client;
  overlay?: boolean;
}

export default function ClientBoardCard({ client, overlay }: ClientBoardCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: String(client.id),
    data: { client },
    disabled: overlay,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      className={cn(
        "bg-white border border-gray-200 rounded-lg px-2.5 py-2 select-none",
        !overlay && "cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm transition-all",
        isDragging && "opacity-40",
        overlay && "shadow-lg border-primary/30 rotate-1 cursor-grabbing",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <ClientAvatar name={client.company_name} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            href={`/clients/${client.id}`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="block text-sm font-medium text-primary hover:underline truncate"
          >
            {client.company_name}
          </Link>
          <p className="text-[11px] text-gray-400 tabular-nums">
            {client.job_count} job{client.job_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}
