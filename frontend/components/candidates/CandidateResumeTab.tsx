"use client";

import { useCallback, useRef, useState } from "react";
import { CloudUpload, Download, FileText, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import ResumeProcessingPanel from "@/components/candidates/ResumeProcessingPanel";
import { RESUME_PROCESS_STEPS } from "@/lib/resumeProcessing";
import { cn } from "@/lib/utils";

interface Props {
  candidateId: number;
  cvFilePath?: string | null;
  uploading: boolean;
  processing?: boolean;
  processStep?: number;
  version?: number;
  onUpload: (file: File) => Promise<void>;
}

function isPdf(path: string) {
  return path.toLowerCase().endsWith(".pdf");
}

export default function CandidateResumeTab({
  candidateId, cvFilePath, uploading, processing, processStep = 0, version = 0, onUpload,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");

  const cvUrl = cvFilePath ? `/api/candidates/${candidateId}/cv?v=${version}` : null;
  const showProcessing = uploading || processing;

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    await onUpload(file);
  }, [onUpload]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (showProcessing && !cvFilePath) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <ResumeProcessingPanel
          steps={RESUME_PROCESS_STEPS}
          currentStep={processStep}
          fileName={fileName}
        />
      </div>
    );
  }

  if (!cvFilePath) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.rtf" className="hidden" onChange={onInputChange} />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "mx-auto max-w-2xl m-6 border-2 border-dashed rounded-xl p-12 text-center transition-colors",
            dragOver ? "border-primary/40 bg-primary-50/60" : "border-primary/20 bg-primary-50/30",
            showProcessing && "opacity-60 pointer-events-none"
          )}
        >
          <CloudUpload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-primary mb-4">Drop CV / resume here to upload or</p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary-700"
          >
            <Upload className="h-4 w-4" /> Select file to upload
          </button>
          <p className="text-xs text-gray-400 mt-4">Supported file types (max 10MB): .pdf, .doc, .docx</p>
        </div>
      </div>
    );
  }

  const pdf = isPdf(cvFilePath);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col relative">
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.rtf" className="hidden" onChange={onInputChange} />

      {showProcessing && (
        <div className="absolute inset-0 z-10 bg-white/95 flex items-center justify-center">
          <ResumeProcessingPanel steps={RESUME_PROCESS_STEPS} currentStep={processStep} fileName={fileName} title="Updating resume" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 bg-gray-50 shrink-0">
        <p className="text-sm text-gray-600 truncate">Resume on file</p>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => window.open(cvUrl!, "_blank")}>
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} loading={showProcessing}>
            Replace
          </Button>
        </div>
      </div>

      {pdf ? (
        <iframe
          key={cvUrl}
          src={cvUrl!}
          title="Candidate resume"
          className="w-full border-0 bg-gray-100"
          style={{ height: "calc(100vh - 280px)", minHeight: 520 }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <FileText className="h-14 w-14 text-gray-300 mb-4" />
          <p className="text-sm text-gray-600 mb-2">Word documents cannot be previewed in the browser.</p>
          <p className="text-xs text-gray-400 mb-6">Download the file or upload a PDF to view it here.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(cvUrl!, "_blank")}>
              <Download className="h-4 w-4 mr-1" /> Download CV
            </Button>
            <Button onClick={() => fileRef.current?.click()} loading={showProcessing}>Upload PDF</Button>
          </div>
        </div>
      )}
    </div>
  );
}
