"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionsInputProps {
  label?: string;
  value: string[];
  onChange: (questions: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
}

export default function QuestionsInput({
  label,
  value,
  onChange,
  placeholder = "e.g. Walk me through a recent project…",
  helperText,
  error,
}: QuestionsInputProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const q = draft.trim();
    if (!q) return;
    if (value.some((x) => x.toLowerCase() === q.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, q]);
    setDraft("");
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      )}
      <div className="space-y-2">
        {value.map((q, idx) => (
          <div
            key={`${idx}-${q.slice(0, 24)}`}
            className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <span className="mt-0.5 text-xs font-semibold text-gray-400">{idx + 1}.</span>
            <p className="flex-1 text-sm text-gray-800">{q}</p>
            <button
              type="button"
              onClick={() => remove(idx)}
              className="text-gray-400 hover:text-red-500"
              aria-label="Remove question"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div
          className={cn(
            "flex gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
            error && "border-red-400",
          )}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={add}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
}
