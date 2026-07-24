import { cleanText, cleanMultiline } from "../utils/text";
import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  LanguageItem,
  SectionAvailability,
  SectionStatuses,
} from "../types";

export interface SectionExtraction {
  experiences: ExperienceItem[];
  educations: EducationItem[];
  skills: string[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  summary: string;
  sectionStatuses: SectionStatuses;
}

const SKIP_LINE =
  /^(show all|see more|show more|see all|follow|connect|message|promoted|·|•|\d+$|about|experience|education|skills|licenses? & certifications?|certifications?|languages?)$/i;

const EMP_TYPE_RE = /^(full-?time|part-?time|self-?employed|freelance|contract|internship|temporary|apprenticeship)$/i;
const DURATION_RE = /^\d+\s*(yr|yrs|mo|mos|year|years|month|months)\b/i;

/**
 * Find a section container that actually holds list content.
 * LinkedIn often puts an empty `#experience` anchor; content lives on a parent.
 */
function sectionRoot(doc: Document, keys: string[]): Element | null {
  const hasItems = (el: Element) =>
    !!el.querySelector(
      "li.artdeco-list__item, li.pvs-list__paged-list-item, div[data-view-name='profile-component-entity'], ul.pvs-list > li, li",
    );

  for (const key of keys) {
    const anchor = doc.getElementById(key);
    if (anchor) {
      const nearestSection = anchor.closest("section");
      if (nearestSection) return nearestSection;

      let el: Element | null = anchor.parentElement;
      for (let i = 0; i < 6 && el; i++) {
        if (el.tagName === "MAIN" || el.tagName === "BODY" || el.tagName === "HTML") break;
        if (hasItems(el) || key === "about") return el;
        el = el.parentElement;
      }
      return anchor.parentElement || anchor;
    }
    const byData = doc.querySelector(`section[data-section="${key}"]`);
    if (byData) return byData;
  }

  for (const heading of Array.from(doc.querySelectorAll("h2, h3, [aria-label]"))) {
    const text = cleanText(
      heading.tagName.match(/^H[23]$/i)
        ? heading.textContent
        : heading.getAttribute("aria-label") || heading.textContent,
    ).toLowerCase();
    if (!text) continue;
    if (!keys.some((k) => text === k || text.startsWith(`${k} `) || text.includes(k))) continue;
    // Avoid matching unrelated aria-labels that merely contain the word.
    if (heading.hasAttribute("aria-label") && !keys.some((k) => text === k || text.startsWith(k))) {
      continue;
    }

    const nearestSection = heading.closest("section");
    if (nearestSection) return nearestSection;

    let el: Element | null = heading.parentElement?.parentElement || heading.parentElement;
    for (let i = 0; i < 5 && el; i++) {
      if (el.tagName === "MAIN" || el.tagName === "BODY") break;
      if (hasItems(el)) return el;
      const sibling = el.nextElementSibling;
      if (sibling && hasItems(sibling)) return sibling;
      el = el.parentElement;
    }
    return heading.parentElement;
  }
  return null;
}

function sectionPresence(doc: Document, keys: string[]): boolean {
  return sectionRoot(doc, keys) !== null;
}

/** Prefer LinkedIn's aria-hidden leaf spans (visible text clone). */
function leafLines(root: Element, limit = 14): string[] {
  const lines: string[] = [];
  const push = (raw: string | null | undefined) => {
    const text = cleanText(raw);
    if (!text || text.length < 2 || text.length > 400) return;
    if (SKIP_LINE.test(text)) return;
    if (lines.includes(text)) return;
    lines.push(text);
  };

  for (const node of Array.from(root.querySelectorAll("span[aria-hidden='true']"))) {
    if (node.querySelector("span[aria-hidden='true']")) continue;
    push(node.textContent);
    if (lines.length >= limit) return lines;
  }

  if (lines.length < 2) {
    const raw = cleanMultiline(root.textContent);
    for (const part of raw.split("\n")) {
      push(part);
      if (lines.length >= limit) break;
    }
  }
  return lines;
}

function parseDateRange(text: string): { start_date?: string; end_date?: string; is_current?: boolean } {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const match = cleaned.match(
    /^([A-Za-z]{3,9}\.?\s+\d{4}|\d{4})\s*[-–—]\s*(Present|Current|[A-Za-z]{3,9}\.?\s+\d{4}|\d{4})/i,
  );
  if (!match) return {};
  const end = match[2];
  const isCurrent = /^(present|current)$/i.test(end);
  return {
    start_date: match[1],
    end_date: isCurrent ? undefined : end,
    is_current: isCurrent,
  };
}

function statusFor(present: boolean, count: number, partialThreshold = 1): SectionAvailability {
  if (!present && count === 0) return "not_available";
  if (count === 0) return "partial";
  if (count <= partialThreshold && present) {
    // A single visible item often means the rest is behind "Show all" — mark partial.
    return count >= 1 ? "detected" : "partial";
  }
  return "detected";
}

function parseExperienceItem(item: Element): ExperienceItem | null {
  const lines = leafLines(item, 14);
  if (lines.length < 2) return null;

  let title = lines[0];
  let company = lines[1].replace(/\s*[·•].*$/, "").trim();
  let employment_type = "";
  let dateLine = "";
  let duration = "";
  let location = "";
  let description = "";

  // Company line sometimes embeds employment type: "Acme · Full-time"
  const companyEmp = lines[1].match(/[·•]\s*(.+)$/);
  if (companyEmp && EMP_TYPE_RE.test(companyEmp[1].trim())) {
    employment_type = companyEmp[1].trim();
  }

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!employment_type && EMP_TYPE_RE.test(line)) {
      employment_type = line;
      continue;
    }
    if (!dateLine && parseDateRange(line).start_date) {
      dateLine = line;
      // Duration may be on same line after ·
      const durPart = line.split(/[·•]/).slice(1).join("·").trim();
      if (DURATION_RE.test(durPart)) duration = durPart;
      continue;
    }
    if (dateLine && !duration && DURATION_RE.test(line)) {
      duration = line;
      continue;
    }
    if (dateLine && !location && line.length <= 100 && !parseDateRange(line).start_date) {
      if (DURATION_RE.test(line)) continue;
      location = line;
      continue;
    }
    if (dateLine && !description && line.length > 24) {
      description = line;
      break;
    }
  }

  if (/full-?time|part-?time|internship|contract|self-?employed/i.test(title) && company) {
    const swap = title;
    title = company;
    company = swap.replace(/\s*[·•].*$/, "").trim();
  }

  if (!title || !company) return null;
  if (/^(experience|about|education|skills)$/i.test(title)) return null;

  const dates = parseDateRange(dateLine);
  return {
    title,
    company,
    employment_type: employment_type || undefined,
    location: location || undefined,
    description: description || undefined,
    duration: duration || undefined,
    ...dates,
  };
}

