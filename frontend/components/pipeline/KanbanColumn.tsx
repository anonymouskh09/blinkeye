"use client";

import { useDroppable } from "@dnd-kit/core";
import CandidateCard from "./CandidateCard";
import type { PipelineCard, PipelineStage } from "@/types";
import { PIPELINE_STAGE_LABELS, PIPELINE_SUCCESS_STAGES } from "@/types";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: PipelineStage;
  cards: PipelineCard[];
  variant?: "default" | "manatal";
  onSubmitCandidate?: (card: PipelineCard) => void;
  onCreateOffer?: (card: PipelineCard) => void;
}

export default function KanbanColumn({
  stage,
  cards,
  variant = "default",
  onSubmitCandidate,
  onCreateOffer,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const isSuccess = PIPELINE_SUCCESS_STAGES.includes(stage);

  if (variant === "manatal") {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex-shrink-0 w-[280px] bg-surface-muted transition-colors duration-200 border-r border-gray-200/60",
          isOver && "bg-primary-50/80",
          isSuccess && "border-t-[3px] border-t-green-500"
        )}
      >
        <div className="flex items-center justify-between px-3 py-3.5 border-b border-gray-200/60 bg-white/80 backdrop-blur-sm">
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{PIPELINE_STAGE_LABELS[stage]}</h3>
          <span className="text-xs text-gray-500 font-medium">({cards.length})</span>
        </div>
        <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-320px)] overflow-y-auto">
          {cards.map((card) => (
            <CandidateCard
              key={card.assignment_id}
              card={card}
              variant="manatal"
              onSubmitCandidate={onSubmitCandidate}
              onCreateOffer={onCreateOffer}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 bg-gray-50/80 rounded-2xl p-3 border border-gray-200/60 transition-colors duration-200 ${
        isOver ? "bg-primary-50 ring-2 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{PIPELINE_STAGE_LABELS[stage]}</h3>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{cards.length}</span>
      </div>
      <div className="space-y-2 min-h-[100px]">
        {cards.map((card) => (
          <CandidateCard
            key={card.assignment_id}
            card={card}
            onSubmitCandidate={onSubmitCandidate}
            onCreateOffer={onCreateOffer}
          />
        ))}
      </div>
    </div>
  );
}
