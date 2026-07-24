import { SELECTORS, type FieldSelectors, type SelectorKey } from "./selectors";
import { extractSections } from "./extractSections";
import { aggressiveEnrich } from "./aggressiveScrape";
import { cleanText, cleanMultiline } from "../utils/text";
import { normalizeLinkedInUrl } from "../utils/normalizeUrl";
import { safeImageUrl } from "../utils/sanitize";
import type { CandidateProfile, ExtractionResult } from "../types";

// Pure extraction against a provided Document, so it can be unit-tested with
// JSDOM fixtures. The content script passes `document`.
//
// Strategy order (most reliable → last resort):
// 1. CSS selectors (with open-shadow piercing)
// 2. Structural walk of the top card (h1 + nearby siblings)
// 3. Meta / <title> / JSON-LD fallbacks
// 4. Section parsers for About / Experience / Education / Skills
// 5. Profile photo heuristics (never prefer cover/banner)

const NOISE_NAME = /^(linkedin|home|feed|notifications?|messaging|jobs)$/i;
const COVER_IMAGE_RE =
  /profile-displaybackgroundimage|backgroundimage|cover.?photo|banner|ghost-person|data:image\/gif/i;
const PROFILE_PHOTO_RE = /profile-displayphoto|profile-framedphoto|profile-photo|pv-top-card-profile-picture/i;
const NAV_IMAGE_RE = /global-nav|EntityPhoto|presence-entity|nav__me|feed-identity|share-box/i;
const ORG_LOCATION_RE =
  /\b(university|universit(?:y|é)|institute|college|school of|department of|inc\.|ltd\.|llc|pvt|private limited|technologies|engineering and technology)\b/i;
const GEO_HINT_RE =
  /\b(pakistan|india|uae|dubai|london|remote|cantonment|punjab|sindh|balochistan|kpk|karachi|lahore|islamabad|rawalpindi|faisalabad|multan|peshawar|united states|united kingdom|canada|germany|remote)\b/i;

