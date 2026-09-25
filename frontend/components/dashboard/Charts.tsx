"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import Card, { CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { ChartDataPoint } from "@/types";

const COLORS = ["#1F574A", "#2F7A64", "#4A9A84", "#7BBFAE", "#F59E0B", "#184439", "#A8D5C8", "#10B981"];

const AXIS_TICK = { fontSize: 11, fill: "#64748B", fontWeight: 600 };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string; payload?: ChartDataPoint }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const name = label ?? payload[0].payload?.name ?? payload[0].name;
  return (
    <div className="rounded-lg bg-slate-900 px-3 py-2 shadow-lg">
      <p className="text-[11px] font-semibold text-slate-300 capitalize">{name}</p>
      <p className="text-sm font-extrabold text-white tabular-nums">{payload[0].value.toLocaleString()}</p>
    </div>
  );
}

function ChartHeader({ title, subtitle, total }: { title: string; subtitle?: string; total?: number }) {
  return (
    <CardHeader className="flex items-start justify-between gap-3">
      <div>
        <CardTitle>{title}</CardTitle>
        {subtitle && <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p>}
      </div>
      {total !== undefined && (
        <span className="rounded-md bg-primary-50 px-2 py-1 text-xs font-bold text-primary-600 tabular-nums">
          {total.toLocaleString()} total
        </span>
      )}
    </CardHeader>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm font-medium text-slate-400">
      No data yet
    </div>
  );
}

interface BarChartCardProps {
  title: string;
  subtitle?: string;
  data: ChartDataPoint[];
  color?: string;
}

export function BarChartCard({ title, subtitle, data, color = "#1F574A" }: BarChartCardProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const gradientId = `bar-${color.replace("#", "")}`;
  return (
    <Card>
      <ChartHeader title={title} subtitle={subtitle} total={total} />
      <CardBody className="pt-3">
        {!data.length ? <EmptyChart /> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 40 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={1} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#EEF2F6" />
              <XAxis
                dataKey="name"
                tick={AXIS_TICK}
                angle={-30}
                textAnchor="end"
                height={50}
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={AXIS_TICK} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#F1F4F8" }} />
              <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardBody>
    </Card>
  );
}

export function PieChartCard({ title, subtitle, data }: { title: string; subtitle?: string; data: ChartDataPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card>
      <ChartHeader title={title} subtitle={subtitle} />
      <CardBody className="pt-3">
        {!data.length ? <EmptyChart /> : (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={82}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{total}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              {data.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="truncate font-semibold capitalize text-slate-600">{d.name.replace(/[-_]/g, " ")}</span>
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function FunnelChart({ title, subtitle, data }: { title: string; subtitle?: string; data: ChartDataPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Card>
      <ChartHeader title={title} subtitle={subtitle} total={total} />
      <CardBody className="space-y-4">
        {!data.length ? <EmptyChart /> : data.map((item, i) => {
          const pct = total ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={i}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold capitalize text-slate-700">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-50 text-[11px] font-bold text-primary-600">
                    {i + 1}
                  </span>
                  {item.name.replace(/[-_]/g, " ")}
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="font-extrabold text-slate-900 tabular-nums">{item.value}</span>
                  <span className="w-10 text-right text-xs font-semibold text-slate-400 tabular-nums">{pct}%</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
