"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Briefcase, Building2, History, LayoutGrid, UserCheck, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import TeamMemberHeader from "@/components/team/TeamMemberHeader";
import TeamMemberDateFilter, { type DateRange } from "@/components/team/TeamMemberDateFilter";
import TeamMemberOverviewTab from "@/components/team/TeamMemberOverviewTab";
import TeamMemberMatchesTab from "@/components/team/TeamMemberMatchesTab";
import TeamMemberCandidatesTab from "@/components/team/TeamMemberCandidatesTab";
import TeamMemberJobsTab from "@/components/team/TeamMemberJobsTab";
import TeamMemberClientsTab from "@/components/team/TeamMemberClientsTab";
import TeamMemberHistoryTab from "@/components/team/TeamMemberHistoryTab";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, TeamMemberOverview } from "@/types";

type Tab = "overview" | "matches" | "candidates" | "jobs" | "clients" | "history";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "matches", label: "Matches", icon: Users },
  { id: "candidates", label: "Candidates", icon: UserCheck },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "clients", label: "Clients", icon: Building2 },
  { id: "history", label: "History", icon: History },
];

export default function TeamMemberDetailPage() {
  useRequireRole("admin");
  const { id } = useParams();
  const userId = Number(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<TeamMemberOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const initialLoadRef = useRef(true);
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });

  const fetchOverview = useCallback(async () => {
    if (initialLoadRef.current) setLoading(true);
    else setRefreshing(true);
    try {
      const params: Record<string, string> = {};
      if (dateRange.from) params.date_from = dateRange.from;
      if (dateRange.to) params.date_to = dateRange.to;
      const res = await api.get<ApiResponse<TeamMemberOverview>>(`/users/${userId}/overview`, { params });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load team member");
      if (initialLoadRef.current) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoadRef.current = false;
    }
  }, [userId, dateRange.from, dateRange.to]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  if (loading && !data) {
    return (
      <PageWrapper>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-16 text-center text-sm text-[#6B7280]">
          Team member not found.
        </div>
      </PageWrapper>
    );
  }

  const pipelineCount = Object.values(data.pipeline).reduce((n, cards) => n + cards.length, 0);

  return (
    <PageWrapper>
      <div className="space-y-6">
        <TeamMemberHeader user={data.user} />
        <TeamMemberDateFilter value={dateRange} onChange={setDateRange} />

        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <div className="border-b border-[#E5E7EB] bg-[#F8FAFC]/60 px-2 pt-2">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map(({ id: tabId, label, icon: Icon }) => {
                const active = tab === tabId;
                let count: number | undefined;
                if (tabId === "matches") count = pipelineCount;
                if (tabId === "candidates") count = data.stats.candidates_created;
                if (tabId === "jobs") count = data.stats.jobs.total;
                if (tabId === "clients") count = data.stats.clients_count;

                return (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setTab(tabId)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-t-xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "border border-b-white border-[#E5E7EB] bg-white text-primary shadow-sm"
                        : "text-[#6B7280] hover:bg-white/70 hover:text-[#111827]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                    {count !== undefined && count > 0 && (
                      <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn("p-5 sm:p-6", refreshing && "pointer-events-none opacity-60")}>
            {tab === "overview" && <TeamMemberOverviewTab stats={data.stats} />}
            {tab === "matches" && <TeamMemberMatchesTab pipeline={data.pipeline} />}
            {tab === "candidates" && (
              <TeamMemberCandidatesTab
                userId={userId}
                dateFrom={dateRange.from || undefined}
                dateTo={dateRange.to || undefined}
              />
            )}
            {tab === "jobs" && <TeamMemberJobsTab jobs={data.jobs} />}
            {tab === "clients" && <TeamMemberClientsTab clients={data.clients} />}
            {tab === "history" && <TeamMemberHistoryTab history={data.history} userName={data.user.name} />}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
