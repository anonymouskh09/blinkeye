"use client";

import { Suspense } from "react";
import PageWrapper from "@/components/layout/PageWrapper";
import { CardSkeleton } from "@/components/ui/Skeleton";
import CandidateDetailContent from "./CandidateDetailContent";

export default function CandidateDetailPage() {
  return (
    <Suspense fallback={<PageWrapper><CardSkeleton /></PageWrapper>}>
      <CandidateDetailContent />
    </Suspense>
  );
}
