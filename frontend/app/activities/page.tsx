"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, RecruitmentActivityItem } from "@/types";

const entityLink = (type: string, id: number) => {
  if (type === "candidate") return `/candidates/${id}`;
  if (type === "job") return `/jobs/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
};

export default function ActivitiesPage() {
  const [items, setItems] = useState<RecruitmentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: RecruitmentActivityItem[] }>>("/recruitment/activities");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const typeBadge = (type: string) => {
    if (type === "client_activity") return "bg-purple-100 text-purple-800";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <PageWrapper>
      <Header
        title="Activities"
        subtitle="System activity and client tasks across your recruitment pipeline"
        actions={
          <Link href="/interviews">
            <Button variant="outline">View Interviews</Button>
          </Link>
        }
      />

      {loading ? <TableSkeleton rows={10} cols={5} /> : !items.length ? (
        <EmptyState
          title="No activities yet"
          description="Activity will appear here as you work with candidates, jobs, and clients."
          icon={<CalendarDays className="w-8 h-8" />}
        />
      ) : (
        <div className="content-panel p-1">
        <TableWrapper>
          <thead>
            <tr>
              <Th>Activity</Th>
              <Th>Type</Th>
              <Th>Related To</Th>
              <Th>Date</Th>
              <Th>By</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const href = entityLink(a.entity_type, a.entity_id);
              const label = a.client_name || `${a.entity_type} #${a.entity_id}`;
              return (
                <Tr key={a.id}>
                  <Td>
                    <p className="font-medium text-gray-900">{a.title}</p>
                    {a.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.description}</p>
                    )}
                  </Td>
                  <Td>
                    <Badge className={typeBadge(a.type)}>
                      {a.type === "client_activity" ? "Client Task" : "System"}
                    </Badge>
                  </Td>
                  <Td>
                    {href ? (
                      <Link href={href} className="text-primary hover:underline">{label}</Link>
                    ) : label}
                  </Td>
                  <Td>
                    {a.date
                      ? formatDateTime(a.date, "")
                      : a.created_at
                        ? formatDateTime(a.created_at.split("T")[0], a.created_at.split("T")[1]?.slice(0, 5))
                        : "—"}
                  </Td>
                  <Td>{a.assigned_to_name || a.created_by_name || "—"}</Td>
                </Tr>
              );
            })}
          </tbody>
        </TableWrapper>
        </div>
      )}
    </PageWrapper>
  );
}
