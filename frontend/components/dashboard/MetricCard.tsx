"use client";

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "emerald" | "amber" | "teal";

const TONES: Record<Tone, { icon: string; bar: string }> = {
  primary: { icon: "bg-primary-600 text-white shadow-primary/30", bar: "from-primary-600 to-primary-400" },
  emerald: { icon: "bg-emerald-500 text-white shadow-emerald-500/30", bar: "from-emerald-500 to-emerald-300" },
  amber: { icon: "bg-amber-500 text-white shadow-amber-500/30", bar: "from-amber-500 to-amber-300" },
  teal: { icon: "bg-teal-600 text-white shadow-teal-600/30", bar: "from-teal-600 to-teal-400" },
};

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  caption?: string;
  tone?: Tone;
}

export default function MetricCard({ title, value, icon: Icon, caption, tone = "primary" }: MetricCardProps) {
  const t = TONES[tone];
  const displayValue = typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", t.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{title}</p>
          <p className="mt-2 text-[32px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
            {displayValue}
          </p>
        </div>
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-md", t.icon)}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </div>
      </div>
      {caption && <p className="mt-3 text-xs font-medium text-slate-500">{caption}</p>}
    </div>
  );
}
