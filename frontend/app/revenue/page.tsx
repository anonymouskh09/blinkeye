"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Building2,
  Briefcase,
  CircleDollarSign,
  FileText,
  Layers,
  RefreshCw,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import type { ApiResponse, RevenueBreakdownItem, RevenueReport } from "@/types";

const ACCENT = "#2F7A64";

function toNum(v?: string | number | null): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v?: string | number | null, currency = "USD") {
  return toNum(v).toLocaleString(undefined, { style: "currency", currency });
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

type BreakdownTab =
  | "client"
  | "engagement"
  | "job"
  | "recruiter"
  | "revenue_type"
  | "billing_model";

const BREAKDOWN_TABS: { id: BreakdownTab; label: string; icon: typeof Building2 }[] = [
  { id: "client", label: "By Client", icon: Building2 },
  { id: "engagement", label: "By Engagement", icon: Layers },
  { id: "job", label: "By Job", icon: Briefcase },
  { id: "recruiter", label: "By Recruiter", icon: User },
  { id: "revenue_type", label: "By Type", icon: CircleDollarSign },
  { id: "billing_model", label: "By Billing Model", icon: BarChart3 },
];

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: typeof Wallet;
  accent: string;
  bg: string;
  barPct?: number;
  barColor?: string;
}

function KpiCard({ label, value, hint, icon: Icon, accent, bg, barPct, barColor }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
          <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: bg }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
      {barPct != null && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${barPct}%`, backgroundColor: barColor || accent }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownTable({ rows }: { rows: RevenueBreakdownItem[] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => toNum(b.outstanding) - toNum(a.outstanding)),
    [rows]
  );

  if (!sorted.length) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        No data for this breakdown yet.
      </div>
    );
  }

  return (
    <TableWrapper className="rounded-none border-0 shadow-none">
      <thead>
        <tr>
          <Th>Name</Th>
          <Th className="text-right">Expected</Th>
          <Th className="text-right">Invoiced</Th>
          <Th className="text-right">Paid</Th>
          <Th className="text-right">Outstanding</Th>
          <Th className="text-right w-28">Collected</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const invoiced = toNum(r.invoiced);
          const paid = toNum(r.paid);
          const collected = pct(paid, invoiced);
          return (
            <Tr key={r.key}>
              <Td>
                <span className="font-medium text-slate-900">{r.label}</span>
              </Td>
              <Td className="text-right tabular-nums text-slate-600">{money(r.expected)}</Td>
              <Td className="text-right tabular-nums text-slate-700">{money(r.invoiced)}</Td>
              <Td className="text-right tabular-nums font-medium text-emerald-700">{money(r.paid)}</Td>
              <Td className="text-right tabular-nums font-medium text-amber-700">{money(r.outstanding)}</Td>
              <Td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="hidden sm:block h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${collected}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-600">{collected}%</span>
                </div>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </TableWrapper>
  );
}

export default function RevenuePage() {
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<BreakdownTab>("client");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get<ApiResponse<RevenueReport>>("/revenue");
      setReport(res.data.data);
    } catch {
      toast.error("Failed to load revenue report");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = report?.summary;
  const expected = toNum(summary?.expected);
  const invoiced = toNum(summary?.invoiced);
  const paid = toNum(summary?.paid);
  const outstanding = toNum(summary?.outstanding);

  const invoicedRate = pct(invoiced, expected);
  const collectionRate = pct(paid, invoiced);
  const paidOfExpected = pct(paid, expected);

  const breakdownRows = useMemo(() => {
    if (!report) return [];
    const map: Record<BreakdownTab, RevenueBreakdownItem[]> = {
      client: report.by_client,
      engagement: report.by_engagement,
      job: report.by_job,
      recruiter: report.by_recruiter,
      revenue_type: report.by_revenue_type,
      billing_model: report.by_billing_model,
    };
    return map[tab] || [];
  }, [report, tab]);

  const hasData = expected > 0 || invoiced > 0;

  return (
    <PageWrapper>
      <Header
        title="Revenue"
        subtitle="Track expected, invoiced, and paid revenue — one entry per invoice line, no double-counting"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/invoices">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4" />
                Invoices
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {loading || !report ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="No revenue recorded yet"
          description="Accept an offer, approve timesheets, or create invoices to see revenue attribution here."
          actionLabel="View invoices"
          onAction={() => window.location.assign("/invoices")}
        />
      ) : (
        <div className="space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Expected"
              value={money(summary.expected)}
              hint="Approved billables not yet voided"
              icon={TrendingUp}
              accent="#475569"
              bg="#F1F5F9"
              barPct={100}
              barColor="#94A3B8"
            />
            <KpiCard
              label="Invoiced"
              value={money(summary.invoiced)}
              hint={`${invoicedRate}% of expected billed to clients`}
              icon={FileText}
              accent="#2563EB"
              bg="#EFF6FF"
              barPct={invoicedRate}
              barColor="#2563EB"
            />
            <KpiCard
              label="Paid"
              value={money(summary.paid)}
              hint={`${collectionRate}% collection on invoiced · ${paidOfExpected}% of expected`}
              icon={Wallet}
              accent={ACCENT}
              bg="#ECFDF5"
              barPct={collectionRate}
              barColor={ACCENT}
            />
            <KpiCard
              label="Outstanding"
              value={money(summary.outstanding)}
              hint="Invoiced amount awaiting payment"
              icon={CircleDollarSign}
              accent="#D97706"
              bg="#FFFBEB"
              barPct={pct(outstanding, invoiced)}
              barColor="#F59E0B"
            />
          </div>

          {/* Revenue funnel */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Revenue pipeline</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Expected → Invoiced → Paid (each stage excludes double-counted placement fees)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Expected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Invoiced
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Paid
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { label: "Expected", value: expected, color: "#94A3B8", pct: 100 },
                { label: "Invoiced", value: invoiced, color: "#2563EB", pct: invoicedRate },
                { label: "Paid", value: paid, color: ACCENT, pct: paidOfExpected },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-4">
                  <span className="w-20 shrink-0 text-xs font-medium text-slate-600">{row.label}</span>
                  <div className="flex-1 h-8 rounded-lg bg-slate-50 overflow-hidden relative">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all duration-700"
                      style={{
                        width: `${Math.max(row.pct, row.value > 0 ? 8 : 0)}%`,
                        backgroundColor: row.color,
                        opacity: 0.9,
                      }}
                    >
                      {row.pct >= 18 && (
                        <span className="text-xs font-semibold text-white truncate">
                          {money(row.value)}
                        </span>
                      )}
                    </div>
                    {row.pct < 18 && row.value > 0 && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-700">
                        {money(row.value)}
                      </span>
                    )}
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-500">
                    {row.pct}%
                  </span>
                </div>
              ))}
            </div>

            {expected > invoiced && (
              <p className="mt-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
                <span className="font-medium text-slate-700">{money(expected - invoiced)}</span> in
                approved billables not yet invoiced.
              </p>
            )}
          </div>

          {/* Breakdown tabs */}
          <div className="content-panel overflow-hidden min-h-0">
            <div className="sub-tabs px-4 overflow-x-auto">
              {BREAKDOWN_TABS.map((t) => {
                const Icon = t.icon;
                const count =
                  t.id === "client"
                    ? report.by_client.length
                    : t.id === "engagement"
                      ? report.by_engagement.length
                      : t.id === "job"
                        ? report.by_job.length
                        : t.id === "recruiter"
                          ? report.by_recruiter.length
                          : t.id === "revenue_type"
                            ? report.by_revenue_type.length
                            : report.by_billing_model.length;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "sub-tab inline-flex items-center gap-1.5 whitespace-nowrap",
                      tab === t.id ? "sub-tab-active" : "sub-tab-inactive"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    {t.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                          tab === t.id ? "bg-white/20 text-inherit" : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="p-1 sm:p-2">
              <BreakdownTable rows={breakdownRows} />
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
