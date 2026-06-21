"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send, Trash2, Pause, Play } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, OutreachSequenceListItem } from "@/types";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-800",
    completed: "bg-primary-100 text-primary-700",
  };
  return map[status] || map.draft;
};

export default function OutreachSequencesPage() {
  const router = useRouter();
  const [items, setItems] = useState<OutreachSequenceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: OutreachSequenceListItem[] }>>("/outreach/sequences");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load sequences");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  const createSequence = async () => {
    const name = prompt("Sequence name");
    if (!name?.trim()) return;
    setCreating(true);
    try {
      const res = await api.post<ApiResponse<{ id: number }>>("/outreach/sequences", { name: name.trim() });
      toast.success("Sequence created");
      router.push(`/outreach/sequences/${res.data.data.id}`);
    } catch {
      toast.error("Failed to create sequence");
    } finally {
      setCreating(false);
    }
  };

  const togglePause = async (seq: OutreachSequenceListItem) => {
    try {
      if (seq.status === "active") {
        await api.post(`/outreach/sequences/${seq.id}/pause`);
        toast.success("Sequence paused");
      } else {
        await api.post(`/outreach/sequences/${seq.id}/activate`);
        toast.success("Sequence activated");
      }
      fetchSequences();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Action failed");
    }
  };

  const deleteSequence = async (id: number) => {
    if (!confirm("Delete this sequence?")) return;
    try {
      await api.delete(`/outreach/sequences/${id}`);
      toast.success("Sequence deleted");
      fetchSequences();
    } catch {
      toast.error("Failed to delete sequence");
    }
  };

  return (
    <PageWrapper>
      <Header
        title="Outreach Sequences"
        subtitle="Multi-step candidate email campaigns sent from your Gmail"
        actions={
          <div className="flex gap-2">
            <Link href="/outreach">
              <Button variant="outline" size="sm">Gmail Settings</Button>
            </Link>
            <Button onClick={createSequence} loading={creating}>
              <Plus className="h-4 w-4 mr-1" /> New Sequence
            </Button>
          </div>
        }
      />

      {loading ? <TableSkeleton rows={6} cols={8} /> : !items.length ? (
        <EmptyState
          title="No sequences yet"
          description="Create your first outreach sequence to start emailing candidates."
          icon={<Send className="w-8 h-8" />}
          actionLabel="New Sequence"
          onAction={createSequence}
        />
      ) : (
        <div className="content-panel p-1 overflow-x-auto">
          <TableWrapper>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Sender Gmail</Th>
                <Th>Enrolled</Th>
                <Th>Sent</Th>
                <Th>Failed</Th>
                <Th>Created by</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((seq) => (
                <Tr key={seq.id}>
                  <Td>
                    <Link href={`/outreach/sequences/${seq.id}`} className="font-medium text-primary hover:underline">
                      {seq.name}
                    </Link>
                  </Td>
                  <Td><Badge className={statusBadge(seq.status)}>{seq.status}</Badge></Td>
                  <Td className="text-sm text-gray-600">{seq.sender_email || "—"}</Td>
                  <Td>{seq.enrolled_count}</Td>
                  <Td>{seq.sent_count}</Td>
                  <Td>{seq.failed_count}</Td>
                  <Td className="text-sm">{seq.created_by_name || "—"}</Td>
                  <Td className="text-sm text-gray-500">{formatDateTime(seq.created_at)}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Link href={`/outreach/sequences/${seq.id}`}>
                        <Button size="sm" variant="ghost">Open</Button>
                      </Link>
                      {seq.status !== "completed" && (
                        <button type="button" onClick={() => togglePause(seq)} className="p-1.5 text-gray-500 hover:text-primary" title={seq.status === "active" ? "Pause" : "Activate"}>
                          {seq.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      )}
                      <button type="button" onClick={() => deleteSequence(seq.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}
    </PageWrapper>
  );
}
