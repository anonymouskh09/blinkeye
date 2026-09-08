"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageWrapper from "@/components/layout/PageWrapper";

function RedirectToCandidatesCreate() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("create", "form");
    const folderId = searchParams.get("folder_id");
    if (folderId) params.set("folder_id", folderId);
    router.replace(`/candidates?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <PageWrapper>
      <div className="p-8 text-sm text-slate-500">Opening create candidate...</div>
    </PageWrapper>
  );
}

export default function NewCandidatePage() {
  return (
    <Suspense
      fallback={
        <PageWrapper>
          <div className="p-8 text-sm text-slate-500">Loading...</div>
        </PageWrapper>
      }
    >
      <RedirectToCandidatesCreate />
    </Suspense>
  );
}
