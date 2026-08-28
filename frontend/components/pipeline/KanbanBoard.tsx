"use client";

import { useEffect, useState } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import toast from "react-hot-toast";
import KanbanColumn from "./KanbanColumn";
import CandidateCard from "./CandidateCard";
import api from "@/lib/api";
import { PIPELINE_STAGES, PIPELINE_DIVIDER_AFTER_INDEX, type PipelineData, type PipelineCard, type PipelineStage } from "@/types";

interface KanbanBoardProps {
  data: PipelineData;
  onUpdate: () => void;
  variant?: "default" | "manatal";
  onSubmitCandidate?: (card: PipelineCard) => void;
}

export default function KanbanBoard({ data, onUpdate, variant = "default", onSubmitCandidate }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<PipelineCard | null>(null);
  const [stages, setStages] = useState(data.stages);
  useEffect(() => { setStages(data.stages); }, [data]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragStart = (event: DragStartEvent) => {
    const card = event.active.data.current?.card as PipelineCard;
    setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const assignmentId = Number(active.id);
    const newStage = over.id as PipelineStage;
    const card = active.data.current?.card as PipelineCard;
    if (!card || card.status === newStage) return;

    const oldStages = { ...stages };
    const updated = { ...stages };
    updated[card.status] = updated[card.status].filter((c) => c.assignment_id !== assignmentId);
    updated[newStage] = [...updated[newStage], { ...card, status: newStage }];
    setStages(updated);

    try {
      await api.put(`/candidate-jobs/${assignmentId}/status`, { status: newStage });
      toast.success("Stage updated");
      onUpdate();
    } catch {
      setStages(oldStages);
      toast.error("Failed to update stage");
    }
  };

  const visibleStages = variant === "manatal"
    ? PIPELINE_STAGES.filter((s) => s !== "rejected")
    : PIPELINE_STAGES;

  const allCards = visibleStages.flatMap((s) => stages[s]?.map((c) => ({ ...c, stage: s })) || []);

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex gap-0 overflow-x-auto pb-4">
          {visibleStages.map((stage, idx) => (
            <div key={stage} className="flex items-stretch">
              {variant === "manatal" && idx === PIPELINE_DIVIDER_AFTER_INDEX + 1 && (
                <div className="w-px mx-2 self-stretch border-l-2 border-dashed border-gray-300 shrink-0" aria-hidden />
              )}
              <KanbanColumn
                stage={stage}
                cards={stages[stage] || []}
                variant={variant}
                onSubmitCandidate={onSubmitCandidate}
              />
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeCard && <CandidateCard card={activeCard} variant={variant} />}
        </DragOverlay>
      </DndContext>

      {variant === "manatal" && (stages.rejected?.length ?? 0) > 0 && (
        <div className="mt-4 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
          {stages.rejected.length} dropped candidate{stages.rejected.length !== 1 ? "s" : ""}
        </div>
      )}

      {variant === "default" && allCards.length === 0 && (
        <p className="text-gray-500 text-sm py-8 text-center">No candidates in pipeline</p>
      )}
    </div>
  );
}
