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

const MONTH_RE =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

/**
 * LinkedIn often glues fields when aria-hidden spans are missing:
 * "Software EngineerJul 2022 - Mar 2024 · 1 yr 9 mosTokyo, Japan..."
 */
function unglueExperienceBlob(text: string): string[] {
  let t = cleanText(text);
  if (!t) return [];
  // Title|Date
  t = t.replace(
    new RegExp(`([A-Za-z0-9)&+./])(?=(?:${MONTH_RE}\\.?\\s+\\d{4}|\\d{4}\\s*[-–—]))`, "gi"),
    "$1\n",
  );
  // Duration|Location (e.g. "9 mosTokyo")
  t = t.replace(/((?:yr|yrs|mo|mos|year|years|month|months)\b)\s*(?=[A-Z])/gi, "$1\n");
  // Location|skills fluff
  t = t.replace(/\s+(?=LinkedIn helped|Information Technology|\+\d+\s+skills)/gi, "\n");
  return t
    .split("\n")
    .map((p) => cleanText(p))
    .filter((p) => p.length >= 2);
}

function pushLeafLine(lines: string[], raw: string | null | undefined, limit: number): boolean {
  const text = cleanText(raw);
  if (!text || text.length < 2 || text.length > 500) return lines.length >= limit;
  if (SKIP_LINE.test(text)) return lines.length >= limit;

  // One glued blob → split into title / dates / location
  if (
    text.length > 40 &&
    new RegExp(`${MONTH_RE}\\.?\\s+\\d{4}`, "i").test(text) &&
    !/^\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text)
  ) {
    for (const part of unglueExperienceBlob(text)) {
      if (lines.includes(part)) continue;
      lines.push(part);
      if (lines.length >= limit) return true;
    }
    return lines.length >= limit;
  }

  if (lines.includes(text)) return lines.length >= limit;
  lines.push(text);
  return lines.length >= limit;
}

/** Prefer LinkedIn's aria-hidden leaf spans (visible text clone). */
function leafLines(root: Element, limit = 14): string[] {
  const lines: string[] = [];

  for (const node of Array.from(root.querySelectorAll("span[aria-hidden='true']"))) {
    if (node.querySelector("span[aria-hidden='true']")) continue;
    if (pushLeafLine(lines, node.textContent, limit)) return lines;
  }

  if (lines.length < 2) {
    const raw = cleanMultiline(root.textContent);
    for (const part of raw.split("\n")) {
      if (pushLeafLine(lines, part, limit)) break;
    }
  }

  // Still one glued line — force unglue
  if (lines.length === 1 && lines[0].length > 40) {
    const parts = unglueExperienceBlob(lines[0]);
    if (parts.length > 1) return parts.slice(0, limit);
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

function isNonCompanyLine(line: string): boolean {
  if (!line) return true;
  // LinkedIn uses "Self-employed" as the company name for freelancers
  if (/^self-?employed$/i.test(line)) return false;
  if (EMP_TYPE_RE.test(line)) return true;
  if (DURATION_RE.test(line)) return true;
  if (parseDateRange(line).start_date) return true;
  if (/on-site|remote|hybrid|followers?|connections?/i.test(line)) return true;
  return false;
}

function statusFor(present: boolean, count: number): SectionAvailability {
  if (count > 0) return "detected";
  if (present) return "partial";
  return "not_available";
}

function parseExperienceItem(item: Element): ExperienceItem | null {
  let lines = leafLines(item, 14);
  if (lines.length < 1) return null;

  if (lines[0] && /[a-z](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(lines[0])) {
    lines = [...unglueExperienceBlob(lines[0]), ...lines.slice(1)];
  }

  const link =
    (item.querySelector("a[href*='/company/']") as HTMLAnchorElement | null) ||
    (item.querySelector("a[href*='/school/']") as HTMLAnchorElement | null);
  const company_url = link?.href ? link.href.split("?")[0] : undefined;
  const linkCompany = cleanText(
    link?.querySelector("span[aria-hidden='true']")?.textContent || link?.textContent || "",
  ).replace(/\s*[·•].*$/, "").trim();

  let title = lines[0];
  if (title && parseDateRange(title).start_date) {
    const parts = unglueExperienceBlob(title);
    title = parts[0] || title;
    if (parts.length > 1) lines = [...parts, ...lines.slice(1)];
  }
  let company = linkCompany || (lines[1] ? lines[1].replace(/\s*[·•].*$/, "").trim() : "");
  let employment_type = "";
  let dateLine = "";
  let duration = "";
  let location = "";
  let description = "";

  const companyEmp = (lines[1] || "").match(/[·•]\s*(.+)$/);
  if (companyEmp && EMP_TYPE_RE.test(companyEmp[1].trim())) {
    employment_type = companyEmp[1].trim();
  }

  if (isNonCompanyLine(company) && !linkCompany) {
    if (EMP_TYPE_RE.test(company)) employment_type = company;
    company = "";
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].replace(/\s*[·•].*$/, "").trim();
      if (line === title) continue;
      if (isNonCompanyLine(line)) {
        if (!employment_type && EMP_TYPE_RE.test(line)) employment_type = line;
        continue;
      }
      company = line;
      break;
    }
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === title || line === company) continue;
    if (linkCompany && line === linkCompany) continue;
    if (!employment_type && EMP_TYPE_RE.test(line)) {
      employment_type = line;
      continue;
    }
    if (!dateLine && parseDateRange(line).start_date) {
      dateLine = line;
      const durPart = line.split(/[·•]/).slice(1).join("·").trim();
      if (DURATION_RE.test(durPart)) duration = durPart;
      continue;
    }
    if (dateLine && !duration && DURATION_RE.test(line)) {
      duration = line;
      continue;
    }
    if (dateLine && !location && line.length <= 120 && !parseDateRange(line).start_date) {
      if (DURATION_RE.test(line) || EMP_TYPE_RE.test(line)) continue;
      location = line;
      continue;
    }
    if (dateLine && !description && line.length > 24) {
      description = line;
      break;
    }
  }

  // Title/company swap when LinkedIn puts company first
  if (linkCompany && title === linkCompany && lines[1] && !EMP_TYPE_RE.test(lines[1])) {
    title = lines[1].replace(/\s*[·•].*$/, "").trim();
    company = linkCompany;
  }

  if (/full-?time|part-?time|internship|contract|self-?employed/i.test(title) && company && !EMP_TYPE_RE.test(company)) {
    const swap = title;
    title = company;
    company = swap.replace(/\s*[·•].*$/, "").trim();
  }

  if (!title) return null;
  if (!company) company = linkCompany || "Unknown";
  if (/^(experience|about|education|skills)$/i.test(title)) return null;
  // Don't wipe legitimate "Self-employed" company names
  if (EMP_TYPE_RE.test(company) && !/^self-?employed$/i.test(company)) {
    company = linkCompany || "Unknown";
  }

  const dates = parseDateRange(dateLine);
  return {
    title,
    company,
    company_url,
    employment_type: employment_type || undefined,
    location: location || undefined,
    description: description || undefined,
    duration: duration || undefined,
    ...dates,
  };
}

