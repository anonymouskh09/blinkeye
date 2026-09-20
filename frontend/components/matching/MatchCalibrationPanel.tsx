"use client";

import type { MatchCalibration } from "@/types";

const VERDICT_LABEL: Record<string, string> = {
  strong_fit: "Strong fit",
  good_fit: "Good fit",
  partial_fit: "Partial fit",
  weak_fit: "Weak fit",
};

function scoreColor(score: number) {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 55) return "bg-sky-100 text-sky-800";
  if (score >= 35) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

interface Props {
  calibration: MatchCalibration;
  screeningQuestions?: string[];
}

export default function MatchCalibrationPanel({ calibration, screeningQuestions }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${scoreColor(calibration.overall_score)}`}>
          {calibration.overall_score}%
        </span>
        <span className="text-sm font-medium text-gray-700">
          {VERDICT_LABEL[calibration.verdict] || calibration.verdict}
        </span>
      </div>

      <div className="space-y-3">
        {calibration.dimensions.map((d) => {
          const pct = d.max_score ? Math.round((d.score / d.max_score) * 100) : 0;
          return (
            <div key={d.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{d.label}</span>
                <span className="text-gray-500">
                  {d.score}/{d.max_score}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-gray-500">{d.note}</p>
              {!!d.matched.length && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.matched.map((s) => (
                    <span key={s} className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                      ✓ {s}
                    </span>
                  ))}
                </div>
              )}
              {!!d.missing.length && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {d.missing.slice(0, 6).map((s) => (
                    <span key={s} className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] text-rose-700">
                      ✗ {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!!calibration.flags.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="mb-1 text-xs font-semibold text-amber-800">Flags</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-amber-900">
            {calibration.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {!!screeningQuestions?.length && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <p className="mb-1.5 text-xs font-semibold text-gray-700">Screening questions for this role</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-gray-600">
            {screeningQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
