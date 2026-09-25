"use client";

import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

function MainContent({
  children,
  flush,
  variant,
}: {
  children: React.ReactNode;
  flush?: boolean;
  variant?: "default" | "dark";
}) {
  const { collapsed, setMobileOpen } = useSidebar();
  const isDark = variant === "dark";

  return (
    <main
      className={cn(
        "min-h-screen min-w-0 transition-all duration-300",
        isDark ? "bg-[#0a0b0d]" : "bg-surface-muted",
        !flush && (isDark ? "pt-3 px-5 pb-5 lg:pt-4 lg:px-6 lg:pb-6" : "pt-3 px-4 pb-4 lg:pt-4 lg:px-8 lg:pb-8"),
        collapsed ? "md:ml-[72px]" : "md:ml-48",
      )}
    >
      {/* Below md the sidebar is an off-canvas drawer opened from this bar. */}
      <div
        className={cn(
          "sticky top-0 z-20 mb-3 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 md:hidden",
          !flush && (isDark ? "-mx-5 -mt-3" : "-mx-4 -mt-3"),
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">R</span>
        <span className="text-sm font-bold text-slate-900">RecruitPro</span>
      </div>
      {flush ? children : <div className="max-w-[1600px] mx-auto">{children}</div>}
    </main>
  );
}

export default function PageWrapper({
  children,
  flush = false,
  variant = "default",
}: {
  children: React.ReactNode;
  flush?: boolean;
  variant?: "default" | "dark";
}) {
  const { loading } = useAuth();
  const isDark = variant === "dark";

  if (loading) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center",
          isDark ? "bg-[#0a0b0d]" : "bg-surface-muted",
        )}
      >
        <div className="space-y-4 w-72">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-4 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={cn("min-h-screen", isDark ? "bg-[#0a0b0d]" : "bg-surface-muted")}>
        <Sidebar />
        <MainContent flush={flush} variant={variant}>
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
