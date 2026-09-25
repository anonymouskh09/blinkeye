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
import type { ApiResponse, CandidateMatchItem } from "@/types";

interface Props {
  jobId: string | number;
  onShortlisted?: () => void;
}

export default function JobCandidateMatchesTab({ jobId, onShortlisted }: Props) {
  const [items, setItems] = useState<CandidateMatchItem[]>([]);
  const [scanned, setScanned] = useState(0);
  const [matched, setMatched] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(30);
  const [selected, setSelected] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<
        ApiResponse<{
          items: CandidateMatchItem[];
          scanned: number;
          matched: number;
          screening_questions: string[];
        }>
      >(`/matching/jobs/${jobId}/candidates`, {
        params: { min_score: minScore, limit: 50 },
      });
      setItems(res.data.data.items || []);
      setScanned(res.data.data.scanned || 0);
      setMatched(res.data.data.matched || 0);
      setQuestions(res.data.data.screening_questions || []);
      setSelected([]);
    } catch {
      toast.error("Failed to load candidate matches");
    } finally {
      setLoading(false);
    }
  }, [jobId, minScore]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const toggle = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const shortlist = async (ids: number[]) => {
    if (!ids.length) return;
    setSaving(true);
    try {
      const res = await api.post<ApiResponse<{ added: number[] }>>(
        `/matching/jobs/${jobId}/shortlist`,
        { candidate_ids: ids },
      );
      toast.success(`Shortlisted ${res.data.data.added.length} candidate(s)`);
      setItems((prev) => prev.filter((i) => !res.data.data.added.includes(i.candidate_id)));
      setSelected([]);
      onShortlisted?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Shortlist failed";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CardSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Scanned <span className="font-semibold text-gray-900">{scanned}</span> candidates ·{" "}
          <span className="font-semibold text-gray-900">{matched.toLocaleString()}</span> eligible ≥ {minScore}%
          {matched > items.length && <> · showing top {items.length}</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          >
            {[20, 30, 40, 50, 60, 70].map((n) => (
              <option key={n} value={n}>
                Min {n}%
              </option>
            ))}
          </select>
          <Button
            disabled={!selected.length || saving}
            loading={saving}
            onClick={() => shortlist(selected)}
          >
            Add selected to pipeline ({selected.length})
          </Button>
        </div>
      </div>

      {!!questions.length && (
        <div className="rounded-lg border border-primary/20 bg-primary-50/40 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-primary">Screening questions</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-gray-700">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}

      {!items.length ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No eligible candidates"
          description="Ensure this job has must-have skills and description, and candidates have skills / experience filled in."
        />
      ) : (
        <div className="space-y-3">
          {items.map((m) => {
            const open = expanded === m.candidate_id;
            return (
              <div key={m.candidate_id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.includes(m.candidate_id)}
                    onChange={() => toggle(m.candidate_id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/candidates/${m.candidate_id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {m.candidate_name}
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
                      {m.candidate_title || "—"}
                      {m.experience_years != null ? ` · ${m.experience_years}y` : ""}
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
                      onClick={() => setExpanded(open ? null : m.candidate_id)}
                    >
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Calibrate
                    </Button>
                    <Button
                      loading={saving}
                      onClick={() => shortlist([m.candidate_id])}
                    >
                      Add to pipeline
                    </Button>
                  </div>
                </div>
                {open && (
                  <div className="border-t border-gray-100 bg-slate-50/80 px-4 py-4">
                    <MatchCalibrationPanel
                      calibration={m.calibration}
                      screeningQuestions={questions}
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
