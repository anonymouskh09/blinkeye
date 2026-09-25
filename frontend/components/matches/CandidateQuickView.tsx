"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, FileText, Mail, MapPin, Phone, ThumbsDown, UserPlus } from "lucide-react";
import { LinkedinIcon } from "@/components/candidates/SocialIcons";
import SlideOver from "@/components/ui/SlideOver";
import { Skeleton } from "@/components/ui/Skeleton";
import { MatchBreakdown, ScoreRing, VerdictBadge } from "@/components/matches/MatchBits";
import api from "@/lib/api";
import { cn, getInitials } from "@/lib/utils";
import type { ApiResponse, Candidate, MatchListItem } from "@/types";

interface Props {
  match: MatchListItem | null;
  onClose: () => void;
  onShortlist: (m: MatchListItem) => void;
  onDismiss: (m: MatchListItem) => void;
  busy?: boolean;
}

export default function CandidateQuickView({ match, onClose, onShortlist, onDismiss, busy }: Props) {
  const [cand, setCand] = useState<Candidate | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!match) return;
    let cancelled = false;
    setCand(null);
    setError(false);
    api
      .get<ApiResponse<Candidate>>(`/candidates/${match.candidate_id}`)
      .then((r) => !cancelled && setCand(r.data.data))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [match]);

  const matched = new Set((match?.matched_skills ?? []).map((s) => s.toLowerCase()));

  return (
    <SlideOver
      open={!!match}
      onClose={onClose}
      title={match?.candidate_name ?? ""}
      subtitle={match ? `Match for ${match.job_title} · ${match.client_name}` : undefined}
      width="xl"
      footer={
        match && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/candidates/${match.candidate_id}`} className="text-sm font-bold text-primary hover:underline">
              Open full profile
            </Link>
            {!match.dismissal && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDismiss(match)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <ThumbsDown className="h-4 w-4" /> Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => onShortlist(match)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" /> Shortlist
                </button>
              </div>
            )}
          </div>
        )
      }
    >
      {match && (
        <div className="space-y-6">
          <section className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <ScoreRing score={match.match_score} verdict={match.verdict} size={60} />
            <div className="min-w-0">
              <VerdictBadge verdict={match.verdict} />
              <p className="mt-1.5 text-sm font-semibold text-slate-700">
                {match.must_have_total > 0
                  ? `${match.must_have_matched} of ${match.must_have_total} must-have skills`
                  : "Job has no must-have skills"}
              </p>
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Score breakdown</h3>
            <MatchBreakdown dimensions={match.dimensions} flags={match.flags} />
          </section>

          <section>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Profile</h3>
            {error ? (
              <p className="text-sm font-medium text-rose-600">Could not load the profile.</p>
            ) : !cand ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {getInitials(cand.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">{cand.name}</p>
                    <p className="truncate text-sm font-medium text-slate-500">
                      {cand.headline || [cand.current_job_title, cand.current_company].filter(Boolean).join(" at ")}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {cand.email && (
                    <a href={`mailto:${cand.email}`} className="flex items-center gap-2 truncate font-medium text-primary hover:underline">
                      <Mail className="h-4 w-4 shrink-0" /> {cand.email}
                    </a>
                  )}
                  {cand.phone && (
                    <a href={`tel:${cand.phone}`} className="flex items-center gap-2 font-medium text-slate-700">
                      <Phone className="h-4 w-4 shrink-0 text-slate-400" /> {cand.phone}
                    </a>
                  )}
                  {cand.location && (
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" /> {cand.location}
                    </span>
                  )}
                  {cand.experience_years != null && (
                    <span className="flex items-center gap-2 font-medium text-slate-700">
                      <Briefcase className="h-4 w-4 shrink-0 text-slate-400" /> {cand.experience_years} years experience
                    </span>
                  )}
                  {cand.linkedin_url && (
                    <a href={cand.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium text-primary hover:underline">
                      <LinkedinIcon className="h-4 w-4 shrink-0" /> LinkedIn
                    </a>
                  )}
                  {cand.cv_file_path && (
                    <a href={`/api/candidates/${cand.id}/cv`} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-medium text-primary hover:underline">
                      <FileText className="h-4 w-4 shrink-0" /> View resume
                    </a>
                  )}
                </dl>
                {(cand.notice_period || cand.expected_salary) && (
                  <div className="flex flex-wrap gap-2">
                    {cand.notice_period && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">Notice: {cand.notice_period}</span>
                    )}
                    {cand.expected_salary ? (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        Expects {cand.expected_salary.toLocaleString()}
                      </span>
                    ) : null}
                  </div>
                )}
                {!!cand.skills?.length && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-slate-500">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {cand.skills.map((s) => (
                        <span
                          key={s}
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                            matched.has(s.toLowerCase())
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-50 text-slate-600 ring-slate-200",
                          )}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {cand.summary && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{cand.summary}</p>}
              </div>
            )}
          </section>
        </div>
      )}
    </SlideOver>
  );
}
