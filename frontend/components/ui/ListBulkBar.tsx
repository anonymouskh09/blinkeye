"use client";

import { Download, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListBulkBarProps {
  selectedCount: number;
  totalVisible: number;
  onClearSelection?: () => void;
  onImportCsv?: () => void;
  onExportCsv?: () => void;
  onDownloadTemplate?: () => void;
  importing?: boolean;
  className?: string;
}

export default function ListBulkBar({
  selectedCount,
  totalVisible,
  onClearSelection,
  onImportCsv,
  onExportCsv,
  onDownloadTemplate,
  importing,
  className,
}: ListBulkBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2.5",
        className
      )}
    >
      <div className="text-xs text-slate-500">
        {selectedCount > 0 ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-semibold text-[#1F574A]">{selectedCount}</span> selected
            {onClearSelection && (
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
            <span className="text-slate-300">·</span>
            <span>{totalVisible} on this page</span>
          </span>
        ) : (
          <span>{totalVisible} on this page (filtered)</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onDownloadTemplate && (
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Template
          </button>
        )}
        {onImportCsv && (
          <button
            type="button"
            onClick={onImportCsv}
            disabled={importing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "Importing…" : "Import CSV"}
          </button>
        )}
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1F574A]/30 bg-[#1F574A]/5 px-2.5 py-1.5 text-xs font-semibold text-[#1F574A] transition hover:bg-[#1F574A]/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </button>
        )}
      </div>
    </div>
  );
}
