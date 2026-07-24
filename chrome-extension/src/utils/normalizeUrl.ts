// Canonicalises LinkedIn profile URLs so duplicate detection is reliable.
// Rules: force https + www.linkedin.com host, keep only the /in/<slug>
// segment, drop query strings, fragments and trailing slashes, and lower-case
// the host (but NOT the slug — LinkedIn slugs are case-insensitive but we
// preserve as lower-case for a single canonical form).

export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = String(raw).trim();
  if (!value) return null;

  // Allow inputs without a protocol.
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!host.endsWith("linkedin.com")) return null;

  const match = url.pathname.match(/\/in\/([^/]+)/i);
  if (!match) return null;

  let slug = match[1];
  try {
    slug = decodeURIComponent(slug);
  } catch {
    // keep raw slug if it is not valid percent-encoding
  }
  slug = slug.trim().toLowerCase();
  if (!slug) return null;

  // Store the decoded (Unicode) slug so the canonical form matches the backend
  // normaliser exactly, keeping duplicate detection consistent across both.
  return `https://www.linkedin.com/in/${slug}`;
}

/** True when the given URL points at a LinkedIn member profile (/in/*). */
export function isLinkedInProfileUrl(raw: string | null | undefined): boolean {
  return normalizeLinkedInUrl(raw) !== null;
}
