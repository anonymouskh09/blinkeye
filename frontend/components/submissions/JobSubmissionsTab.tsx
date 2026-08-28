"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { Eye, Plus } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { CardSkeleton } from "@/components/ui/Skeleton";
import SubmissionDetailModal from "@/components/submissions/SubmissionDetailModal";
import api from "@/lib/api";
import type { ApiResponse, PaginatedData, Submission } from "@/types";
import { SUBMISSION_STATUS_LABELS } from "@/types";

interface Props {
  jobId: string;
}

export default function JobSubmissionsTab({ jobId }: Props) {
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchItems = useCallback(() => {
    setLoading(true);
    api
      .get<ApiResponse<PaginatedData<Submission>>>("/submissions", {
        params: { job_id: jobId, page_size: 100 },
      })
      .then((r) => setItems(r.data.data.items || []))
      .catch(() => {
        setItems([]);
        toast.error("Failed to load submissions");
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">{items.length} submission{items.length === 1 ? "" : "s"}</p>
        <Button size="sm" variant="outline" onClick={fetchItems}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Refresh
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSelectedId(s.id);
              setDetailOpen(true);
            }}
            className="w-full text-left flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm text-gray-900 truncate">{s.candidate_name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {s.submission_date}
                {s.recruiter_name ? ` · by ${s.recruiter_name}` : ""}
                {" · "}
                {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge>{SUBMISSION_STATUS_LABELS[s.status]}</Badge>
              <Eye className="h-4 w-4 text-gray-400" />
            </div>
          </button>
        ))}
        {!items.length && (
          <p className="px-4 py-12 text-sm text-gray-400 text-center">
            No submissions yet. Move a candidate to Qualified, then use Submit Candidate.
          </p>
        )}
      </div>

      <SubmissionDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        submissionId={selectedId}
        onUpdated={fetchItems}
      />
    </div>
  );
}