function parseEducationItem(item: Element): EducationItem | null {
  const lines = leafLines(item, 12);
  if (!lines.length) return null;
  const school = lines[0];
  if (!school || /^education$/i.test(school)) return null;

  let degree = "";
  let field_of_study = "";
  let dateLine = "";
  let location = "";
  let description = "";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!degree && !parseDateRange(line).start_date) {
      // "Bachelor of Science, Computer Science"
      const parts = line.split(",").map((p) => p.trim()).filter(Boolean);
      degree = parts[0] || line;
      if (parts.length > 1) field_of_study = parts.slice(1).join(", ");
      continue;
    }
    if (!dateLine && parseDateRange(line).start_date) {
      dateLine = line;
      continue;
    }
    if (dateLine && !location && line.length <= 100 && !DURATION_RE.test(line)) {
      location = line;
      continue;
    }
    if (dateLine && !description && line.length > 24) {
      description = line;
      break;
    }
  }

  const dates = parseDateRange(dateLine);
  return {
    school,
    degree: degree || undefined,
    field_of_study: field_of_study || undefined,
    location: location || undefined,
    description: description || undefined,
    start_date: dates.start_date,
    end_date: dates.end_date,
  };
}

function parseCertificationItem(item: Element): CertificationItem | null {
  const lines = leafLines(item, 10);
  if (!lines.length) return null;
  const name = lines[0];
  if (!name || /certification/i.test(name) && name.length < 20) {
    if (/^licenses?|^certifications?$/i.test(name)) return null;
  }
  if (!name) return null;

  let issuing_organization = "";
  let issue_date = "";
  let expiry_date = "";
  let credential_id = "";

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (/credential\s*id/i.test(line)) {
      credential_id = line.replace(/credential\s*id\s*:?\s*/i, "").trim();
      continue;
    }
    const issued = line.match(/issued\s+(.+)/i);
    const expires = line.match(/expires?\s+(.+)/i);
    if (issued && !issue_date) {
      issue_date = issued[1].replace(/\s*[·•].*$/, "").trim();
      if (expires) expiry_date = expires[1].trim();
      continue;
    }
    if (expires && !expiry_date) {
      expiry_date = expires[1].trim();
      continue;
    }
    if (!issuing_organization && !parseDateRange(line).start_date && line.length < 120) {
      issuing_organization = line;
      continue;
    }
    const dates = parseDateRange(line);
    if (dates.start_date && !issue_date) {
      issue_date = dates.start_date;
      expiry_date = dates.end_date || expiry_date;
    }
  }

  return {
    name,
    issuing_organization: issuing_organization || undefined,
    issue_date: issue_date || undefined,
    expiry_date: expiry_date || undefined,
    credential_id: credential_id || undefined,
  };
}

function parseLanguageItem(item: Element): LanguageItem | null {
  const lines = leafLines(item, 6);
  if (!lines.length) return null;
  const language = lines[0];
  if (!language || /^languages?$/i.test(language)) return null;
  const proficiency = lines.find((l, i) => i > 0 && l.length <= 40 && !SKIP_LINE.test(l));
  return { language, proficiency: proficiency || undefined };
}

