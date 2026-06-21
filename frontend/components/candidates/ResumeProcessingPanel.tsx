"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  steps: readonly string[];
  currentStep: number;
  fileName?: string;
  title?: string;
}

export default function ResumeProcessingPanel({ steps, currentStep, fileName, title = "Processing resume" }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6">
      <div className="relative mb-6">
        <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      {fileName && <p className="text-xs text-gray-400 mb-6 truncate max-w-xs">{fileName}</p>}

      <div className="w-full max-w-sm space-y-3">
        {steps.map((step, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-all duration-300",
                active && "bg-primary-50 text-primary-700 font-medium",
                done && "text-green-700",
                !done && !active && "text-gray-400"
              )}
            >
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              ) : (
                <span className="h-4 w-4 rounded-full border-2 border-gray-200 shrink-0" />
              )}
              <span>{step}{active ? "..." : done ? "" : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
