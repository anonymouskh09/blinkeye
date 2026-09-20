"use client";

import { KeyboardEvent, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillsInputProps {
  label?: string;
  value: string[];
  onChange: (skills: string[]) => void;
  placeholder?: string;
  helperText?: string;
  error?: string;
}

export default function SkillsInput({
  label,
  value,
  onChange,
  placeholder = "Type a skill and press Enter",
  helperText,
  error,
}: SkillsInputProps) {
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const skill = raw.trim().replace(/,$/, "").trim();
    if (!skill) return;
    if (value.some((s) => s.toLowerCase() === skill.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, skill]);
    setDraft("");
  };

  const remove = (skill: string) => onChange(value.filter((s) => s !== skill));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      )}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition-all duration-200",
          "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
          error && "border-red-400 focus-within:border-red-400 focus-within:ring-red-500/20",
        )}
      >
        {value.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-medium text-primary"
          >
            {skill}
            <button
              type="button"
              onClick={() => remove(skill)}
              className="text-primary/60 transition-colors hover:text-primary"
              aria-label={`Remove ${skill}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-gray-400"
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1.5 text-xs text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
}
