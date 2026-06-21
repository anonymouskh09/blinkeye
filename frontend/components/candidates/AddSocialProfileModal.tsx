"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "@/components/candidates/SocialIcons";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (platform: string, url: string) => void;
  saving?: boolean;
  existingPlatforms?: string[];
}

export default function AddSocialProfileModal({
  open, onClose, onAdd, saving, existingPlatforms = [],
}: Props) {
  const [platform, setPlatform] = useState<SocialPlatformId>("twitter");
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setSubmitted(false);
      setPlatform("twitter");
      return;
    }
    const firstAvailable = SOCIAL_PLATFORMS.find((p) => !existingPlatforms.includes(p.id));
    if (firstAvailable) setPlatform(firstAvailable.id);
  }, [open, existingPlatforms]);

  const selected = SOCIAL_PLATFORMS.find((p) => p.id === platform);
  const urlError = submitted && !url.trim();

  const handleAdd = () => {
    setSubmitted(true);
    if (!url.trim()) return;
    onAdd(platform, url.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title="Add social media profile" size="lg">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-800 mb-3">
            Select a social media<span className="text-red-500">*</span>
          </label>
          <div className="max-h-[280px] overflow-y-auto pr-1 border border-gray-100 rounded-lg p-3 bg-gray-50/40">
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {SOCIAL_PLATFORMS.map(({ id, label, shortLabel, icon: Icon }) => {
                const taken = existingPlatforms.includes(id);
                const active = platform === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={taken}
                    onClick={() => !taken && setPlatform(id)}
                    title={taken ? `${label} already added` : label}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-3 rounded-lg border bg-white transition-all min-h-[88px]",
                      active && !taken && "border-primary ring-1 ring-primary-500 shadow-sm",
                      !active && !taken && "border-gray-200 hover:border-gray-300 hover:shadow-sm",
                      taken && "opacity-40 cursor-not-allowed border-gray-100 bg-gray-50"
                    )}
                  >
                    <Icon className="h-7 w-7 shrink-0" />
                    <span className="text-[11px] text-gray-600 text-center leading-tight line-clamp-2 px-0.5">
                      {shortLabel || label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="social-url" className="block text-sm font-medium text-gray-800 mb-1.5">
            Enter account URL<span className="text-red-500">*</span>
          </label>
          <input
            id="social-url"
            type="url"
            maxLength={255}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={selected?.placeholder || "https://www.example.com"}
            className={cn(
              "w-full rounded-lg border px-3 py-2.5 text-sm transition-colors outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary",
              urlError ? "border-red-400 bg-red-50/30" : "border-gray-300"
            )}
          />
          <div className="flex items-center justify-between mt-1.5">
            {urlError ? (
              <p className="text-xs text-red-500">The url field is required</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-gray-400">{url.length} / 255</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <Button onClick={handleAdd} loading={saving} className="min-w-[80px]">
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}