function listItems(section: Element): Element[] {
  const preferred = Array.from(
    section.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul.pvs-list > li",
    ),
  );
  if (preferred.length) {
    return preferred.filter((el) => {
      const parentEntity = el.parentElement?.closest(
        "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity']",
      );
      return !parentEntity || parentEntity === el;
    });
  }
  return Array.from(section.querySelectorAll("ul > li")).slice(0, 20);
}

function extractExperiences(doc: Document): ExperienceItem[] {
  const section = sectionRoot(doc, ["experience"]);
  if (!section) return [];
  const out: ExperienceItem[] = [];
  const seen = new Set<string>();
  for (const item of listItems(section)) {
    const exp = parseExperienceItem(item);
    if (!exp) continue;
    const key = `${exp.title}|${exp.company}|${exp.start_date || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(exp);
    if (out.length >= 15) break;
  }
  return out;
}

function extractEducations(doc: Document): EducationItem[] {
  const section = sectionRoot(doc, ["education"]);
  if (!section) return [];
  const out: EducationItem[] = [];
  const seen = new Set<string>();
  for (const item of listItems(section)) {
    const edu = parseEducationItem(item);
    if (!edu) continue;
    const key = `${edu.school}|${edu.degree || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edu);
    if (out.length >= 10) break;
  }
  return out;
}

function extractSkills(doc: Document): string[] {
  const section = sectionRoot(doc, ["skills"]);
  if (!section) return [];
  const skills: string[] = [];
  const seen = new Set<string>();

  const candidates = section.querySelectorAll(
    "a[data-field='skill_card_skill_topic'] span[aria-hidden='true'], " +
      ".hoverable-link-text, " +
      "div[data-view-name='profile-component-entity'] span[aria-hidden='true'], " +
      "span.t-bold span[aria-hidden='true']",
  );

  for (const node of Array.from(candidates)) {
    if ((node as Element).querySelector?.("span[aria-hidden='true']")) continue;
    const text = cleanText(node.textContent);
    if (!text || text.length < 2 || text.length > 60) continue;
    if (SKIP_LINE.test(text)) continue;
    if (/endorsement|show all|see all|\d+\+|followers?/i.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push(text);
    if (skills.length >= 40) break;
  }

  if (!skills.length) {
    for (const line of leafLines(section, 50)) {
      if (line.length > 40) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      skills.push(line);
      if (skills.length >= 40) break;
    }
  }

  return skills;
}

function extractCertifications(doc: Document): CertificationItem[] {
  const section = sectionRoot(doc, [
    "licenses_and_certifications",
    "certifications",
    "licenses & certifications",
    "license",
  ]);
  if (!section) return [];
  const out: CertificationItem[] = [];
  const seen = new Set<string>();
  for (const item of listItems(section)) {
    const cert = parseCertificationItem(item);
    if (!cert) continue;
    const key = `${cert.name}|${cert.issuing_organization || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cert);
    if (out.length >= 15) break;
  }
  return out;
}

function extractLanguages(doc: Document): LanguageItem[] {
  const section = sectionRoot(doc, ["languages", "language"]);
  if (!section) return [];
  const out: LanguageItem[] = [];
  const seen = new Set<string>();
  for (const item of listItems(section)) {
    const lang = parseLanguageItem(item);
    if (!lang) continue;
    const key = lang.language.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lang);
    if (out.length >= 15) break;
  }
  return out;
}

function extractAbout(doc: Document): string {
  const section = sectionRoot(doc, ["about"]);
  if (!section) return "";

  const preferred = section.querySelector(
    ".inline-show-more-text span[aria-hidden='true'], .full-width .inline-show-more-text span[aria-hidden='true']",
  );
  let text = cleanMultiline(preferred?.textContent || "");

  if (!text || text.length < 20) {
    let best = "";
    for (const span of Array.from(section.querySelectorAll("span[aria-hidden='true']"))) {
      if (span.querySelector("span[aria-hidden='true']")) continue;
      const t = cleanMultiline(span.textContent);
      if (parseDateRange(t).start_date) continue;
      if (/^(about|show more|see more)$/i.test(t)) continue;
      if (t.length > best.length) best = t;
    }
    text = best;
  }
  return text.replace(/^About\s*/i, "").trim();
}

export function extractSections(doc: Document): SectionExtraction {
  const experiences = extractExperiences(doc);
  const educations = extractEducations(doc);
  const skills = extractSkills(doc);
  const certifications = extractCertifications(doc);
  const languages = extractLanguages(doc);
  const summary = extractAbout(doc);

  const sectionStatuses: SectionStatuses = {
    experience: statusFor(sectionPresence(doc, ["experience"]), experiences.length),
    education: statusFor(sectionPresence(doc, ["education"]), educations.length),
    skills: statusFor(sectionPresence(doc, ["skills"]), skills.length, 2),
    certifications: statusFor(
      sectionPresence(doc, ["licenses_and_certifications", "certifications"]),
      certifications.length,
    ),
    languages: statusFor(sectionPresence(doc, ["languages"]), languages.length),
    about: summary ? "detected" : statusFor(sectionPresence(doc, ["about"]), 0),
  };

  return {
    experiences,
    educations,
    skills,
    certifications,
    languages,
    summary,
    sectionStatuses,
  };
}
