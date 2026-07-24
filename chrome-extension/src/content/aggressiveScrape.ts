import { cleanText, cleanMultiline } from "../utils/text";
import type {
  CandidateProfile,
  CertificationItem,
  EducationItem,
  ExperienceItem,
  LanguageItem,
} from "../types";

/**
 * Last-resort scraper for LinkedIn layouts where class-based selectors fail.
 * Reads visible text from <main> top sections and list blocks under Experience /
 * Education / Skills / About headings.
 */

const SKIP =
  /^(show all|see more|see all|show more|follow|connect|message|promoted|contact info|more|pending|\d+$)$/i;

function leafAriaLines(root: ParentNode, limit = 40): string[] {
  const lines: string[] = [];
  for (const span of Array.from(root.querySelectorAll("span[aria-hidden='true']"))) {
    if ((span as Element).querySelector("span[aria-hidden='true']")) continue;
    const text = cleanText(span.textContent);
    if (!text || text.length < 2 || text.length > 400) continue;
    if (SKIP.test(text)) continue;
    if (!lines.includes(text)) lines.push(text);
    if (lines.length >= limit) break;
  }
  return lines;
}

function leafPlainLines(root: ParentNode, limit = 40): string[] {
  const lines: string[] = [];
  for (const el of Array.from((root as Element).querySelectorAll?.("div, span, p, li") || [])) {
    if ((el as Element).childElementCount > 0) continue;
    if ((el as Element).closest("button, nav, header, footer")) continue;
    const text = cleanText(el.textContent);
    if (!text || text.length < 2 || text.length > 400) continue;
    if (SKIP.test(text)) continue;
    if (!lines.includes(text)) lines.push(text);
    if (lines.length >= limit) break;
  }
  return lines;
}

function linesOf(root: ParentNode): string[] {
  const aria = leafAriaLines(root);
  return aria.length >= 2 ? aria : leafPlainLines(root);
}

function findHeadingSection(doc: Document, name: string): Element | null {
  const needle = name.toLowerCase();
  for (const h of Array.from(doc.querySelectorAll("h2, h3"))) {
    const t = cleanText(h.textContent).toLowerCase();
    if (t === needle || t.startsWith(needle + " ") || t.startsWith(needle)) {
      return (
        h.closest("section") ||
        h.parentElement?.parentElement ||
        h.parentElement ||
        null
      );
    }
  }
  const byId = doc.getElementById(needle);
  if (byId) return byId.closest("section") || byId.parentElement;
  return null;
}