function parseEducationItem(item: Element): EducationItem | null {
  const schoolLink = item.querySelector("a[href*='/school/']") as HTMLAnchorElement | null;
  const schoolFromLink = cleanText(
    schoolLink?.querySelector("span[aria-hidden='true']")?.textContent || schoolLink?.textContent || "",
  );

  const lines = leafLines(item, 12);
  const school = schoolFromLink || lines[0] || "";
  if (!school || /^education$/i.test(school)) return null;

  let degree = "";
  let field_of_study = "";
  let dateLine = "";
  let location = "";
  let description = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === school || (schoolFromLink && line === schoolFromLink)) continue;
    if (!degree && !parseDateRange(line).start_date) {
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
  return Array.from(section.querySelectorAll("ul > li")).slice(0, 30);
}

/**
 * Nested position rows under a company-group card.
 * Only real sub-list <li>s count — not every nested profile-component-entity
 * (standalone jobs often have nested entities for media/description).
 */
function nestedPositionItems(group: Element): Element[] {
  const roles: Element[] = [];
  for (const ul of Array.from(group.querySelectorAll("ul"))) {
    if (!group.contains(ul)) continue;
    // Host list-item of this ul: must be the group card itself.
    // Skips uls buried inside a nested role <li> (media / description lists).
    const hostLi = ul.parentElement?.closest("li");
    if (hostLi && hostLi !== group) continue;

    for (const child of Array.from(ul.children)) {
      if (!(child instanceof Element)) continue;
      if (
        child.matches(
          "li.pvs-list__paged-list-item, li.artdeco-list__item, li, div[data-view-name='profile-component-entity']",
        )
      ) {
        roles.push(child);
      }
    }
  }
  return roles.filter((el, i, arr) => arr.indexOf(el) === i);
}

function roleLooksLikePosition(role: Element): boolean {
  const lines = leafLines(role, 10);
  if (!lines.length) return false;
  return lines.some((l) => !!parseDateRange(l).start_date);
}

