import { describe, expect, it } from "vitest";
import { cleanText, cleanMultiline, truncate } from "../src/utils/text";

describe("cleanText", () => {
  it("collapses whitespace and trims", () => {
    expect(cleanText("  John   Doe \n")).toBe("John Doe");
  });

  it("removes zero-width characters", () => {
    expect(cleanText("Jo\u200Bhn")).toBe("John");
  });

  it("preserves non-ASCII letters (Arabic)", () => {
    expect(cleanText("  محمد   خان ")).toBe("محمد خان");
  });

  it("returns empty string for nullish input", () => {
    expect(cleanText(null)).toBe("");
    expect(cleanText(undefined)).toBe("");
  });
});

describe("cleanMultiline", () => {
  it("preserves paragraph breaks but collapses excess blank lines", () => {
    const input = "Line 1\n\n\n\nLine 2   \n  Line 3";
    expect(cleanMultiline(input)).toBe("Line 1\n\nLine 2\nLine 3");
  });
});

describe("truncate", () => {
  it("adds an ellipsis when over the limit", () => {
    expect(truncate("abcdef", 4)).toBe("abc\u2026");
    expect(truncate("abc", 4)).toBe("abc");
  });
});
