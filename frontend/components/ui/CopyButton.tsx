"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
  size?: "sm" | "md";
}

export default function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  className,
  size = "sm",
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      aria-label={copied ? "Copied" : label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold text-gray-900 transition",
        "bg-amber-400 hover:bg-amber-500 active:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}
