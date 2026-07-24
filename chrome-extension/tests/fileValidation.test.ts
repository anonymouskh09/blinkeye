import { describe, expect, it } from "vitest";
import { validateUploadFile, guessFileKind, formatFileSize } from "../src/utils/fileValidation";

function fakeFile(name: string, size: number, type = "application/pdf"): File {
  const blob = new Blob([new Uint8Array(Math.min(size, 64))], { type });
  return new File([blob], name, { type });
}

describe("fileValidation", () => {
  it("accepts PDF and DOCX", () => {
    expect(validateUploadFile(fakeFile("cv.pdf", 1024)).ok).toBe(true);
    expect(validateUploadFile(fakeFile("resume.docx", 2048, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).ok).toBe(true);
  });

  it("accepts DOC extension for selection (parser may still reject legacy .doc)", () => {
    expect(validateUploadFile(fakeFile("old.doc", 1024, "application/msword")).ok).toBe(true);
  });

  it("rejects invalid extensions and oversized files", () => {
    expect(validateUploadFile(fakeFile("photo.png", 1024, "image/png")).ok).toBe(false);
    const huge = fakeFile("huge.pdf", 1024);
    Object.defineProperty(huge, "size", { value: 11 * 1024 * 1024 });
    expect(validateUploadFile(huge).ok).toBe(false);
  });

  it("guesses LinkedIn profile PDF from filename", () => {
    expect(guessFileKind(fakeFile("Profile.pdf", 100))).toBe("linkedin_pdf");
    expect(guessFileKind(fakeFile("jane-linkedin.pdf", 100))).toBe("linkedin_pdf");
    expect(guessFileKind(fakeFile("Mazhar_CV.pdf", 100))).toBe("cv");
  });

  it("formats file size", () => {
    expect(formatFileSize(500)).toMatch(/B/);
    expect(formatFileSize(2048)).toMatch(/KB/);
  });
});
