"use client";

import {
  Briefcase, GitBranch, Star, Trophy, Upload, UserCheck, UserRound, Users,
} from "lucide-react";
import type { TeamMemberStats } from "@/types";

interface Props {
  stats: TeamMemberStats;
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-[#6B7280]">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-[#111827]">{value.toLocaleString()}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#6B7280]">{children}</h3>
  );
}

export default function TeamMemberOverviewTab({ stats }: Props) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Sourcing</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Candidates Created" value={stats.candidates_created} icon={Users} accent="bg-primary-50 text-primary-600" />
          <StatCard label="Candidates Owned" value={stats.candidates_owned} icon={UserRound} accent="bg-emerald-50 text-emerald-600" />
          <StatCard label="Resumes Added" value={stats.resumes_added} icon={Upload} accent="bg-secondary-50 text-secondary-600" />
        </div>
      </section>

      <section>
        <SectionTitle>Placement</SectionTitle>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Added to Job" value={stats.added_to_job} icon={GitBranch} accent="bg-amber-50 text-amber-600" />
          <StatCard label="Shortlisted" value={stats.shortlisted} icon={Star} accent="bg-emerald-50 text-emerald-600" />
          <StatCard label="Interviewed" value={stats.interviewed} icon={UserCheck} accent="bg-primary-50 text-primary-600" />
          <StatCard label="Offers" value={stats.offers} icon={Briefcase} accent="bg-orange-50 text-orange-600" />
          <StatCard label="Hired" value={stats.hired} icon={Trophy} accent="bg-green-50 text-green-600" />
        </div>
      </section>

      <section>
        <SectionTitle>Jobs</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total Jobs" value={stats.jobs.total} icon={Briefcase} accent="bg-gray-50 text-gray-600" />
          <StatCard label="Active" value={stats.jobs.active} icon={Briefcase} accent="bg-emerald-50 text-emerald-600" />
          <StatCard label="Pending" value={stats.jobs.pending} icon={Briefcase} accent="bg-primary-50 text-primary-500" />
          <StatCard label="On Hold" value={stats.jobs.on_hold} icon={Briefcase} accent="bg-amber-50 text-amber-600" />
          <StatCard label="Closed" value={stats.jobs.closed} icon={Briefcase} accent="bg-gray-50 text-gray-500" />
          <StatCard label="Filled" value={stats.jobs.filled} icon={Briefcase} accent="bg-secondary-50 text-secondary-600" />
        </div>
      </section>
    </div>
  );
}
