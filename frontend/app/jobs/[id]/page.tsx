"use client";

import { Suspense } from "react";
import { CardSkeleton } from "@/components/ui/Skeleton";
import PageWrapper from "@/components/layout/PageWrapper";
import JobDetailPageContent from "./JobDetailContent";

export default function JobDetailPage() {
  return (
    <Suspense fallback={<PageWrapper><CardSkeleton /></PageWrapper>}>
      <JobDetailPageContent />
    </Suspense>
  );
}