function parseDates(line: string): { start_date?: string; end_date?: string; is_current?: boolean } {
  const m = line.match(
    /^([A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\s*[-–—]\s*(Present|Current|[A-Za-z]{3,9}\.?\s+\d{4}|\d{4})/i,
  );
  if (!m) return {};
  const cur = /^(present|current)$/i.test(m[2]);
  return { start_date: m[1], end_date: cur ? undefined : m[2], is_current: cur };
}

function parseExperienceBlocks(section: Element): ExperienceItem[] {
  const items = Array.from(
    section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul > li",
    ),
  );
  const out: ExperienceItem[] = [];
  const seen = new Set<string>();
  for (const item of items.slice(0, 20)) {
    const lines = linesOf(item);
    if (lines.length < 2) continue;
    const title = lines[0];
    const company = lines[1].replace(/\s*[·•].*$/, "").trim();
    if (!title || !company || /^experience$/i.test(title)) continue;
    let dateLine = "";
    let location = "";
    for (let i = 2; i < lines.length; i++) {
      if (!dateLine && parseDates(lines[i]).start_date) {
        dateLine = lines[i];
        continue;
      }
      if (dateLine && !location && lines[i].length <= 100 && !parseDates(lines[i]).start_date) {
        if (/^\d+\s*(yr|yrs|mo|mos)/i.test(lines[i])) continue;
        location = lines[i];
        break;
      }
    }
    const key = `${title}|${company}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, company, location: location || undefined, ...parseDates(dateLine) });
  }
  return out;
}

function parseEducationBlocks(section: Element): EducationItem[] {
  const items = Array.from(
    section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul > li",
    ),
  );
  const out: EducationItem[] = [];
  const seen = new Set<string>();
  for (const item of items.slice(0, 15)) {
    const lines = linesOf(item);
    if (!lines.length) continue;
    const school = lines[0];
    if (!school || /^education$/i.test(school)) continue;
    let degree = "";
    let dateLine = "";
    for (let i = 1; i < lines.length; i++) {
      if (!degree && !parseDates(lines[i]).start_date) {
        degree = lines[i];
        continue;
      }
      if (!dateLine && parseDates(lines[i]).start_date) {
        dateLine = lines[i];
        break;
      }
    }
    const key = `${school}|${degree}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dates = parseDates(dateLine);
    out.push({ school, degree: degree || undefined, start_date: dates.start_date, end_date: dates.end_date });
  }
  return out;
}

function parseSkills(section: Element): string[] {
  const skills: string[] = [];
  const seen = new Set<string>();
  for (const line of linesOf(section)) {
    if (line.length > 48) continue;
    if (/endorsement|show all|see all|\d+\+/i.test(line)) continue;
    if (/^skills$/i.test(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(line);
    if (skills.length >= 40) break;
  }
  return skills;
}

function parseCertBlocks(section: Element): CertificationItem[] {
  const items = Array.from(
    section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul > li",
    ),
  );
  const out: CertificationItem[] = [];
  const seen = new Set<string>();
  for (const item of items.slice(0, 15)) {
    const lines = linesOf(item);
    if (!lines.length) continue;
    const name = lines[0];
    if (!name || /^licenses?|^certifications?$/i.test(name)) continue;
    const org = lines[1] && !parseDates(lines[1]).start_date ? lines[1] : undefined;
    const key = `${name}|${org || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, issuing_organization: org });
  }
  return out;
}

function parseLangBlocks(section: Element): LanguageItem[] {
  const items = Array.from(
    section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul > li",
    ),
  );
  const out: LanguageItem[] = [];
  const seen = new Set<string>();
  for (const item of items.slice(0, 15)) {
    const lines = linesOf(item);
    if (!lines.length) continue;
    const language = lines[0];
    if (!language || /^languages?$/i.test(language)) continue;
    const key = language.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ language, proficiency: lines[1] || undefined });
  }
  return out;
}

function parseAbout(section: Element): string {
  const blocks = leafAriaLines(section, 20);
  let best = "";
  for (const b of blocks) {
    if (parseDates(b).start_date) continue;
    if (/^about$/i.test(b)) continue;
    if (b.length > best.length) best = b;
  }
  if (!best) best = cleanMultiline(section.textContent || "").replace(/^About\s*/i, "");
  return best.trim();
}

function pickPhotoFromMain(doc: Document): string {
  const main = doc.querySelector("main");
  if (!main) return "";
  const imgs = Array.from(main.querySelectorAll("img"));
  for (const img of imgs) {
    if (img.closest("nav, header, #global-nav, .global-nav, aside")) continue;
    const src =
      img.getAttribute("src") ||
      img.getAttribute("data-delayed-url") ||
      img.currentSrc ||
      "";
    if (!src || src.startsWith("data:")) continue;
    if (/profile-displaybackgroundimage|backgroundimage/i.test(src)) continue;
    if (/profile-displayphoto|profile-framedphoto|pv-top-card-profile-picture/i.test(src + img.className)) {
      return src;
    }
  }
  // Any large image in the first section that isn't background.
  const firstSection = main.querySelector("section");
  if (firstSection) {
    for (const img of Array.from(firstSection.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || img.currentSrc || "";
      if (/media\.licdn\.com/i.test(src) && !/background/i.test(src)) return src;
    }
  }
  return "";
}

function isGeo(line: string): boolean {
  if (/\b(university|institute|college|department of|technologies)\b/i.test(line)) return false;
  const commas = (line.match(/,/g) || []).length;
  if (commas >= 2 && line.length <= 90) return true;
  return (
    commas >= 1 &&
    line.length <= 90 &&
    /\b(pakistan|india|uae|dubai|london|punjab|karachi|lahore|islamabad|remote|united states|uk|canada)\b/i.test(
      line,
    )
  );
}

/** Fill any empty top-card / section fields using aggressive DOM walking. */
export function aggressiveEnrich(doc: Document, profile: CandidateProfile): CandidateProfile {
  const next: CandidateProfile = {
    ...profile,
    experiences: [...(profile.experiences || [])],
    educations: [...(profile.educations || [])],
    skills: [...(profile.skills || [])],
    certifications: [...(profile.certifications || [])],
    languages: [...(profile.languages || [])],
  };

  const main = doc.querySelector("main") || doc.body;
  const topSection =
    main.querySelector("section.artdeco-card, section") || (main as Element);

  // Name / headline / location from top section lines
  const topLines = linesOf(topSection);
  if (!next.fullName) {
    const h1 = cleanText(main.querySelector("h1")?.textContent || "");
    if (h1) next.fullName = h1;
  }
  if (!next.headline) {
    const name = next.fullName;
    next.headline =
      topLines.find(
        (l) =>
          l !== name &&
          l.length >= 12 &&
          l.length <= 260 &&
          !isGeo(l) &&
          !/followers?|connections?/i.test(l),
      ) || "";
  }
  if (!next.location) {
    next.location = topLines.find((l) => isGeo(l)) || "";
  }
  if (!next.profileImageUrl) {
    next.profileImageUrl = pickPhotoFromMain(doc);
  }

  // Sections
  if (!next.experiences.length) {
    const sec = findHeadingSection(doc, "experience");
    if (sec) next.experiences = parseExperienceBlocks(sec);
  }
  if (!next.educations.length) {
    const sec = findHeadingSection(doc, "education");
    if (sec) next.educations = parseEducationBlocks(sec);
  }
  if (!next.skills.length) {
    const sec = findHeadingSection(doc, "skills");
    if (sec) next.skills = parseSkills(sec);
  }
  if (!next.certifications.length) {
    const sec =
      findHeadingSection(doc, "licenses & certifications") ||
      findHeadingSection(doc, "certifications") ||
      findHeadingSection(doc, "licenses and certifications");
    if (sec) next.certifications = parseCertBlocks(sec);
  }
  if (!next.languages.length) {
    const sec = findHeadingSection(doc, "languages");
    if (sec) next.languages = parseLangBlocks(sec);
  }
  if (!next.summary) {
    const sec = findHeadingSection(doc, "about");
    if (sec) next.summary = parseAbout(sec);
  }

  return next;
}

/** Wait until main has a real profile photo OR a non-title headline-like line. */
export async function waitForRichProfile(doc: Document, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const main = doc.querySelector("main");
    if (main) {
      const hasPhoto = !!pickPhotoFromMain(doc);
      const h1 = cleanText(main.querySelector("h1")?.textContent || "");
      const lines = linesOf(main.querySelector("section") || main);
      const hasHeadline = lines.some((l) => l !== h1 && l.length >= 12 && l.length <= 260);
      const hasExperienceHeading = !!findHeadingSection(doc, "experience");
      if (h1 && (hasPhoto || hasHeadline || hasExperienceHeading)) return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}
