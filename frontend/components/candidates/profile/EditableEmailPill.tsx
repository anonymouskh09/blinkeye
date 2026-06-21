"use client";

import { useState } from "react";
import { Check, Copy, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
}

export default function EditableEmailPill({ value, onSave, placeholder = "email address" }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success("Email copied");
  };

  if (editing) {
    return (
      <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-white py-1 pl-3 pr-1.5">
        <input
          autoFocus
          type="email"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          placeholder={placeholder}
          className="min-w-[180px] max-w-[280px] bg-transparent text-sm text-gray-800 outline-none"
        />
        <button type="button" onClick={cancel} className="rounded-full p-1 text-gray-400 hover:text-red-500">
          <X className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={save} disabled={saving} className="rounded-full p-1 text-primary">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="group inline-flex max-w-full items-center gap-1 rounded-full border border-gray-200 bg-white py-1.5 pl-2 pr-2.5 transition hover:border-gray-300">
      {value && (
        <button
          type="button"
          onClick={copy}
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-50 hover:text-primary"
          aria-label="Copy email"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
      {value ? (
        <button
          type="button"
          onClick={start}
          className="truncate text-sm text-gray-700 transition hover:text-primary"
        >
          {value}
        </button>
      ) : (
        <button type="button" onClick={start} className="text-sm text-primary hover:underline">
          + Add {placeholder}
        </button>
      )}
      {value && (
        <button
          type="button"
          onClick={start}
          className={cn(
            "rounded-full p-1 text-gray-400 opacity-0 transition hover:text-primary group-hover:opacity-100",
          )}
          aria-label="Edit email"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
