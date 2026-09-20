"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import MatchCalibrationPanel from "@/components/matching/MatchCalibrationPanel";
import api from "@/lib/api";
import type { ApiResponse, JobMatchItem } from "@/types";

interface Props {
  candidateId: string | number;
  onAssigned?: () => void;
}

export default function CandidateJobMatchesTab({ candidateId, onAssigned }: Props) {
  const [items, setItems] = useState<JobMatchItem[]>([]);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(30);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [assigning, setAssigning] = useState<number | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<
        ApiResponse<{ items: JobMatchItem[]; scanned: number; matched: number }>
      >(`/matching/candidates/${candidateId}/jobs`, {
        params: { min_score: minScore, limit: 50 },
      });
      setItems(res.data.data.items || []);
      setScanned(res.data.data.scanned || 0);
    } catch {
      toast.error("Failed to load job matches");
    } finally {
      setLoading(false);
    }
  }, [candidateId, minScore]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const assign = async (jobId: number) => {
    setAssigning(jobId);
    try {
      await api.post(`/candidates/${candidateId}/assign-job`, { job_id: jobId });
      toast.success("Candidate assigned to job");
      setItems((prev) => prev.filter((i) => i.job_id !== jobId));
      onAssigned?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to assign";
      toast.error(msg);
    } finally {
      setAssigning(null);
    }
  };

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Scanned <span className="font-semibold text-gray-900">{scanned}</span> active jobs ·{" "}
          <span className="font-semibold text-gray-900">{items.length}</span> matches ≥ {minScore}%
        </p>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-500">Min score</label>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            {[20, 30, 40, 50, 60, 70].map((n) => (
              <option key={n} value={n}>
                {n}%
              </option>
            ))}
          </select>
        </div>
      </div>

      {!items.length ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No matching jobs"
          description="Add skills and experience on this candidate, and ensure active jobs have must-have skills + description."
        />
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const open = expanded === m.job_id;
            return (
              <div key={m.job_id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/jobs/${m.job_id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {m.job_title}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          m.match_score >= 75
                            ? "bg-emerald-100 text-emerald-800"
                            : m.match_score >= 55
                              ? "bg-sky-100 text-sky-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {m.match_score}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {m.client_name || "—"}
                      {m.location ? ` · ${m.location}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.matched_skills.slice(0, 5).map((s) => (
                        <span key={s} className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                          {s}
                        </span>
                      ))}
                      {m.missing_skills.slice(0, 3).map((s) => (
                        <span key={s} className="rounded bg-rose-50 px-2 py-0.5 text-[11px] text-rose-700">
                          missing: {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setExpanded(open ? null : m.job_id)}
                    >
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Calibrate
                    </Button>
                    <Button loading={assigning === m.job_id} onClick={() => assign(m.job_id)}>
                      Add to pipeline
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-gray-100 bg-slate-50/80 px-4 py-4">
                    <MatchCalibrationPanel
                      calibration={m.calibration}
                      screeningQuestions={m.screening_questions}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
