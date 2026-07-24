// Unicode-safe text cleaning helpers. LinkedIn profiles frequently contain
// non-Latin scripts (Arabic, CJK, etc.), emojis, and invisible characters.
// We normalise to NFC, strip control/zero-width characters, and collapse
// whitespace WITHOUT stripping legitimate non-ASCII letters.

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u2060]/g;
// Control characters except tab/newline which we normalise to spaces.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(input: unknown): string {
  if (input == null) return "";
  let text = String(input);
  text = text.normalize("NFC");
  text = text.replace(ZERO_WIDTH, "");
  text = text.replace(CONTROL, " ");
  // Collapse any run of whitespace (incl. non-breaking space) into one space.
  text = text.replace(/[\s\u00A0]+/g, " ");
  return text.trim();
}

/** Clean multi-line blocks while preserving paragraph breaks. */
export function cleanMultiline(input: unknown): string {
  if (input == null) return "";
  let text = String(input).normalize("NFC").replace(ZERO_WIDTH, "");
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(CONTROL, " ");
  text = text
    .split("\n")
    .map((line) => line.replace(/[\s\u00A0]+/g, " ").trim())
    .join("\n");
  // Collapse 3+ blank lines to a single blank line.
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}\u2026`;
}
