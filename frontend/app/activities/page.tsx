"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import {
  CalendarDays, Search, ClipboardCheck, Cpu, Building2, Briefcase, UserCheck, ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { cn, getInitials } from "@/lib/utils";
import type { ApiResponse, RecruitmentActivityItem } from "@/types";

type Filter = "all" | "client_activity" | "system";

const entityLink = (type: string, id: number) => {
  if (type === "candidate") return `/candidates/${id}`;
  if (type === "job") return `/jobs/${id}`;
  if (type === "client") return `/clients/${id}`;
  return null;
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  candidate: UserCheck,
  job: Briefcase,
  client: Building2,
};

function activityDate(a: RecruitmentActivityItem): Date | null {
  const raw = a.date || a.created_at;
  if (!raw) return null;
  try {
    const d = parseISO(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function dayLabel(d: Date | null) {
  if (!d) return "Undated";
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d, yyyy");
}

export default function ActivitiesPage() {
  const [items, setItems] = useState<RecruitmentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: RecruitmentActivityItem[] }>>("/recruitment/activities");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

  const counts = useMemo(() => ({
    all: items.length,
    client_activity: items.filter((a) => a.type === "client_activity").length,
    system: items.filter((a) => a.type !== "client_activity").length,
  }), [items]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((a) => {
      if (filter === "client_activity" && a.type !== "client_activity") return false;
      if (filter === "system" && a.type === "client_activity") return false;
      if (!q) return true;
      return [a.title, a.description, a.client_name, a.assigned_to_name, a.created_by_name]
        .some((v) => v?.toLowerCase().includes(q));
    });
    const map = new Map<string, RecruitmentActivityItem[]>();
    for (const a of filtered) {
      const key = dayLabel(activityDate(a));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [items, filter, query]);

  const tabs: { id: Filter; label: string; icon: React.ElementType }[] = [
    { id: "all", label: "All", icon: CalendarDays },
    { id: "client_activity", label: "Client Tasks", icon: ClipboardCheck },
    { id: "system", label: "System", icon: Cpu },
  ];

  return (
    <PageWrapper>
      <Header
        title="Activities"
        subtitle="System activity and client tasks across your recruitment pipeline"
        icon={<CalendarDays className="h-5 w-5" />}
        actions={
          <Link href="/interviews">
            <Button variant="outline">View Interviews</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 mb-5 sm:grid-cols-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-card transition-all",
              filter === id ? "border-primary ring-2 ring-primary/15" : "border-slate-200 hover:border-primary-200",
            )}
          >
            <span className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg",
              filter === id ? "bg-primary text-white" : "bg-primary-50 text-primary-600",
            )}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-extrabold leading-none text-slate-900 tabular-nums">{loading ? "—" : counts[id]}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">Activity Timeline</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search activities..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        {loading ? <div className="p-5"><TableSkeleton rows={8} cols={3} /></div> : !groups.length ? (
          <EmptyState
            title={items.length ? "No matching activities" : "No activities yet"}
            description={items.length ? "Try a different filter or search term." : "Activity will appear here as you work with candidates, jobs, and clients."}
            icon={<CalendarDays className="w-8 h-8" />}
          />
        ) : (
          <div className="px-5 py-4">
            {groups.map(([day, list]) => (
              <section key={day} className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-primary-600">{day}</span>
                  <span className="h-px flex-1 bg-slate-100" />
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{list.length}</span>
                </div>
                <ol className="relative ml-4 border-l-2 border-slate-100">
                  {list.map((a) => {
                    const href = entityLink(a.entity_type, a.entity_id);
                    const label = a.client_name || `${a.entity_type} #${a.entity_id}`;
                    const isTask = a.type === "client_activity";
                    const EntityIcon = ENTITY_ICONS[a.entity_type] ?? CalendarDays;
                    const by = a.assigned_to_name || a.created_by_name;
                    return (
                      <li key={a.id} className="relative pb-3 pl-7 last:pb-0">
                        <span className={cn(
                          "absolute -left-[15px] top-2.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-sm",
                          isTask ? "bg-primary text-white" : "bg-slate-100 text-slate-500",
                        )}>
                          {isTask ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                        </span>
                        <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900">{a.title}</p>
                              {a.description && (
                                <p className="mt-0.5 line-clamp-2 text-[13px] text-slate-500">{a.description}</p>
                              )}
                            </div>
                            <span className={cn(
                              "status-pill",
                              isTask ? "bg-primary-50 text-primary-600 ring-primary-200" : "bg-slate-50 text-slate-600 ring-slate-200",
                            )}>
                              {isTask ? "Client Task" : "System"}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-500">
                            {href ? (
                              <Link href={href} className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                                <EntityIcon className="h-3.5 w-3.5" /> {label} <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5"><EntityIcon className="h-3.5 w-3.5" /> {label}</span>
                            )}
                            {by && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 text-[9px] font-bold text-white">
                                  {getInitials(by)}
                                </span>
                                <span className="font-semibold text-slate-600">{by}</span>
                              </span>
                            )}
                            {!a.date && a.created_at?.includes("T") && (
                              <span className="tabular-nums">{a.created_at.split("T")[1].slice(0, 5)}</span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
