"use client";

import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/clients/ClientAvatar";

interface HistoryItem {
  id: number;
  description: string;
  action: string;
  entity_type: string;
  created_at: string;
}

interface Props {
  history: HistoryItem[];
  userName: string;
}

export default function TeamMemberHistoryTab({ history, userName }: Props) {
  if (!history.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
        No activity history for this team member yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <div className="divide-y divide-[#F1F5F9]">
        {history.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-5 py-4">
            <UserAvatar name={userName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[#111827]">{item.description}</p>
              <p className="mt-1 text-xs capitalize text-[#9CA3AF]">
                {item.action.replace("_", " ")} · {item.entity_type}
              </p>
            </div>
            <span className="shrink-0 text-xs text-[#9CA3AF]">
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
