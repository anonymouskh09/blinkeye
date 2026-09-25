import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchCalibrationDimension, MatchVerdict } from "@/types";

export const VERDICT_META: Record<MatchVerdict, { label: string; pill: string; dot: string; ring: string }> = {
  strong_fit: { label: "Strong fit", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", ring: "#10B981" },
  good_fit: { label: "Good fit", pill: "bg-primary-50 text-primary-600 ring-primary-200", dot: "bg-primary-500", ring: "#2F7A64" },
  partial_fit: { label: "Partial fit", pill: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", ring: "#F59E0B" },
  weak_fit: { label: "Weak fit", pill: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", ring: "#94A3B8" },
};

export function ScoreRing({ score, verdict, size = 48 }: { score: number; verdict: MatchVerdict; size?: number }) {
  const stroke = size >= 48 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = VERDICT_META[verdict]?.ring ?? "#94A3B8";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Match score ${score}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, Math.max(0, score)) / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-slate-900 tabular-nums">
        {score}
      </span>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: MatchVerdict }) {
  const m = VERDICT_META[verdict] ?? VERDICT_META.weak_fit;
  return (
    <span className={cn("status-pill", m.pill)}>
      <span className={cn("status-dot", m.dot)} />
      {m.label}
    </span>
  );
}

export function SkillChips({ matched, missing, limit = 6 }: { matched: string[]; missing: string[]; limit?: number }) {
  const all = [
    ...matched.map((s) => ({ s, ok: true })),
    ...missing.map((s) => ({ s, ok: false })),
  ];
  const shown = all.slice(0, limit);
  const rest = all.length - shown.length;
  if (!all.length) return <span className="text-xs font-medium text-slate-400">No skill data</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map(({ s, ok }) => (
        <span
          key={`${ok}-${s}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
            ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-rose-50 text-rose-600 ring-rose-200",
          )}
          title={ok ? "Candidate has this skill" : "Required skill missing"}
        >
          {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {s}
        </span>
      ))}
      {rest > 0 && <span className="px-1 text-[11px] font-bold text-slate-400">+{rest}</span>}
    </div>
  );
}

export function MatchBreakdown({ dimensions, flags }: { dimensions: MatchCalibrationDimension[]; flags: string[] }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {dimensions.map((d) => {
        const pct = d.max_score ? (d.score / d.max_score) * 100 : 0;
        return (
          <div key={d.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">{d.label}</span>
              <span className="text-xs font-extrabold text-slate-900 tabular-nums">
                {d.score}
                <span className="font-semibold text-slate-400">/{d.max_score}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className={cn(
                  "h-full rounded-full",
                  pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-primary-500" : "bg-amber-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-slate-500">{d.note}</p>
          </div>
        );
      })}
      {flags.length > 0 && (
        <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Things to check</p>
          <ul className="mt-1 list-disc pl-4 text-xs font-medium text-amber-800">
            {flags.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
