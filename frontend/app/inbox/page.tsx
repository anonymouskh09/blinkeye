"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import Card, { CardBody } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, InboxItem } from "@/types";

const entityLink = (type: string, id: number) => {
  if (type === "candidate") return `/candidates/${id}`;
  if (type === "job") return `/jobs/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
};

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: InboxItem[] }>>("/recruitment/inbox");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  return (
    <PageWrapper>
      <Header title="Inbox" subtitle="Notes and messages across candidates, jobs, and clients" />

      {loading ? <TableSkeleton rows={6} cols={1} /> : !items.length ? (
        <EmptyState
          title="Inbox is empty"
          description="Notes you add to candidates, jobs, or clients will appear here."
          icon={<MessagesSquare className="w-8 h-8" />}
        />
      ) : (
        <div className="content-panel p-5">
        <div className="space-y-3">
          {items.map((note) => {
            const href = entityLink(note.entity_type, note.entity_id);
            return (
              <Card key={note.id}>
                <CardBody className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {href ? (
                          <Link href={href} className="text-sm font-semibold text-primary hover:underline">
                            {note.entity_label}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{note.entity_label}</span>
                        )}
                        <Badge className="bg-gray-100 text-gray-600 capitalize">{note.entity_type}</Badge>
                        {note.shared_with_guest && (
                          <Badge className="bg-teal-100 text-teal-800">Shared with guest</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {note.created_by_name && `${note.created_by_name} · `}
                        {note.updated_at
                          ? formatDateTime(
                              note.updated_at.split("T")[0],
                              note.updated_at.split("T")[1]?.slice(0, 5),
                            )
                          : ""}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
        </div>
      )}
    </PageWrapper>
  );
}
