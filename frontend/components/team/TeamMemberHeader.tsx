"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CopyButton from "@/components/ui/CopyButton";
import { cn, getInitials } from "@/lib/utils";
import type { User } from "@/types";

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-violet-100 text-violet-700 ring-violet-200",
  manager: "bg-sky-100 text-sky-700 ring-sky-200",
  recruiter: "bg-indigo-100 text-indigo-700 ring-indigo-200",
};

interface Props {
  user: User;
}

export default function TeamMemberHeader({ user }: Props) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <Link
        href="/team"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition hover:text-[#111827]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Team
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-bold text-white shadow-md">
          {getInitials(user.name)}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{user.name}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                ROLE_STYLES[user.role] ?? ROLE_STYLES.recruiter,
              )}
            >
              {user.role}
            </span>
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset",
                user.status === "active"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-gray-100 text-gray-600 ring-gray-200",
              )}
            >
              {user.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-[#374151]">{user.email}</span>
            <CopyButton value={user.email} successMessage="Email copied" />
          </div>
          <p className="mt-2 text-sm text-[#6B7280]">
            Member since{" "}
            {new Date(user.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
