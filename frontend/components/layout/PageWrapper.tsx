"use client";

import Sidebar from "./Sidebar";
import TopNavbar from "./TopNavbar";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

function MainContent({
  children,
  flush,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  const { collapsed } = useSidebar();

  return (
    <main
      className={cn(
        "min-h-screen pt-16 bg-surface-muted transition-all duration-300",
        !flush && "p-4 lg:p-8",
        collapsed ? "ml-[72px]" : "ml-60",
      )}
    >
      {flush ? children : <div className="max-w-[1600px] mx-auto">{children}</div>}
    </main>
  );
}

export default function PageWrapper({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  flush?: boolean;
}) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-muted">
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
      <div className="min-h-screen bg-surface-muted">
        <Sidebar />
        <TopNavbar />
        <MainContent flush={flush}>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
