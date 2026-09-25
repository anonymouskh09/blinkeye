"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import SlideOver from "@/components/ui/SlideOver";
import { cn } from "@/lib/utils";
import { VERDICT_META } from "@/components/matches/MatchBits";
import type { MatchFilterState } from "@/components/matches/useMatchFilters";
import type { MatchFilterOptions, MatchVerdict } from "@/types";

interface Props {
  state: MatchFilterState;
  update: (patch: Partial<MatchFilterState>) => void;
  clear: () => void;
  activeCount: number;
  options: MatchFilterOptions | null;
}

const VERDICT_ORDER: MatchVerdict[] = ["strong_fit", "good_fit", "partial_fit", "weak_fit"];

const selectCls =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

function useDebounced<T>(value: T, commit: (v: T) => void, delay = 350) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => commit(local), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);
  return [local, setLocal] as const;
}

function Fields({ state, update, options, stacked }: Props & { stacked?: boolean }) {
  const [min, setMin] = useDebounced(state.min, (v) => update({ min: v }), 300);
  const jobs = options?.jobs.filter((j) => !state.client || j.client_id === state.client) ?? [];

  return (
    <div className={cn("grid gap-3", stacked ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-4")}>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Job</span>
        <select
          className={selectCls}
          value={state.job ?? ""}
          onChange={(e) => update({ job: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">All jobs</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>{j.title} ({j.match_count})</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Client</span>
        <select
          className={selectCls}
          value={state.client ?? ""}
          onChange={(e) => update({ client: e.target.value ? Number(e.target.value) : null, job: null })}
        >
          <option value="">All clients</option>
          {options?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      {options?.recruiters && (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Recruiter</span>
          <select
            className={selectCls}
            value={state.recruiter ?? ""}
            onChange={(e) => update({ recruiter: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">All recruiters</option>
            {options.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      )}
      <label className="block">
        <span className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Minimum score <span className="text-primary-600 tabular-nums">{min}%</span>
        </span>
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="h-9 w-full accent-[#1F574A]"
          aria-label="Minimum match score"
        />
      </label>
      <div className={cn("flex flex-wrap items-center gap-2", !stacked && "col-span-2 xl:col-span-4")}>
        <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Verdict</span>
        {VERDICT_ORDER.map((v) => {
          const on = state.verdicts.includes(v);
          return (
            <button
              key={v}
              type="button"
              aria-pressed={on}
              onClick={() => update({ verdicts: on ? state.verdicts.filter((x) => x !== v) : [...state.verdicts, v] })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition-colors",
                on ? VERDICT_META[v].pill : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", VERDICT_META[v].dot)} />
              {VERDICT_META[v].label}
            </button>
          );
        })}
        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <Toggle label="All must-haves" on={state.must} onChange={(v) => update({ must: v })} />
        <Toggle label="New (24h)" on={state.fresh} onChange={(v) => update({ fresh: v })} />
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
    >
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-primary" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

export default function MatchFiltersBar(props: Props) {
  const { state, update, clear, activeCount } = props;
  const [q, setQ] = useDebounced(state.q, (v) => update({ q: v.trim() }));
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search candidate, title, job or client…"
            aria-label="Search matches"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-700 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-white">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button type="button" onClick={clear} className="hidden h-10 whitespace-nowrap rounded-lg px-3 text-sm font-bold text-primary hover:bg-primary-50 lg:block">
            Clear filters
          </button>
        )}
      </div>
      <div className="mt-4 hidden lg:block">
        <Fields {...props} />
      </div>

      <SlideOver
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Filters"
        width="md"
        footer={
          <div className="flex justify-between">
            <button type="button" onClick={clear} className="text-sm font-bold text-primary">Clear all</button>
            <button type="button" onClick={() => setDrawer(false)} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">
              Show results
            </button>
          </div>
        }
      >
        <Fields {...props} stacked />
      </SlideOver>
    </div>
  );
}
