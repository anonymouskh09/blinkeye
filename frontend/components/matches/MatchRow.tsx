"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase, ChevronDown, Eye, MapPin, RotateCcw, Sparkles, ThumbsDown, UserPlus, Building2,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { MatchBreakdown, ScoreRing, SkillChips, VerdictBadge } from "@/components/matches/MatchBits";
import type { MatchListItem } from "@/types";

interface Props {
  item: MatchListItem;
  selected: boolean;
  onToggle: () => void;
  onShortlist: () => void;
  onDismiss: () => void;
  onRestore: () => void;
  onQuickView: () => void;
  busy?: boolean;
  showJob?: boolean;
  reasonLabel: (value: string) => string;
}

function ago(iso?: string | null) {
  if (!iso) return "";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

export default function MatchRow({
  item, selected, onToggle, onShortlist, onDismiss, onRestore, onQuickView, busy, showJob = true, reasonLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const d = item.dismissal;

  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition-colors",
        selected ? "border-primary-300 bg-primary-50/40" : "border-slate-200 hover:border-primary-200",
      )}
    >
      <div className="flex flex-col gap-3 p-3.5 lg:flex-row lg:items-center lg:gap-4">
        {/* Score + candidate */}
        <div className="flex min-w-0 items-center gap-3 lg:w-[30%]">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${item.candidate_name} for ${item.job_title}`}
          />
          <ScoreRing score={item.match_score} verdict={item.verdict} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onQuickView}
                className="truncate text-left text-[14px] font-bold text-slate-900 hover:text-primary"
              >
                {item.candidate_name}
              </button>
              {item.is_new && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-primary px-1.5 py-px text-[9px] font-extrabold uppercase tracking-wider text-white">
                  <Sparkles className="h-2.5 w-2.5" /> New
                </span>
              )}
            </div>
            <p className="truncate text-xs font-medium text-slate-500">
              {[item.candidate_title, item.candidate_company].filter(Boolean).join(" · ") || "No current role"}
            </p>
            <p className="mt-0.5 flex items-center gap-2 truncate text-[11px] font-medium text-slate-400">
              {item.candidate_location && (
                <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{item.candidate_location}</span>
              )}
              {item.candidate_experience_years != null && <span>{item.candidate_experience_years} yrs exp</span>}
            </p>
          </div>
        </div>

        {/* Job */}
        {showJob && (
          <div className="min-w-0 pl-7 lg:w-[22%] lg:pl-0">
            <Link href={`/jobs/${item.job_id}`} className="flex items-center gap-1.5 truncate text-[13px] font-bold text-slate-800 hover:text-primary">
              <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" /> <span className="truncate">{item.job_title}</span>
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {item.client_name}
            </p>
          </div>
        )}

        {/* Skills + verdict */}
        <div className="min-w-0 flex-1 space-y-1.5 pl-7 lg:pl-0">
          <div className="flex flex-wrap items-center gap-2">
            <VerdictBadge verdict={item.verdict} />
            {item.must_have_total > 0 && (
              <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                {item.must_have_matched}/{item.must_have_total} must-haves
              </span>
            )}
          </div>
          <SkillChips matched={item.matched_skills} missing={item.missing_skills} />
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1.5 pl-7 lg:pl-0">
          {d ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:border-primary-300 hover:text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restore
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onShortlist}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              >
                <UserPlus className="h-3.5 w-3.5" /> Shortlist
              </button>
              <button
                type="button"
                onClick={onDismiss}
                disabled={busy}
                title="Dismiss match"
                aria-label="Dismiss match"
                className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onQuickView}
            title="Quick view"
            aria-label="Quick view candidate"
            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 shadow-sm hover:border-primary-300 hover:text-primary"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Why <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {d && (
        <div className="mx-3.5 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
          <span className="font-bold text-slate-800">Dismissed: {reasonLabel(d.reason)}</span>
          {d.dismissed_by_name && <> by {d.dismissed_by_name}</>}
          {d.dismissed_at && <> · {ago(d.dismissed_at)}</>}
          {d.note && <p className="mt-0.5 italic text-slate-500">&ldquo;{d.note}&rdquo;</p>}
        </div>
      )}

      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 animate-fade-in">
          <MatchBreakdown dimensions={item.dimensions} flags={item.flags} />
          <p className="mt-3 text-[11px] font-medium text-slate-400">
            {item.first_matched_at && <>First matched {ago(item.first_matched_at)} · </>}
            Score updated {ago(item.computed_at)}
          </p>
        </div>
      )}
    </div>
  );
}
