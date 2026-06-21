"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function PipelineRedirectPage() {
  const { id } = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/jobs/${id}?tab=candidates`);
  }, [id, router]);

  return null;
}
