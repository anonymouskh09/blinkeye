import { describe, expect, it } from "vitest";
import { mergeLinkedInAndCv, applyConflictChoices } from "../src/utils/mergeProfile";
import type { CandidateProfile, ParsedResumeData } from "../src/types";

function li(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    fullName: "Jane Doe",
    headline: "Engineer at Acme",
    location: "Berlin",
    summary: "LinkedIn about",
    linkedinUrl: "https://www.linkedin.com/in/jane-doe",
    profileImageUrl: "https://media.licdn.com/jane.jpg",
    email: "",
    phone: "",
    experiences: [{ title: "Engineer", company: "Acme", is_current: true, start_date: "2021" }],
    educations: [{ school: "TU Berlin", degree: "BSc" }],
    skills: ["React"],
    certifications: [],
    languages: [],
    ...overrides,
  };
}

describe("mergeLinkedInAndCv", () => {
  it("fills missing email/phone from CV and merges lists without inventing", () => {
    const parsed: ParsedResumeData = {
      name: "Jane Doe",
      email: "jane@cv.com",
      phone: "+49 111",
      location: "Berlin",
      skills: ["React", "TypeScript"],
      experiences: [{ title: "Intern", company: "Old Co", start_date: "2019", end_date: "2020" }],
      educations: [{ school: "TU Berlin", degree: "BSc" }],
      profile_extras: {
        certifications: [{ name: "AWS", issuing_organization: "Amazon" }],
        languages: [{ language: "German", proficiency: "Professional" }],
      },
    };
    const { profile, conflicts } = mergeLinkedInAndCv(li(), parsed);
    expect(profile.email).toBe("jane@cv.com");
    expect(profile.phone).toBe("+49 111");
    expect(profile.profileImageUrl).toContain("licdn.com");
    expect(profile.skills).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(profile.experiences).toHaveLength(2);
    expect(profile.educations).toHaveLength(1);
    expect(profile.certifications[0]?.name).toBe("AWS");
    expect(profile.languages[0]?.language).toBe("German");
    expect(conflicts.some((c) => c.field === "email")).toBe(false);
  });

  it("records conflicts when LinkedIn and CV disagree on basic fields", () => {
    const parsed: ParsedResumeData = {
      name: "Jane D.",
      email: "other@cv.com",
      location: "Munich",
      current_job_title: "Senior Engineer",
      current_company: "Beta",
    };
    const { conflicts } = mergeLinkedInAndCv(
      li({ email: "jane@li.com", location: "Berlin" }),
      parsed,
    );
    const fields = conflicts.map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(["fullName", "email", "location", "currentJobTitle", "currentCompany"]));
  });

  it("keeps LinkedIn data when applying linkedin conflict choices", () => {
    const base = li({ email: "jane@li.com", location: "Berlin" });
    const parsed: ParsedResumeData = {
      name: "Jane D.",
      email: "other@cv.com",
      location: "Munich",
      current_job_title: "Senior Engineer",
      current_company: "Beta",
    };
    const merged = mergeLinkedInAndCv(base, parsed);
    for (const c of merged.conflicts) c.choice = "linkedin";
    const applied = applyConflictChoices(merged.profile, merged.conflicts, {
      linkedinTitle: merged.linkedinTitle,
      linkedinCompany: merged.linkedinCompany,
      cvTitle: merged.cvTitle,
      cvCompany: merged.cvCompany,
    });
    expect(applied.email).toBe("jane@li.com");
    expect(applied.location).toBe("Berlin");
  });
});
