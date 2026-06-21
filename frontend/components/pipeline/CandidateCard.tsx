"use client";



import Link from "next/link";

import { useDraggable } from "@dnd-kit/core";

import { Eye, MoreVertical, Clock } from "lucide-react";

import { formatDistanceToNow } from "date-fns";

import { UserAvatar } from "@/components/clients/ClientAvatar";

import type { PipelineCard, PipelineStage } from "@/types";

import { PIPELINE_STAGE_LABELS } from "@/types";



interface CandidateCardProps {

  card: PipelineCard;

  variant?: "default" | "manatal";

}



export default function CandidateCard({ card, variant = "default" }: CandidateCardProps) {

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({

    id: String(card.assignment_id),

    data: { card },

  });



  const style = transform

    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }

    : undefined;



  const subtitle = [card.current_job_title, card.current_company ? `@ ${card.current_company}` : ""]

    .filter(Boolean).join(" ");



  const timeAgo = card.created_at

    ? formatDistanceToNow(new Date(card.created_at), { addSuffix: false })

    : null;



  if (variant === "manatal") {

    return (

      <div

        ref={setNodeRef}

        style={style}

        {...listeners}

        {...attributes}

        className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-card cursor-grab active:cursor-grabbing hover:shadow-card-hover hover:border-primary/20 transition-all group relative"

      >

        <div className="flex items-start gap-2.5">

          <UserAvatar name={card.name} size="md" />

          <div className="flex-1 min-w-0 pr-6">

            <Link href={`/candidates/${card.candidate_id}`} onClick={(e) => e.stopPropagation()}

              className="font-semibold text-sm text-gray-900 hover:text-primary block truncate">

              {card.name}

            </Link>

            {subtitle && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{subtitle}</p>}

            {timeAgo && (

              <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">

                <Clock className="h-3 w-3" /> {timeAgo}

              </div>

            )}

          </div>

          <button type="button" className="absolute top-2 right-2 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100"

            onClick={(e) => e.stopPropagation()}>

            <MoreVertical className="h-3.5 w-3.5" />

          </button>

        </div>

        <div className="flex justify-end mt-2">

          <Link href={`/candidates/${card.candidate_id}`} onClick={(e) => e.stopPropagation()}

            className="text-gray-400 hover:text-primary">

            <Eye className="h-3.5 w-3.5" />

          </Link>

        </div>

      </div>

    );

  }



  return (

    <div

      ref={setNodeRef}

      style={style}

      {...listeners}

      {...attributes}

      className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-card cursor-grab active:cursor-grabbing hover:shadow-card-hover hover:border-primary/20 transition-all duration-200"

    >

      <Link href={`/candidates/${card.candidate_id}`} onClick={(e) => e.stopPropagation()}>

        <p className="font-medium text-sm text-gray-900 hover:text-primary">{card.name}</p>

      </Link>

      <p className="text-xs text-gray-500 mt-1">{card.current_job_title || "—"}</p>

      {card.experience_years != null && (

        <p className="text-xs text-gray-400 mt-1">{card.experience_years} yrs exp</p>

      )}

    </div>

  );

}



export function ListViewRow({ card, stage }: { card: PipelineCard; stage: PipelineStage }) {

  return (

    <div className="flex items-center justify-between py-3 border-b border-gray-100">

      <div>

        <Link href={`/candidates/${card.candidate_id}`} className="font-medium text-primary hover:underline">

          {card.name}

        </Link>

        <p className="text-sm text-gray-500">{card.current_job_title}</p>

      </div>

      <span className="text-sm text-gray-500">{PIPELINE_STAGE_LABELS[stage]}</span>

    </div>

  );

}


