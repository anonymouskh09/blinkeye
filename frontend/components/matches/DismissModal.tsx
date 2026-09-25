"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  count: number;
  subject?: string;
  reasons: { value: string; label: string }[];
  saving: boolean;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}

export default function DismissModal({ open, count, subject, reasons, saving, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("not_a_fit");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setReason("not_a_fit");
      setNote("");
    }
  }, [open]);

  const needsNote = reason === "other" && !note.trim();

  return (
    <Modal open={open} onClose={onClose} title={count > 1 ? `Dismiss ${count} matches` : "Dismiss match"} size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {subject ? <>Hide <span className="font-bold text-slate-900">{subject}</span> from Matches.</> : "Hide these matches from Matches."}{" "}
          It is saved for the whole team and can be restored from the Dismissed tab.
        </p>
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Reason</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {reasons.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                  reason === r.value ? "border-primary bg-primary-50 text-primary-700" : "border-slate-200 text-slate-700 hover:bg-slate-50",
                )}
              >
                <input
                  type="radio"
                  name="dismiss-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="text-primary focus:ring-primary"
                />
                {r.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="dismiss-note" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Note {reason === "other" ? <span className="text-rose-500">*</span> : <span className="font-medium normal-case tracking-normal">(optional)</span>}
          </label>
          <textarea
            id="dismiss-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Add context for your team…"
            className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={() => onConfirm(reason, note.trim())} loading={saving} disabled={needsNote}>
            Dismiss
          </Button>
        </div>
      </div>
    </Modal>
  );
}