/** querySelectorAll that also walks open shadow roots (LinkedIn sometimes nests UI). */
function deepQueryAll(root: ParentNode, selector: string): Element[] {
  const out: Element[] = [];
  const visit = (node: ParentNode) => {
    try {
      out.push(...Array.from(node.querySelectorAll(selector)));
    } catch {
      /* invalid selector in this engine */
    }
    const all = "querySelectorAll" in node ? node.querySelectorAll("*") : [];
    for (const el of Array.from(all)) {
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  visit(root);
  return out;
}

function readAttrOrText(node: Element, attr?: string): string {
  if (attr) {
    if (attr === "src") {
      const candidates = [
        node.getAttribute("src"),
        node.getAttribute("data-delayed-url"),
        node.getAttribute("data-ghost-url"),
        (node as HTMLImageElement).currentSrc,
      ];
      const srcset = node.getAttribute("srcset");
      if (srcset) {
        const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
        candidates.unshift(first ?? null);
      }
      for (const c of candidates) {
        if (c && c.trim() && !c.startsWith("data:")) return c.trim();
      }
      return "";
    }
    return (node.getAttribute(attr) ?? "").trim();
  }
  const hidden = node.querySelector("span[aria-hidden='true']");
  return (hidden?.textContent ?? node.textContent ?? "").trim();
}

function readField(doc: Document, field: FieldSelectors): string {
  for (const selector of field.css) {
    const nodes = deepQueryAll(doc, selector);
    for (const node of nodes) {
      const value = readAttrOrText(node, field.attr);
      if (value) return value;
    }
  }
  return "";
}

function metaContent(doc: Document, ...selectors: string[]): string {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    const content =
      el?.getAttribute("content") ||
      (el as HTMLMetaElement | null)?.content ||
      el?.getAttribute("href") ||
      "";
    if (content?.trim()) return content.trim();
  }
  return "";
}

function parseTitleParts(raw: string): { name: string; headline: string } {
  let title = cleanText(raw);
  title = title.replace(/\s*[\|\-–—]\s*LinkedIn\s*$/i, "").trim();
  title = title.replace(/\s*\(\d+\)\s*$/g, "").trim();
  if (!title || NOISE_NAME.test(title)) return { name: "", headline: "" };
  const split = title.split(/\s+[\-–—|]\s+/);
  if (split.length >= 2) {
    return { name: cleanText(split[0]), headline: cleanText(split.slice(1).join(" - ")) };
  }
  return { name: title, headline: "" };
}

function fromJsonLd(doc: Document): Partial<CandidateProfile> {
  const out: Partial<CandidateProfile> = {};
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent || "");
      const nodes = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        const type = String(node["@type"] || "");
        if (!/Person|ProfilePage/i.test(type) && !node.name) continue;
        if (typeof node.name === "string" && !out.fullName) out.fullName = cleanText(node.name);
        if (typeof node.jobTitle === "string" && !out.headline) out.headline = cleanText(node.jobTitle);
        if (typeof node.description === "string" && !out.summary) out.summary = cleanMultiline(node.description);
        const img = node.image;
        if (!out.profileImageUrl) {
          if (typeof img === "string") out.profileImageUrl = pickProfileImageUrl(img) ?? "";
          else if (img && typeof img === "object" && typeof img.url === "string") {
            out.profileImageUrl = pickProfileImageUrl(img.url) ?? "";
          }
        }
        const loc = node.address;
        if (!out.location && loc) {
          if (typeof loc === "string") out.location = cleanText(loc);
          else if (typeof loc === "object") {
            out.location = cleanText(
              [loc.addressLocality, loc.addressRegion, loc.addressCountry].filter(Boolean).join(", "),
            );
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

function findTopCard(doc: Document): { card: Element; nameEl: Element; name: string } | null {
  const headings = deepQueryAll(doc, "main h1, h1.text-heading-xlarge, h1.inline, h1");
  for (const h of headings) {
    if (h.closest("header, nav, #global-nav, .global-nav, aside")) continue;
    const text = cleanText(readAttrOrText(h));
    if (!text || text.length < 2 || text.length > 120) continue;
    if (NOISE_NAME.test(text)) continue;
    if (/connections?|followers?|about|experience|education/i.test(text)) continue;
    const card =
      h.closest("section.artdeco-card") ||
      h.closest("section") ||
      h.closest("div.ph5") ||
      h.closest("[data-member-id]") ||
      h.parentElement?.parentElement ||
      h.parentElement;
    if (!card) continue;
    if (card.closest("header, nav, #global-nav, .global-nav")) continue;
    return { card, nameEl: h, name: text };
  }
  return null;
}

function isChromeChromeNoise(img: Element): boolean {
  if (img.closest("header, nav, #global-nav, .global-nav, aside, footer")) return true;
  const blob = `${img.className} ${img.id} ${img.getAttribute("alt") || ""}`;
  return NAV_IMAGE_RE.test(blob);
}

function scoreGeoLocation(text: string, headline: string, name: string): number {
  const t = cleanText(text);
  if (!t || t === name || t === headline) return -1;
  if (t.length < 4 || t.length > 90) return -1;
  if (/contact info/i.test(t) && t.length < 20) return -1;
  if (ORG_LOCATION_RE.test(t)) return -1;
  if (/^\d[\d,+]*\+?\s*(connections?|followers?)$/i.test(t)) return -1;
  if (/^(connect|message|follow|pending|more)$/i.test(t)) return -1;

  let score = 0;
  const commas = (t.match(/,/g) || []).length;
  if (commas >= 2) score += 5; // "Lahore, Punjab, Pakistan"
  else if (commas === 1) score += 2;
  if (GEO_HINT_RE.test(t)) score += 4;
  if (/^[A-Za-z\u0600-\u06FF .'-]+,\s*[A-Za-z\u0600-\u06FF .'-]+,\s*[A-Za-z\u0600-\u06FF .'-]+$/.test(t)) {
    score += 6;
  }
  // Workplace lines often include "University of X, City" — already rejected by ORG_LOCATION_RE.
  return score;
}

function pickBestLocation(candidates: string[], headline: string, name: string): string {
  let best = "";
  let bestScore = 0;
  for (const raw of candidates) {
    const cleaned = cleanText(raw).replace(/\s*[-–—]?\s*Contact info\s*$/i, "").trim();
    const score = scoreGeoLocation(cleaned, headline, name);
    if (score > bestScore) {
      bestScore = score;
      best = cleaned;
    }
  }
  return bestScore > 0 ? best : "";
}

function fromTopCardStructure(doc: Document): Partial<CandidateProfile> {
  const out: Partial<CandidateProfile> = {};
  const top = findTopCard(doc);
  if (!top) return out;
  const { card, nameEl, name } = top;
  out.fullName = name;

  const snippets: string[] = [];
  for (const el of Array.from(card.querySelectorAll("div, span, p, a"))) {
    if (nameEl.contains(el) || el.contains(nameEl)) continue;
    if (el.closest("nav, header, footer")) continue;
    // Keep "Contact info" row location text; skip action buttons.
    if (el.closest("button") && !/contact info/i.test(el.textContent || "")) continue;
    const text = cleanText(el.textContent);
    if (!text || text === out.fullName) continue;
    if (text.length > 280) continue;
    if (el.childElementCount > 4 && text.length > 80) continue;
    if (/^(connect|message|more|follow|pending)$/i.test(text)) continue;
    if (/^\d[\d,+]*\+?\s*(connections?|followers?)$/i.test(text)) continue;
    if (!snippets.includes(text)) snippets.push(text);
  }

  for (const s of snippets) {
    if (out.headline) break;
    if (s.length < 8 || s.length > 260) continue;
    if (s.length >= 20 || /developer|engineer|manager|founder|scholar|analyst|at |\|/i.test(s)) {
      out.headline = s;
    }
  }
  if (!out.headline) {
    const candidate = snippets.find((s) => s.length >= 12 && s.length <= 260);
    if (candidate) out.headline = candidate;
  }

  out.location = pickBestLocation(snippets, out.headline || "", name);

  // Photo: ONLY from this top card (never global-nav / me avatar).
  out.profileImageUrl = extractPhotoFromCard(card, name);

  return out;
}

function fromMetaAndTitle(doc: Document): Partial<CandidateProfile> {
  const out: Partial<CandidateProfile> = {};
  const ogTitle = metaContent(doc, 'meta[property="og:title"]', 'meta[name="twitter:title"]');
  const docTitle = doc.title || "";
  const parsed = parseTitleParts(ogTitle || docTitle);
  if (parsed.name) out.fullName = parsed.name;
  if (parsed.headline) out.headline = parsed.headline;

  const ogDesc = metaContent(doc, 'meta[property="og:description"]', 'meta[name="description"]');
  if (ogDesc) {
    const cleaned = cleanText(ogDesc);
    if (cleaned && !out.headline && cleaned.length <= 220) out.headline = cleaned;
    else if (cleaned && !out.summary) out.summary = cleanMultiline(ogDesc);
  }

  // og:image is often the COVER banner — only accept if it looks like a profile photo.
  const ogImage = metaContent(doc, 'meta[property="og:image"]', 'meta[name="twitter:image"]');
  if (ogImage) out.profileImageUrl = pickProfileImageUrl(ogImage) ?? "";

  return out;
}

function extractCanonicalUrl(doc: Document, fallbackUrl: string): string {
  const canonical = doc.querySelector<HTMLLinkElement>("link[rel='canonical']");
  const og = doc.querySelector<HTMLMetaElement>("meta[property='og:url']");
  const candidates = [canonical?.href, og?.content, fallbackUrl];
  for (const candidate of candidates) {
    const normalized = normalizeLinkedInUrl(candidate);
    if (normalized) return normalized;
  }
  return normalizeLinkedInUrl(fallbackUrl) ?? "";
}

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    const cleaned = cleanText(v);
    if (cleaned) return cleaned;
  }
  return "";
}

function firstNonEmptyRaw(...values: Array<string | undefined | null>): string {
  for (const v of values) {
    if (v && String(v).trim()) return String(v);
  }
  return "";
}

/** Reject cover/banner URLs; accept only likely profile photos. */
export function pickProfileImageUrl(raw: string | null | undefined): string | null {
  const url = safeImageUrl(raw);
  if (!url) return null;
  if (COVER_IMAGE_RE.test(url)) return null;
  if (PROFILE_PHOTO_RE.test(url)) return url;
  if (/media\.licdn\.com/i.test(url) && !/background/i.test(url)) return url;
  return null;
}

function extractPhotoFromCard(card: Element, candidateName: string): string {
  const firstName = cleanText(candidateName).split(/\s+/)[0]?.toLowerCase() || "";
  const scored: Array<{ url: string; score: number }> = [];

  for (const img of Array.from(card.querySelectorAll("img"))) {
    if (isChromeChromeNoise(img)) continue;
    const src = readAttrOrText(img, "src");
    const url = pickProfileImageUrl(src);
    if (!url) continue;

    let score = 1;
    const alt = (img.getAttribute("alt") || "").toLowerCase();
    const cls = `${img.className}`;
    if (/pv-top-card-profile-picture/i.test(cls)) score += 10;
    if (PROFILE_PHOTO_RE.test(url) || PROFILE_PHOTO_RE.test(cls)) score += 6;
    if (firstName && alt.includes(firstName)) score += 8;
    if (/profile.?photo|profile.?picture/i.test(alt)) score += 4;
    // Prefer larger rendered images.
    const w = Number(img.getAttribute("width") || (img as HTMLImageElement).width || 0);
    if (w >= 100) score += 3;
    if (w >= 180) score += 2;
    scored.push({ url, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url || "";
}

/**
 * Profile photo MUST come from the candidate top-card only.
 * LinkedIn's global-nav also uses profile-displayphoto URLs for *your* avatar —
 * scanning the whole document incorrectly picks "me".
 */
function extractBestProfileImage(doc: Document, candidateName: string, fallbacks: Array<string | undefined>): string {
  const top = findTopCard(doc);
  if (top) {
    const fromCard = extractPhotoFromCard(top.card, candidateName || top.name);
    if (fromCard) return fromCard;
  }

  // Narrow CSS selectors (already scoped to main top-card classes).
  for (const selector of SELECTORS.profileImageUrl.css) {
    for (const node of deepQueryAll(doc, selector)) {
      if (isChromeChromeNoise(node)) continue;
      const url = pickProfileImageUrl(readAttrOrText(node, SELECTORS.profileImageUrl.attr));
      if (url) return url;
    }
  }

  for (const fb of fallbacks) {
    const url = pickProfileImageUrl(fb);
    if (url) return url;
  }
  return "";
}

function sanitizeLocation(raw: string, headline: string, name: string): string {
  const cleaned = cleanText(raw).replace(/\s*[-–—]?\s*Contact info\s*$/i, "").trim();
  if (scoreGeoLocation(cleaned, headline, name) <= 0) return "";
  return cleaned;
}

export function extractProfile(doc: Document, pageUrl: string): ExtractionResult {
  const get = (key: SelectorKey) => readField(doc, SELECTORS[key]);

  const structural = fromTopCardStructure(doc);
  const meta = fromMetaAndTitle(doc);
  const jsonLd = fromJsonLd(doc);
  const sections = extractSections(doc);

  const fullName = firstNonEmpty(structural.fullName, cleanText(get("fullName")), jsonLd.fullName, meta.fullName);
  const headline = firstNonEmpty(structural.headline, cleanText(get("headline")), jsonLd.headline, meta.headline);

  const location = pickBestLocation(
    [
      structural.location || "",
      cleanText(get("location")),
      jsonLd.location || "",
      meta.location || "",
    ],
    headline,
    fullName,
  );

  const profile: CandidateProfile = {
    fullName,
    headline,
    location: sanitizeLocation(location, headline, fullName) || location,
    summary: cleanMultiline(
      firstNonEmptyRaw(sections.summary, cleanMultiline(get("summary")), structural.summary, jsonLd.summary, meta.summary),
    ),
    linkedinUrl: extractCanonicalUrl(doc, pageUrl),
    profileImageUrl: extractBestProfileImage(doc, fullName, [
      structural.profileImageUrl,
      jsonLd.profileImageUrl,
      // Never trust og:image first — often cover OR wrong composite.
      meta.profileImageUrl,
    ]),
    email: "",
    phone: "",
    experiences: sections.experiences,
    educations: sections.educations,
    skills: sections.skills,
    certifications: sections.certifications,
    languages: sections.languages,
    sectionStatuses: sections.sectionStatuses,
  };

  if (profile.fullName && NOISE_NAME.test(profile.fullName)) {
    profile.fullName = "";
  }

  if (profile.location) {
    profile.location = profile.location.replace(/\s*[-–—]?\s*Contact info\s*$/i, "").trim();
    if (ORG_LOCATION_RE.test(profile.location) && !GEO_HINT_RE.test(profile.location.split(",")[0] || "")) {
      if (scoreGeoLocation(profile.location, profile.headline, profile.fullName) < 5) {
        profile.location = "";
      }
    }
  }

  // LinkedIn A/B layouts often break class selectors — fill gaps aggressively.
  const enriched = aggressiveEnrich(doc, profile);

  const scalarKeys: (keyof CandidateProfile)[] = [
    "fullName",
    "headline",
    "location",
    "summary",
    "linkedinUrl",
    "profileImageUrl",
  ];
  const missingFields = scalarKeys.filter((key) => !enriched[key]);

  return {
    profile: enriched,
    missingFields,
    extractedAt: new Date().toISOString(),
  };
}

/** Wait until the top-card name appears (LinkedIn is a slow SPA). */
export async function waitForProfileReady(doc: Document, timeoutMs = 4000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const probe = extractProfile(doc, doc.location?.href || "https://www.linkedin.com/in/x");
    if (probe.profile.fullName) return;
    const hasH1 = deepQueryAll(doc, "main h1, h1").some((el) => cleanText(el.textContent).length > 1);
    if (hasH1) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}
