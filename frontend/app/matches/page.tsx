"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle, ArrowRight, Briefcase, Building2, Download, GitBranch, Layers, List, Loader2,
  RefreshCw, RotateCcw, Sparkles, Star, Target, ThumbsDown, UserPlus, Users, X,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Table";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/Skeleton";
import MatchRow from "@/components/matches/MatchRow";
import MatchFiltersBar from "@/components/matches/MatchFiltersBar";
import DismissModal from "@/components/matches/DismissModal";
import CandidateQuickView from "@/components/matches/CandidateQuickView";
import { toApiParams, useMatchFilters, type MatchFilterState } from "@/components/matches/useMatchFilters";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ApiResponse, MatchCacheStatus, MatchFilterOptions, MatchJobGroup, MatchListItem, MatchPair, MatchSummary,
} from "@/types";

const PAGE_SIZE = 25;
const GROUPS_PER_PAGE = 8;
const PER_JOB = 5;

const SKIP_LABELS: Record<string, string> = {
  already_in_pipeline: "already in the pipeline",
  no_access: "no access",
  not_found: "no longer available",
  job_not_active: "job is not active",
  already_dismissed: "already dismissed",
  already_restored: "already restored",
};

const pairKey = (m: MatchPair) => `${m.job_id}:${m.candidate_id}`;

