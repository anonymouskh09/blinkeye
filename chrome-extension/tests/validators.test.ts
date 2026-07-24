import { describe, expect, it } from "vitest";
import { isValidEmail, validateProfile, toImportPayload } from "../src/utils/validators";
import type { CandidateProfile } from "../src/types";

function profile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    fullName: "Jane Doe",
    headline: "Engineer",
    location: "Berlin",
    summary: "About me",
    linkedinUrl: "https://www.linkedin.com/in/jane-doe",
    profileImageUrl: "https://media.example.com/x.jpg",
    email: "jane@example.com",
    phone: "+49 123",
    experiences: [],
    educations: [],
    skills: [],
    certifications: [],
    languages: [],
    ...overrides,
  };
}

describe("isValidEmail", () => {
  it("accepts valid and rejects invalid", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("validateProfile", () => {
  it("requires a full name", () => {
    const result = validateProfile(profile({ fullName: "   " }));
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toBeTruthy();
  });

  it("flags invalid email and linkedin url", () => {
    const result = validateProfile(profile({ email: "bad", linkedinUrl: "https://example.com/x" }));
    expect(result.errors.email).toBeTruthy();
    expect(result.errors.linkedinUrl).toBeTruthy();
  });

  it("passes a clean profile", () => {
    expect(validateProfile(profile()).valid).toBe(true);
  });
});

describe("toImportPayload", () => {
  it("normalizes url, lowercases email and sets source", () => {
    const payload = toImportPayload(
      profile({ linkedinUrl: "https://www.linkedin.com/in/Jane-Doe/?x=1", email: "JANE@EXAMPLE.COM" }),
      { jobId: 5, ownerId: null, stage: "applied", tags: [] },
    );
    expect(payload.linkedinUrl).toBe("https://www.linkedin.com/in/jane-doe");
    expect(payload.email).toBe("jane@example.com");
    expect(payload.source).toBe("linkedin_extension");
    expect(payload.importedVia).toBe("chrome_extension");
    expect(payload.jobId).toBe(5);
    expect(payload.tags).toBeUndefined();
  });

  it("includes experiences skills certifications and importedVia", () => {
    const payload = toImportPayload(
      profile({
        experiences: [{ title: "Eng", company: "Acme", is_current: true }],
        skills: ["React"],
        certifications: [{ name: "AWS SAA", issuing_organization: "Amazon" }],
        languages: [{ language: "English", proficiency: "Native" }],
      }),
      { importedVia: "chrome_extension_cv" },
    );
    expect(payload.experiences?.[0].title).toBe("Eng");
    expect(payload.skills).toEqual(["React"]);
    expect(payload.certifications?.[0].name).toBe("AWS SAA");
    expect(payload.languages?.[0].language).toBe("English");
    expect(payload.importedVia).toBe("chrome_extension_cv");
    expect(payload.currentJobTitle).toBe("Eng");
    expect(payload.currentCompany).toBe("Acme");
  });
});
