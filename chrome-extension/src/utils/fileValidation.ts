import { cleanText } from "./text";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface FileValidationResult {
  ok: boolean;
  error?: string;
  kind?: "cv" | "linkedin_pdf";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** Heuristic: LinkedIn "Save to PDF" filenames often include Profile or LinkedIn. */
export function guessFileKind(file: File): "cv" | "linkedin_pdf" {
  const name = file.name.toLowerCase();
  if (name.includes("linkedin") || /profile.*\.pdf$/i.test(name) || name.endsWith("-profile.pdf")) {
    return "linkedin_pdf";
  }
  return "cv";
}

export function validateUploadFile(file: File | null | undefined): FileValidationResult {
  if (!file) return { ok: false, error: "No file selected." };
  const ext = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: "Only PDF, DOC, and DOCX files are allowed." };
  }
  if (file.size <= 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false, error: "File size exceeds 10MB limit." };
  }
  return { ok: true, kind: guessFileKind(file) };
}

export function sanitizeDisplayName(name: string): string {
  return cleanText(name.replace(/[\\/]+/g, "_")).slice(0, 180) || "resume";
}

export { MAX_FILE_SIZE, ALLOWED_EXTENSIONS };