/**
 * True when this top-level card is a company with nested roles,
 * not a standalone title+company job.
 */
function isMultiPositionCompany(group: Element, nested: Element[]): boolean {
  const positions = nested.filter(roleLooksLikePosition);
  if (positions.length === 0) return false;
  if (positions.length >= 2) return true;

  const companyLink = group.querySelector("a[href*='/company/'], a[href*='/school/']");
  const outerLines = leafLines(group, 8);
  const nestedLines = new Set(leafLines(positions[0], 8).map((l) => l.toLowerCase()));
  const outerOnly = outerLines.filter((l) => !nestedLines.has(l.toLowerCase()));
  const outerHasOwnDate = outerOnly.some((l) => !!parseDateRange(l).start_date);
  if (outerHasOwnDate && !companyLink) return false;
  if (companyLink && !outerHasOwnDate) return true;
  if (positions.length === 1 && outerOnly.length >= 1) {
    const nestedTitle = leafLines(positions[0], 1)[0] || "";
    const outerFirst = outerOnly[0] || "";
    if (outerFirst && nestedTitle && outerFirst.toLowerCase() !== nestedTitle.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function stripCompanySuffix(name: string): string {
  return name
    .replace(/\s*[·•].*$/, "")
    .replace(/\s*,\s*(Full-?time|Part-?time|Contract|Internship)\s*$/i, "")
    .trim();
}

function companyFromGroup(group: Element, childRoles: Element[]): { company: string; company_url?: string } {
  const link =
    (group.querySelector("a[href*='/company/']") as HTMLAnchorElement | null) ||
    (group.querySelector("a[href*='/school/']") as HTMLAnchorElement | null);
  const company_url = link?.href ? link.href.split("?")[0] : undefined;

  const linkText = link
    ? cleanText(link.querySelector("span[aria-hidden='true']")?.textContent || link.textContent)
    : "";
  if (linkText && linkText.length >= 2) {
    return { company: stripCompanySuffix(linkText), company_url };
  }

  // Header spans only — exclude anything inside nested role rows
  for (const span of Array.from(group.querySelectorAll("span[aria-hidden='true']"))) {
    if (span.querySelector("span[aria-hidden='true']")) continue;
    if (childRoles.some((role) => role.contains(span))) continue;
    const line = cleanText(span.textContent);
    if (!line || line.length < 2) continue;
    if (parseDateRange(line).start_date) continue;
    if (EMP_TYPE_RE.test(line) || DURATION_RE.test(line)) continue;
    if (/^(experience|show all|see more|full-?time|part-?time)$/i.test(line)) continue;
    if (/^\d+\s*(yr|yrs|mo|mos)\b/i.test(line)) continue;
    const company = stripCompanySuffix(line);
    if (company.length >= 2) return { company, company_url };
  }

  const childFirst = new Set(
    childRoles.flatMap((role) => leafLines(role, 4)).map((l) => l.toLowerCase()),
  );
  for (const line of leafLines(group, 12)) {
    if (childFirst.has(line.toLowerCase())) continue;
    if (parseDateRange(line).start_date) continue;
    if (EMP_TYPE_RE.test(line) || DURATION_RE.test(line)) continue;
    if (/^(experience|show all|see more)$/i.test(line)) continue;
    const company = stripCompanySuffix(line);
    if (company.length >= 2) return { company, company_url };
  }
  return { company: "Unknown", company_url };
}

function parseRoleUnderCompany(
  role: Element,
  company: string,
  company_url?: string,
): ExperienceItem | null {
  let lines = leafLines(role, 14);
  if (!lines.length) return null;

  // Expand any remaining glued title line
  if (lines[0] && lines[0].length > 40 && parseDateRange(lines[0]).start_date) {
    lines = [...unglueExperienceBlob(lines[0]), ...lines.slice(1)];
  } else if (lines[0] && /[a-z](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(lines[0])) {
    lines = [...unglueExperienceBlob(lines[0]), ...lines.slice(1)];
  }

  let title = lines[0];
  if (title.toLowerCase() === company.toLowerCase() && lines[1]) {
    title = lines[1];
  }
  // Title must not include the date range
  if (title && parseDateRange(title).start_date) {
    const parts = unglueExperienceBlob(title);
    title = parts[0] || title;
    if (parts.length > 1) lines = [...parts, ...lines.slice(1)];
  }
  if (!title || /^(experience|about|education|skills)$/i.test(title)) return null;
  if (EMP_TYPE_RE.test(title)) return null;

  let employment_type = "";
  let dateLine = "";
  let duration = "";
  let location = "";
  let description = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === title) continue;
    if (line.toLowerCase() === company.toLowerCase()) continue;
    if (!employment_type && EMP_TYPE_RE.test(line)) {
      employment_type = line;
      continue;
    }
    if (!employment_type) {
      const emp = line.match(/[·•]\s*(.+)$/);
      if (emp && EMP_TYPE_RE.test(emp[1].trim())) employment_type = emp[1].trim();
    }
    if (!dateLine && parseDateRange(line).start_date) {
      dateLine = line;
      const durPart = line.split(/[·•]/).slice(1).join("·").trim();
      if (DURATION_RE.test(durPart)) duration = durPart;
      continue;
    }
    if (dateLine && !duration && DURATION_RE.test(line)) {
      duration = line;
      continue;
    }
    if (dateLine && !location && line.length <= 120 && !parseDateRange(line).start_date) {
      if (DURATION_RE.test(line) || EMP_TYPE_RE.test(line)) continue;
      location = line;
      continue;
    }
    if (dateLine && !description && line.length > 24) {
      description = line;
      break;
    }
  }

  return {
    title,
    company,
    company_url,
    employment_type: employment_type || undefined,
    location: location || undefined,
    description: description || undefined,
    duration: duration || undefined,
    ...parseDateRange(dateLine),
  };
}

function pushExperience(
  out: ExperienceItem[],
  seen: Set<string>,
  exp: ExperienceItem | null,
): boolean {
  if (!exp?.title || !exp.company) return false;
  const key = `${exp.title}|${exp.company}|${exp.start_date || ""}`.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  out.push(exp);
  return true;
}

function extractExperiences(doc: Document): ExperienceItem[] {
  const section = sectionRoot(doc, ["experience"]);
  if (!section) return [];
  const out: ExperienceItem[] = [];
  const seen = new Set<string>();
  const topLevel = listItems(section);

  let standaloneCount = 0;
  let nestedPositionCount = 0;
  let companyGroupCount = 0;

  for (const item of topLevel) {
    const nested = nestedPositionItems(item);
    const datedNested = nested.filter(roleLooksLikePosition);

    if (isMultiPositionCompany(item, nested)) {
      companyGroupCount += 1;
      const { company, company_url } = companyFromGroup(item, datedNested);
      let addedFromNested = 0;
      for (const role of datedNested) {
        const exp = parseRoleUnderCompany(role, company, company_url);
        if (pushExperience(out, seen, exp)) {
          addedFromNested += 1;
          nestedPositionCount += 1;
        }
        if (out.length >= 40) break;
      }
      // Never drop a card if nested parse failed
      if (addedFromNested === 0) {
        const exp = parseExperienceItem(item);
        if (pushExperience(out, seen, exp)) standaloneCount += 1;
      }
      if (out.length >= 40) break;
      continue;
    }

    const exp = parseExperienceItem(item);
    if (pushExperience(out, seen, exp)) standaloneCount += 1;
    if (out.length >= 40) break;
  }

  try {
    // eslint-disable-next-line no-console
    console.info("[RecruitPro] experience extraction", {
      topLevelEntities: topLevel.length,
      companyGroups: companyGroupCount,
      standalonePositions: standaloneCount,
      nestedPositions: nestedPositionCount,
      finalCount: out.length,
      titles: out.map((e) => `${e.title} @ ${e.company}`),
    });
  } catch {
    /* ignore */
  }

  return out;
}

function extractEducations(doc: Document): EducationItem[] {
  const section = sectionRoot(doc, ["education"]);
  if (!section) return [];
  const out: EducationItem[] = [];
  const seen = new Set<string>();

  let items = listItems(section);
  if (!items.length) {
    // Fallback: any entity / school card inside Education
    items = Array.from(
      section.querySelectorAll(
        "div[data-view-name='profile-component-entity'], li, a[href*='/school/']",
      ),
    ).filter((el) => {
      if (el.tagName === "A") {
        const parent = el.closest("li, div[data-view-name='profile-component-entity']");
        return !parent; // only bare links if not already covered
      }
      const parentEntity = el.parentElement?.closest(
        "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity']",
      );
      return !parentEntity || parentEntity === el;
    });
  }

  for (const item of items) {
    const edu = parseEducationItem(item);
    if (!edu) continue;
    const key = `${edu.school}|${edu.degree || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edu);
    if (out.length >= 15) break;
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
    skills: statusFor(sectionPresence(doc, ["skills"]), skills.length),
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
