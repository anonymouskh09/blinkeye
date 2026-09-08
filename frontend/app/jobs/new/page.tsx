"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";

function RedirectToJobsCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("create", "1");
    const clientId = searchParams.get("client_id");
    const engagementId = searchParams.get("engagement_id");
    if (clientId) params.set("client_id", clientId);
    if (engagementId) params.set("engagement_id", engagementId);
    router.replace(`/jobs?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <PageWrapper>
      <div className="p-8 text-sm text-slate-500">Opening create job...</div>
    </PageWrapper>
  );
}

export default function NewJobPage() {
  return (
    <Suspense
      fallback={
        <PageWrapper>
          <div className="p-8 text-sm text-slate-500">Loading...</div>
        </PageWrapper>
      }
    >
      <RedirectToJobsCreate />
    </Suspense>
  );
}
