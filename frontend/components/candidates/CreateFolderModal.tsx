"use client";

import { useEffect, useState } from "react";
import AnimatedModal from "@/components/ui/AnimatedModal";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CandidateFolder } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string }) => Promise<void>;
  folder?: CandidateFolder | null;
  loading?: boolean;
}

export default function CreateFolderModal({ open, onClose, onSubmit, folder, loading }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isEdit = !!folder;
  const nameError = submitted && !name.trim();

  useEffect(() => {
    if (!open) return;
    if (folder) {
      setName(folder.name);
      setDescription(folder.description || "");
    } else {
      setName("");
      setDescription("");
    }
    setSubmitted(false);
  }, [open, folder]);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!name.trim()) return;
    await onSubmit({ name: name.trim(), description: description.trim() });
  };

  return (
    <AnimatedModal open={open} onClose={onClose} title={isEdit ? "Edit Folder" : "Create Folder"} size="md">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">
            Name<span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 255))}
              maxLength={255}
              placeholder="Name*"
              className={cn(
                "w-full rounded-lg border px-3 py-2.5 pr-16 text-sm outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary",
                nameError ? "border-red-400" : "border-gray-300"
              )}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              {name.length} / 255
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-800 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Description"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary resize-y min-h-[100px]"
          />
        </div>

        <div className="flex items-center justify-end gap-4 pt-2 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <Button onClick={handleSubmit} loading={loading}>{isEdit ? "Save" : "Continue"}</Button>
        </div>
      </div>
    </AnimatedModal>
  );
}
