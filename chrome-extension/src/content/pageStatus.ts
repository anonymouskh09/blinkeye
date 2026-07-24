// Determines whether a LinkedIn URL is a supported member profile (/in/*)
// versus an unsupported surface (feed, search, company, jobs, etc.).

const SUPPORTED_RE = /^https:\/\/www\.linkedin\.com\/in\/[^/]+/i;

const UNSUPPORTED_HINTS = [
  "/feed",
  "/search",
  "/company",
  "/school",
  "/jobs",
  "/mynetwork",
  "/messaging",
  "/notifications",
  "/groups",
  "/learning",
];

export function isSupportedProfileUrl(url: string): boolean {
  if (!SUPPORTED_RE.test(url)) return false;
  return !UNSUPPORTED_HINTS.some((hint) => {
    try {
      return new URL(url).pathname.startsWith(hint);
    } catch {
      return false;
    }
  });
}
