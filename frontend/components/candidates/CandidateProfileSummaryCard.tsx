"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Props {
  summary: string;
  onSave: (value: string) => Promise<void>;
}

export default function CandidateProfileSummaryCard({ summary, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(summary);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(summary);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
      toast.success("Summary updated");
    } catch {
      toast.error("Failed to save summary");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="group rounded-xl border border-gray-200 bg-[#f9fafb] p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-gray-900">Summary</h3>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-primary/30 hover:text-primary"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            placeholder="Write a professional summary for this candidate..."
            className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="group">
          {summary ? (
            <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-gray-600">{summary}</p>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className={cn(
                "text-left text-sm italic leading-relaxed text-gray-400 transition hover:text-primary",
              )}
            >
              Click to add a professional summary for this candidate...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
