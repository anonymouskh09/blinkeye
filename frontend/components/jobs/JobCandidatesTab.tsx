"use client";

import { useCallback, useEffect, useState } from "react";
import { CardSkeleton } from "@/components/ui/Skeleton";
import KanbanBoard from "@/components/pipeline/KanbanBoard";
import SubmitCandidateModal from "@/components/submissions/SubmitCandidateModal";
import CreateOfferModal from "@/components/offers/CreateOfferModal";
import api from "@/lib/api";
import type { ApiResponse, PipelineCard, PipelineData } from "@/types";

interface Props {
  jobId: string;
}

export default function JobCandidatesTab({ jobId }: Props) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitCard, setSubmitCard] = useState<PipelineCard | null>(null);
  const [offerCard, setOfferCard] = useState<PipelineCard | null>(null);

  const fetchPipeline = useCallback(() => {
    api
      .get<ApiResponse<PipelineData>>(`/jobs/${jobId}/pipeline`)
      .then((r) => setData(r.data.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  if (loading) return <CardSkeleton />;
  if (!data) return <p className="text-sm text-gray-400 text-center py-12">Failed to load pipeline</p>;

  return (
    <>
      <KanbanBoard
        data={data}
        onUpdate={fetchPipeline}
        variant="manatal"
        onSubmitCandidate={(card) => setSubmitCard(card)}
        onCreateOffer={(card) => setOfferCard(card)}
      />
      {submitCard && (
        <SubmitCandidateModal
          open={!!submitCard}
          onClose={() => setSubmitCard(null)}
          assignmentId={submitCard.assignment_id}
          candidateId={submitCard.candidate_id}
          jobId={Number(jobId)}
          onSuccess={() => fetchPipeline()}
        />
      )}
      {offerCard && (
        <CreateOfferModal
          open={!!offerCard}
          onClose={() => setOfferCard(null)}
          candidateId={offerCard.candidate_id}
          candidateName={offerCard.name}
          jobId={Number(jobId)}
          assignmentId={offerCard.assignment_id}
          onCreated={() => fetchPipeline()}
        />
      )}
    </>
  );
}
