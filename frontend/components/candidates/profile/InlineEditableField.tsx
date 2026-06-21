"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: React.ReactNode;
  value?: string | null;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  className?: string;
}

export default function InlineEditableField({ icon, value, placeholder, onSave, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const start = () => {
    setDraft(value || "");
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value || "");
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="shrink-0 text-gray-400">{icon}</span>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 py-1 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button type="button" onClick={cancel} className="rounded p-1 text-gray-400 hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={save} disabled={saving} className="rounded p-1 text-primary"><Check className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className={cn("group flex items-center gap-2 text-sm", className)}>
      <span className="shrink-0 text-gray-400">{icon}</span>
      {value ? (
        <button type="button" onClick={start} className="text-left text-gray-600 transition hover:text-primary">
          {value}
        </button>
      ) : (
        <button type="button" onClick={start} className="text-primary hover:underline">
          + Add {placeholder.toLowerCase()}
        </button>
      )}
      {value && (
        <button type="button" onClick={start} className="rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:text-primary">
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
