import { describe, expect, it } from "vitest";
import { isSupportedProfileUrl } from "../src/content/pageStatus";

describe("isSupportedProfileUrl", () => {
  it("accepts member profile URLs", () => {
    expect(isSupportedProfileUrl("https://www.linkedin.com/in/john-doe")).toBe(true);
    expect(isSupportedProfileUrl("https://www.linkedin.com/in/john-doe/")).toBe(true);
  });

  it("rejects unsupported LinkedIn surfaces", () => {
    for (const url of [
      "https://www.linkedin.com/feed/",
      "https://www.linkedin.com/search/results/people/",
      "https://www.linkedin.com/company/acme/",
      "https://www.linkedin.com/jobs/view/123",
      "https://www.linkedin.com/mynetwork/",
    ]) {
      expect(isSupportedProfileUrl(url)).toBe(false);
    }
  });

  it("rejects non-linkedin URLs", () => {
    expect(isSupportedProfileUrl("https://example.com/in/john")).toBe(false);
  });
});
