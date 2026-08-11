"use client";

import { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

const ACCENT = "#2F7A64";
const ACCENT_SOFT = "#F1F4F8";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  sparkline?: number[];
}

function buildSparkData(seed: number, points = 8) {
  const values = Array.from({ length: points }, (_, i) => {
    const wave = Math.sin(i * 0.9 + seed) * 12;
    const drift = i * 3;
    return Math.max(8, 28 + wave + drift + ((seed * (i + 3)) % 7));
  });
  return values.map((v, i) => ({ i, v }));
}

export default function MetricCard({
  title,
  value,
  icon: Icon,
  trend = "↑ 0% vs last month",
  trendPositive = true,
  sparkline,
}: MetricCardProps) {
  const seed = typeof value === "number" ? value : String(value).length * 11;
  const data = (sparkline ?? buildSparkData(seed).map((d) => d.v)).map((v, i) => ({ i, v }));
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-slate-500">{title}</p>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: ACCENT_SOFT }}
        >
          <Icon className="h-4 w-4" style={{ color: ACCENT }} />
        </div>
      </div>

      <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{displayValue}</p>

      <p
        className="mt-1.5 text-xs font-medium"
        style={{ color: trendPositive ? ACCENT : "#DC2626" }}
      >
        {trend}
      </p>

      <div className="mt-4 h-12 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`spark-${seed}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={ACCENT}
              strokeWidth={2}
              fill={`url(#spark-${seed})`}
              dot={{ r: 2.5, fill: ACCENT, strokeWidth: 0 }}
              activeDot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