function skippedSummary(skipped: { reason: string }[]) {
  const counts = skipped.reduce<Record<string, number>>((acc, s) => {
    acc[s.reason] = (acc[s.reason] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).map(([r, n]) => `${n} ${SKIP_LABELS[r] ?? r}`).join(", ");
}

function errorMessage(err: unknown, fallback: string) {
  const e = err as { response?: { data?: { message?: string; detail?: unknown } } };
  return e?.response?.data?.message || fallback;
}

function SummaryCard({ label, value, icon: Icon, accent, hint }: { label: string; value: string | number; icon: React.ElementType; accent?: boolean; hint?: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 shadow-card",
      accent ? "border-primary-600 bg-gradient-to-br from-primary-600 to-primary-800 text-white" : "border-slate-200 bg-white",
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-primary-200" : "text-slate-500")}>{label}</p>
        <Icon className={cn("h-4 w-4", accent ? "text-primary-200" : "text-primary-500")} />
      </div>
      <p className={cn("mt-2 text-[26px] font-extrabold leading-none tabular-nums", accent ? "text-white" : "text-slate-900")}>{value}</p>
      {hint && <p className={cn("mt-1.5 text-[11px] font-medium", accent ? "text-primary-100/80" : "text-slate-400")}>{hint}</p>}
    </div>
  );
}

function MatchesContent() {
  const { isAdmin } = useAuth();
  const { state, update, clear, activeCount } = useMatchFilters();

  const [status, setStatus] = useState<MatchCacheStatus | null>(null);
  const [options, setOptions] = useState<MatchFilterOptions | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [list, setList] = useState<{ items: MatchListItem[]; total: number; total_pages: number } | null>(null);
  const [groups, setGroups] = useState<{ items: MatchJobGroup[]; total: number; total_pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<Map<string, MatchListItem>>(new Map());
  const [busy, setBusy] = useState(false);
  const [dismissTarget, setDismissTarget] = useState<MatchListItem[] | null>(null);
  const [quickView, setQuickView] = useState<MatchListItem | null>(null);
  const requestId = useRef(0);

  const filterParams = useMemo(() => toApiParams(state).toString(), [state]);
  const reasonLabel = useCallback(
    (v: string) => status?.dismiss_reasons.find((r) => r.value === v)?.label ?? v.replace(/_/g, " "),
    [status],
  );

  // Cache status (polls while a refresh is running) and filter options.
  const loadStatus = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse<MatchCacheStatus>>("/matches/status");
      setStatus(res.data.data);
      return res.data.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    loadStatus();
    api.get<ApiResponse<MatchFilterOptions>>("/matches/filter-options").then((r) => setOptions(r.data.data)).catch(() => {});
  }, [loadStatus, reloadKey]);

  useEffect(() => {
    if (!status?.refreshing) return;
    const t = setInterval(async () => {
      const s = await loadStatus();
      if (s && !s.refreshing) setReloadKey((k) => k + 1);
    }, 5000);
    return () => clearInterval(t);
  }, [status?.refreshing, loadStatus]);

  // Summary follows the filters only; the list also follows view/sort/page.
  useEffect(() => {
    api.get<ApiResponse<MatchSummary>>(`/matches/summary?${filterParams}`)
      .then((r) => setSummary(r.data.data))
      .catch(() => setSummary(null));
  }, [filterParams, reloadKey]);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    const req = state.view === "job"
      ? api.get<ApiResponse<{ items: MatchJobGroup[]; total: number; total_pages: number }>>(
        `/matches/by-job?${filterParams}&page=${state.page}&page_size=${GROUPS_PER_PAGE}&per_job=${PER_JOB}`,
      )
      : api.get<ApiResponse<{ items: MatchListItem[]; total: number; total_pages: number }>>(
        `/matches?${filterParams}&sort=${state.sort}&order=${state.order}&page=${state.page}&page_size=${PAGE_SIZE}`,
      );
    req
      .then((r) => {
        if (id !== requestId.current) return;
        if (state.view === "job") setGroups(r.data.data as never);
        else setList(r.data.data as never);
      })
      .catch(() => id === requestId.current && setError(true))
      .finally(() => id === requestId.current && setLoading(false));
  }, [filterParams, state.view, state.sort, state.order, state.page, reloadKey]);

  // Selection never survives a change of what is on screen.
  useEffect(() => setSelected(new Map()), [filterParams, state.view, state.page]);

  const refresh = () => setReloadKey((k) => k + 1);

  const toggle = (m: MatchListItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(pairKey(m))) next.delete(pairKey(m));
      else next.set(pairKey(m), m);
      return next;
    });

  const toggleMany = (items: MatchListItem[]) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const allOn = items.every((m) => next.has(pairKey(m)));
      items.forEach((m) => (allOn ? next.delete(pairKey(m)) : next.set(pairKey(m), m)));
      return next;
    });

  // ---- actions ---------------------------------------------------------
  const restore = async (ids: number[], quiet = false) => {
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<{ restored: unknown[]; skipped: { reason: string }[] }>>(
        "/matches/dismissals/undo", { ids },
      );
      const { restored, skipped } = res.data.data;
      if (!quiet || skipped.length) {
        toast.success(`Restored ${restored.length} match${restored.length === 1 ? "" : "es"}` +
          (skipped.length ? ` · skipped ${skippedSummary(skipped)}` : ""));
      }
      setSelected(new Map());
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Could not restore matches"));
    } finally {
      setBusy(false);
    }
  };

  const shortlist = async (items: MatchListItem[]) => {
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<{ added: unknown[]; skipped: { reason: string }[] }>>(
        "/matches/shortlist", { pairs: items.map(({ job_id, candidate_id }) => ({ job_id, candidate_id })) },
      );
      const { added, skipped } = res.data.data;
      if (added.length) {
        toast.success(
          items.length === 1
            ? `${items[0].candidate_name} added to ${items[0].job_title} (New Candidates stage)`
            : `Shortlisted ${added.length} candidate${added.length === 1 ? "" : "s"} to the New Candidates stage`,
        );
      }
      if (skipped.length) toast(`Skipped ${skippedSummary(skipped)}`, { icon: "ℹ️" });
      setSelected(new Map());
      setQuickView(null);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Could not shortlist"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDismiss = async (reason: string, note: string) => {
    if (!dismissTarget) return;
    setBusy(true);
    try {
      const res = await api.post<ApiResponse<{ dismissed: { id: number }[]; skipped: { reason: string }[] }>>(
        "/matches/dismiss",
        {
          pairs: dismissTarget.map(({ job_id, candidate_id }) => ({ job_id, candidate_id })),
          reason,
          note: note || null,
        },
      );
      const { dismissed, skipped } = res.data.data;
      const ids = dismissed.map((d) => d.id);
      if (ids.length) {
        toast(
          (t) => (
            <span className="flex items-center gap-3">
              <span>Dismissed {ids.length} match{ids.length === 1 ? "" : "es"}</span>
              <button
                type="button"
                className="rounded-md bg-white/15 px-2 py-1 text-xs font-bold text-white hover:bg-white/25"
                onClick={() => {
                  toast.dismiss(t.id);
                  restore(ids, true);
                }}
              >
                Undo
              </button>
            </span>
          ),
          { duration: 7000 },
        );
      }
      if (skipped.length) toast(`Skipped ${skippedSummary(skipped)}`, { icon: "ℹ️" });
      setDismissTarget(null);
      setQuickView(null);
      setSelected(new Map());
      refresh();
    } catch (err) {
      toast.error(errorMessage(err, "Could not dismiss"));
    } finally {
      setBusy(false);
    }
  };

  const recalculate = async () => {
    try {
      await api.post("/matches/recalculate");
      toast.success("Recalculating match scores in the background");
      loadStatus();
    } catch (err) {
      toast.error(errorMessage(err, "Could not start recalculation"));
    }
  };

  const exportHref = `/api/matches/export.csv?${filterParams}&sort=${state.sort}&order=${state.order}`;
  const dismissedView = state.status === "dismissed";
  const selectedItems = Array.from(selected.values());

  const rowProps = (m: MatchListItem) => ({
    item: m,
    selected: selected.has(pairKey(m)),
    onToggle: () => toggle(m),
    onShortlist: () => shortlist([m]),
    onDismiss: () => setDismissTarget([m]),
    onRestore: () => m.dismissal && restore([m.dismissal.id]),
    onQuickView: () => setQuickView(m),
    busy,
    reasonLabel,
  });

  // ---- render helpers --------------------------------------------------
  const renderEmpty = () => {
    if (status && status.jobs_with_skills === 0) {
      return (
        <EmptyState
          title="No jobs are ready for matching"
          description="Matches are built from a job's must-have and nice-to-have skills. Add skills to an active job to start seeing candidates here."
          icon={<Briefcase className="w-8 h-8" />}
        />
      );
    }
    if (status?.refreshing && !status.last_computed_at) {
      return (
        <EmptyState
          title="Building match scores…"
          description="We're scoring your candidates against every active job. This page will update automatically."
          icon={<Loader2 className="w-8 h-8 animate-spin" />}
        />
      );
    }
    if (activeCount > 0) {
      return (
        <EmptyState
          title="No matches for these filters"
          description="Try lowering the minimum score or removing a filter."
          actionLabel="Clear filters"
          onAction={clear}
          icon={<Target className="w-8 h-8" />}
        />
      );
    }
    return dismissedView ? (
      <EmptyState title="No dismissed matches" description="Matches you dismiss appear here so they can be restored." icon={<ThumbsDown className="w-8 h-8" />} />
    ) : (
      <EmptyState
        title="No open matches right now"
        description="Every strong candidate may already be in a pipeline. New candidates and job edits are scored automatically."
        icon={<GitBranch className="w-8 h-8" />}
      />
    );
  };

  const content = () => {
    if (error) {
      return (
        <div className="flex flex-col items-center rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="mt-3 text-base font-bold text-slate-900">Matches could not be loaded</p>
          <p className="mt-1 text-sm text-slate-600">Check your connection and try again.</p>
          <Button className="mt-4" variant="outline" onClick={refresh}><RefreshCw className="mr-1.5 h-4 w-4" /> Retry</Button>
        </div>
      );
    }
    if (loading && !(state.view === "job" ? groups : list)) {
      return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
    }

    if (state.view === "job") {
      if (!groups?.items.length) return renderEmpty();
      return (
        <div className={cn("space-y-5 transition-opacity", loading && "opacity-60")}>
          {groups.items.map((g) => (
            <section key={g.job_id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
              <header className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={g.items.length > 0 && g.items.every((m) => selected.has(pairKey(m)))}
                    onChange={() => toggleMany(g.items)}
                    aria-label={`Select shown matches for ${g.job_title}`}
                  />
                  <div className="min-w-0">
                    <Link href={`/jobs/${g.job_id}`} className="block truncate text-[15px] font-extrabold text-slate-900 hover:text-primary">
                      {g.job_title}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{g.client_name}</span>
                      {g.recruiter_name && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{g.recruiter_name}</span>}
                      {g.job_location && <span>{g.job_location}</span>}
                      <span>{g.number_of_positions} opening{g.number_of_positions === 1 ? "" : "s"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-7 sm:pl-0">
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{g.match_count} matches</span>
                  {g.strong_count > 0 && <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">{g.strong_count} strong</span>}
                  {g.new_count > 0 && <span className="rounded-md bg-primary px-2 py-1 text-xs font-bold text-white">{g.new_count} new</span>}
                  <span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">avg {g.avg_score}%</span>
                </div>
              </header>
              <div className="space-y-2 p-3">
                {g.items.map((m) => <MatchRow key={m.id} {...rowProps(m)} showJob={false} />)}
              </div>
              {g.match_count > g.items.length && (
                <button
                  type="button"
                  onClick={() => update({ view: "all", job: g.job_id })}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary-50"
                >
                  View all {g.match_count} matches for this job <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </section>
          ))}
          <Pagination page={state.page} totalPages={groups.total_pages} onPageChange={(p) => update({ page: p })} />
        </div>
      );
    }

    if (!list?.items.length) return renderEmpty();
    return (
      <div className={cn("transition-opacity", loading && "opacity-60")}>
        <div className="mb-2 flex items-center gap-3 px-1">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            checked={list.items.every((m) => selected.has(pairKey(m)))}
            onChange={() => toggleMany(list.items)}
            aria-label="Select all matches on this page"
          />
          <span className="text-xs font-bold text-slate-500">
            {list.total.toLocaleString()} match{list.total === 1 ? "" : "es"} · page {state.page} of {list.total_pages}
          </span>
        </div>
        <div className="space-y-2">
          {list.items.map((m) => <MatchRow key={m.id} {...rowProps(m)} />)}
        </div>
        <Pagination page={state.page} totalPages={list.total_pages} onPageChange={(p) => update({ page: p })} />
      </div>
    );
  };

  const lastUpdated = status?.last_computed_at
    ? formatDistanceToNow(parseISO(status.last_computed_at), { addSuffix: true })
    : null;

  return (
    <>
      <Header
        title="Matches"
        subtitle="Candidates scored against every active job — shortlist the best, dismiss the rest"
        icon={<GitBranch className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 md:inline-flex">
              {status?.refreshing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Updating scores…</>
              ) : lastUpdated ? (
                <>Scores updated {lastUpdated}</>
              ) : null}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={recalculate} disabled={status?.refreshing}>
                <RefreshCw className="mr-1 h-4 w-4" /> Recalculate
              </Button>
            )}
            <a
              href={exportHref}
              title="Download the matches for the current filters (up to 10,000 rows)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {!summary ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <SummaryCard label={dismissedView ? "Dismissed" : "Open matches"} value={summary.total.toLocaleString()} icon={GitBranch} accent
              hint={`${summary.candidates_matched.toLocaleString()} candidate${summary.candidates_matched === 1 ? "" : "s"}`} />
            <SummaryCard label="Strong fit" value={summary.strong_fit.toLocaleString()} icon={Star} hint="Score 75 and above" />
            <SummaryCard label="Jobs with matches" value={summary.jobs_with_matches.toLocaleString()} icon={Briefcase}
              hint={status ? `of ${status.jobs_with_skills} jobs with skills` : undefined} />
            <SummaryCard label="Average score" value={`${summary.avg_score}%`} icon={Target} hint={`Minimum ${state.min}%`} />
            <SummaryCard label="Shortlisted" value={summary.shortlisted_this_week.toLocaleString()} icon={UserPlus}
              hint={isAdmin ? "From Matches, last 7 days" : "By you, last 7 days"} />
          </>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
          {([["active", "Open", Sparkles], ["dismissed", "Dismissed", ThumbsDown]] as const).map(([v, label, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ status: v })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
                state.status === v ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.view === "all" && (
            <select
              value={`${state.sort}:${state.order}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split(":") as [MatchFilterState["sort"], MatchFilterState["order"]];
                update({ sort, order });
              }}
              aria-label="Sort matches"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 shadow-card focus:border-primary focus:outline-none"
            >
              <option value="score:desc">Highest score</option>
              <option value="score:asc">Lowest score</option>
              <option value="newest:desc">Newest matches</option>
              <option value="candidate:asc">Candidate A–Z</option>
              <option value="job:asc">Job A–Z</option>
            </select>
          )}
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-card">
            {([["job", "By Job", Layers], ["all", "All Matches", List]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ view: v })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition-colors",
                  state.view === v ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5">
        <MatchFiltersBar state={state} update={update} clear={clear} activeCount={activeCount} options={options} />
      </div>

      <div className={cn(selectedItems.length > 0 && "pb-24")}>{content()}</div>

      {selectedItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-4 md:pl-48">
          <div className="flex w-full max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-white shadow-2xl animate-slide-down">
            <span className="text-sm font-bold">{selectedItems.length} selected</span>
            <div className="flex items-center gap-2">
              {dismissedView ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => restore(selectedItems.flatMap((m) => (m.dismissal ? [m.dismissal.id] : [])))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-slate-900 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Restore {selectedItems.length}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDismissTarget(selectedItems)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                  >
                    <ThumbsDown className="h-4 w-4" /> Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => shortlist(selectedItems)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" /> Shortlist {selectedItems.length}
                  </button>
                </>
              )}
              <button type="button" onClick={() => setSelected(new Map())} aria-label="Clear selection" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <DismissModal
        open={!!dismissTarget}
        count={dismissTarget?.length ?? 0}
        subject={dismissTarget?.length === 1 ? `${dismissTarget[0].candidate_name} for ${dismissTarget[0].job_title}` : undefined}
        reasons={status?.dismiss_reasons ?? []}
        saving={busy}
        onClose={() => setDismissTarget(null)}
        onConfirm={confirmDismiss}
      />

      <CandidateQuickView
        match={quickView}
        onClose={() => setQuickView(null)}
        onShortlist={(m) => shortlist([m])}
        onDismiss={(m) => {
          // The drawer stacks above modals; close it so the dismiss dialog is visible.
          setQuickView(null);
          setDismissTarget([m]);
        }}
        busy={busy}
      />
    </>
  );
}

export default function MatchesPage() {
  return (
    <PageWrapper>
      <Suspense fallback={<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>}>
        <MatchesContent />
      </Suspense>
    </PageWrapper>
  );
}
