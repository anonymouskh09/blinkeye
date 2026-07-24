import { describe, expect, it } from "vitest";
import { normalizeLinkedInUrl, isLinkedInProfileUrl } from "../src/utils/normalizeUrl";

describe("normalizeLinkedInUrl", () => {
  it("strips query strings, fragments and trailing slashes", () => {
    expect(normalizeLinkedInUrl("https://www.linkedin.com/in/john-doe/?trk=abc#exp")).toBe(
      "https://www.linkedin.com/in/john-doe",
    );
  });

  it("adds a protocol when missing and lower-cases the host", () => {
    expect(normalizeLinkedInUrl("LinkedIn.com/in/Jane-Smith")).toBe(
      "https://www.linkedin.com/in/jane-smith",
    );
  });

  it("handles regional subdomains", () => {
    expect(normalizeLinkedInUrl("https://uk.linkedin.com/in/someone")).toBe(
      "https://www.linkedin.com/in/someone",
    );
  });

  it("decodes percent-encoded unicode slugs", () => {
    const url = "https://www.linkedin.com/in/%D9%85%D8%AD%D9%85%D8%AF";
    expect(normalizeLinkedInUrl(url)).toBe("https://www.linkedin.com/in/محمد");
  });

  it("returns null for non-profile or non-linkedin URLs", () => {
    expect(normalizeLinkedInUrl("https://www.linkedin.com/feed/")).toBeNull();
    expect(normalizeLinkedInUrl("https://example.com/in/john")).toBeNull();
    expect(normalizeLinkedInUrl("")).toBeNull();
    expect(normalizeLinkedInUrl(null)).toBeNull();
  });

  it("isLinkedInProfileUrl reflects normalization", () => {
    expect(isLinkedInProfileUrl("https://www.linkedin.com/in/john")).toBe(true);
    expect(isLinkedInProfileUrl("https://www.linkedin.com/company/acme")).toBe(false);
  });
});
