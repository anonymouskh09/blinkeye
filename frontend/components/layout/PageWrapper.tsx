"use client";



import Sidebar from "./Sidebar";

import { useAuth } from "@/hooks/useAuth";

import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";

import { Skeleton } from "@/components/ui/Skeleton";

import { cn } from "@/lib/utils";



function MainContent({ children }: { children: React.ReactNode }) {

  const { collapsed } = useSidebar();



  return (

    <main

      className={cn(

        "min-h-screen p-4 lg:p-8 bg-surface-muted transition-all duration-300",

        collapsed ? "ml-[72px]" : "ml-60",

      )}

    >

      <div className="max-w-[1600px] mx-auto">{children}</div>

    </main>

  );

}



export default function PageWrapper({ children }: { children: React.ReactNode }) {

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

        <MainContent>{children}</MainContent>

      </div>

    </SidebarProvider>

  );

}

