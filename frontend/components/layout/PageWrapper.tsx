"use client";

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
  const { collapsed } = useSidebar();
  const isDark = variant === "dark";

  return (
    <main
      className={cn(
        "min-h-screen transition-all duration-300",
        isDark ? "bg-[#0a0b0d]" : "bg-white",
        !flush && (isDark ? "p-5 lg:p-6" : "p-4 lg:p-8"),
        collapsed ? "ml-[72px]" : "ml-48",
      )}
    >
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
