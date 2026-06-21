"use client";

import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useRef } from "react";

interface FileUploadProps {
  label?: string;
  accept?: string;
  error?: string;
  onChange: (file: File | null) => void;
  value?: File | null;
}

export default function FileUpload({
  label = "Upload CV",
  accept = ".pdf,.doc,.docx",
  error,
  onChange,
  value,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 10 * 1024 * 1024) {
      alert("File size must be under 10MB");
      return;
    }
    onChange(file);
  };

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200",
          "hover:border-primary hover:bg-primary-50/50",
          error ? "border-red-500" : "border-gray-300"
        )}
      >
        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600">
          {value ? value.name : "Click to upload PDF, DOC, or DOCX (max 10MB)"}
        </p>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
