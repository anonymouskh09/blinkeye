"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import toast from "react-hot-toast";
import ClientBoardColumn from "./ClientBoardColumn";
import ClientBoardCard from "./ClientBoardCard";
import api from "@/lib/api";
import type { Client, ClientStage } from "@/types";

const BOARD_STAGES: ClientStage[] = ["prospect", "lead", "active", "on_hold", "inactive"];

function normalizeStage(stage: ClientStage): ClientStage {
  return stage === "customer" ? "on_hold" : stage;
}

function emptyBoard(): Record<string, Client[]> {
  return Object.fromEntries(BOARD_STAGES.map((s) => [s, []]));
}

function buildBoard(raw: Record<string, Client[]>): Record<string, Client[]> {
  const next = emptyBoard();
  for (const stage of Object.keys(raw)) {
    const key = normalizeStage(stage as ClientStage);
    if (!next[key]) next[key] = [];
    next[key].push(...(raw[stage] || []).map((c) => ({ ...c, stage: key })));
  }
  return next;
}

interface ClientsBoardProps {
  stages: Record<string, Client[]>;
  onUpdate: () => void;
}

export default function ClientsBoard({ stages: rawStages, onUpdate }: ClientsBoardProps) {
  const [stages, setStages] = useState(() => buildBoard(rawStages));
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  useEffect(() => {
    setStages(buildBoard(rawStages));
  }, [rawStages]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const total = useMemo(
    () => BOARD_STAGES.reduce((sum, s) => sum + (stages[s]?.length || 0), 0),
    [stages]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const client = event.active.data.current?.client as Client | undefined;
    if (client) setActiveClient(client);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveClient(null);
    const { active, over } = event;
    if (!over) return;

    const client = active.data.current?.client as Client | undefined;
    const newStage = over.id as ClientStage;
    if (!client || !BOARD_STAGES.includes(newStage)) return;

    const oldStage = normalizeStage(client.stage);
    if (oldStage === newStage) return;

    const prev = stages;
    const updated = emptyBoard();
    for (const s of BOARD_STAGES) {
      updated[s] = (stages[s] || []).filter((c) => c.id !== client.id);
    }
    updated[newStage] = [...updated[newStage], { ...client, stage: newStage }];
    setStages(updated);

    try {
      await api.put(`/clients/${client.id}`, { stage: newStage });
      toast.success("Status updated");
      onUpdate();
    } catch {
      setStages(prev);
      toast.error("Failed to move client");
    }
  };

  return (
    <div className="px-4 pb-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {BOARD_STAGES.map((stage) => (
            <ClientBoardColumn key={stage} stage={stage} clients={stages[stage] || []} />
          ))}
        </div>
        <DragOverlay>
          {activeClient ? <ClientBoardCard client={activeClient} overlay /> : null}
        </DragOverlay>
      </DndContext>
      {!total && (
        <p className="text-center text-sm text-gray-400 py-10">No clients on the board</p>
      )}
    </div>
  );
}
