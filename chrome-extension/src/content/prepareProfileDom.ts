/**
 * Prepare a LinkedIn profile page for extraction.
 * Keeps retrying Experience + Education until both parse with ≥1 item,
 * or until max time / section confirmed absent from the profile DOM.
 *
 * Does NOT navigate to /details/* pages.
 */

import { extractSections } from "./extractSections";

const SECTION_KEYS: Record<string, string[]> = {
  about: ["about"],
  experience: ["experience"],
  education: ["education"],
  skills: ["skills"],
  certifications: ["licenses_and_certifications", "certifications", "licenses"],
  languages: ["languages"],
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clean(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function scrollingRoot(doc: Document): Element {
  return (doc.scrollingElement || doc.documentElement || doc.body) as Element;
}

function sectionHasListItems(root: Element): boolean {
  return (
    root.querySelectorAll(
      "li.pvs-list__paged-list-item, li.artdeco-list__item, div[data-view-name='profile-component-entity'], ul.pvs-list > li, a[href*='/school/'], a[href*='/company/']",
    ).length > 0
  );
}

/** Locate a section container (handles empty #id anchors). */
export function findSectionRoot(doc: Document, keys: string[]): Element | null {
  for (const key of keys) {
    const anchor = doc.getElementById(key);
    if (anchor) {
      const nearest = anchor.closest("section");
      if (nearest) return nearest;
      let el: Element | null = anchor.parentElement;
      for (let i = 0; i < 8 && el; i++) {
        if (el.tagName === "MAIN" || el.tagName === "BODY") break;
        if (sectionHasListItems(el) || key === "about") return el;
        el = el.parentElement;
      }
      return nearest || anchor.parentElement || anchor;
    }
    const byData = doc.querySelector(`section[data-section="${key}"]`);
    if (byData) return byData;
  }

  for (const heading of Array.from(doc.querySelectorAll("h2, h3"))) {
    const text = clean(heading.textContent).toLowerCase();
    if (!keys.some((k) => text === k || text.startsWith(`${k} `))) continue;
    const nearest = heading.closest("section");
    if (nearest) return nearest;
    let el: Element | null = heading.parentElement;
    for (let i = 0; i < 6 && el; i++) {
      if (sectionHasListItems(el)) return el;
      const sibling = el.nextElementSibling;
      if (sibling && sectionHasListItems(sibling)) return sibling;
      el = el.parentElement;
    }
    return heading.closest("section") || heading.parentElement;
  }
  return null;
}

async function waitForTopCard(doc: Document, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const h1 = clean(doc.querySelector("main h1, h1")?.textContent || "");
    if (h1.length > 1) return;
    await sleep(200);
  }
}

function scrollIntoViewSafe(el: Element): void {
  try {
    el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  } catch {
    el.scrollIntoView(true);
  }
}

export async function scrollProfileFully(
  doc: Document,
  opts: { stepPx?: number; settleMs?: number; maxMs?: number } = {},
): Promise<void> {
  const stepPx = opts.stepPx ?? 700;
  const settleMs = opts.settleMs ?? 300;
  const maxMs = opts.maxMs ?? 16000;
  const scroller = scrollingRoot(doc);
  const win = doc.defaultView || window;

  const start = Date.now();
  let lastHeight = 0;
  let stableRounds = 0;

  win.scrollTo(0, 0);
  await sleep(200);

  while (Date.now() - start < maxMs) {
    win.scrollBy(0, stepPx);
    await sleep(settleMs);

    const newHeight = Math.max(
      scroller.scrollHeight,
      doc.body?.scrollHeight || 0,
      doc.documentElement?.scrollHeight || 0,
    );
    const clientH = (scroller as HTMLElement).clientHeight || win.innerHeight;
    const scrollTop = win.scrollY || scroller.scrollTop || 0;
    const nearBottom = scrollTop + clientH >= newHeight - 100;

    if (nearBottom && newHeight <= lastHeight + 40) {
      stableRounds += 1;
      if (stableRounds >= 3) break;
    } else {
      stableRounds = 0;
    }
    lastHeight = newHeight;
  }

  for (const keys of [SECTION_KEYS.experience, SECTION_KEYS.education, SECTION_KEYS.skills, SECTION_KEYS.about]) {
    const root = findSectionRoot(doc, keys);
    if (!root) continue;
    scrollIntoViewSafe(root);
    await sleep(280);
  }
}

export async function expandInlineSeeMores(doc: Document, root?: ParentNode): Promise<number> {
  let clicked = 0;
  const scope = root || doc;
  const candidates = Array.from(
    scope.querySelectorAll("button, span[role='button'], a.inline-show-more-text__button"),
  );

  for (const el of candidates) {
    const text = clean(el.textContent).toLowerCase();
    const aria = clean(el.getAttribute("aria-label")).toLowerCase();
    const label = `${text} ${aria}`;

    const href = (el as HTMLAnchorElement).getAttribute?.("href") || "";
    if (/\/details\//i.test(href)) continue;
    if (/show all\s+\d+/i.test(label) && /experience|education|skill|certif|language/i.test(label)) {
      continue;
    }

    const isInlineExpand =
      /^(see more|show more|…see more|see more…)$/i.test(text) ||
      (/see more|show more/i.test(aria) && !/show all/i.test(aria)) ||
      (el.classList.contains("inline-show-more-text__button") && /more/i.test(label));

    if (!isInlineExpand) continue;

    try {
      (el as HTMLElement).click();
      clicked += 1;
      await sleep(160);
    } catch {
      /* ignore */
    }
    if (clicked >= 40) break;
  }

  return clicked;
}

export type SectionWaitResult = "loaded" | "empty" | "timeout" | "missing";

function sectionLooksLoaded(section: keyof typeof SECTION_KEYS, root: Element): boolean {
  if (section === "about") {
    const body = clean(root.textContent).replace(/^about\b/i, "").trim();
    return body.length > 40;
  }
  if (sectionHasListItems(root)) return true;
  const chips = root.querySelectorAll(
    "a[href*='skill'], a[data-field='skill_card_skill_topic'], span.hoverable-link-text, .pvs-entity, a[href*='/school/']",
  );
  return chips.length > 0;
}

export async function waitForSectionContent(
  doc: Document,
  section: keyof typeof SECTION_KEYS,
  timeoutMs = 3500,
): Promise<SectionWaitResult> {
  const keys = SECTION_KEYS[section];
  const start = Date.now();
  let sawRoot = false;

  while (Date.now() - start < timeoutMs) {
    const root = findSectionRoot(doc, keys);
    if (root) {
      sawRoot = true;
      scrollIntoViewSafe(root);
      if (sectionLooksLoaded(section, root)) return "loaded";
    }
    await sleep(200);
  }

  if (!sawRoot) return "missing";
  return "empty";
}

async function hydrateSection(doc: Document, key: "experience" | "education"): Promise<void> {
  const root = findSectionRoot(doc, SECTION_KEYS[key]);
  if (root) {
    scrollIntoViewSafe(root);
    await sleep(400);
    await expandInlineSeeMores(doc, root);
    await sleep(350);
    // Nudge scroll inside section to trigger lazy children
    const win = doc.defaultView || window;
    win.scrollBy(0, 180);
    await sleep(250);
    scrollIntoViewSafe(root);
    await sleep(300);
  } else {
    // Section not found yet — scroll page to force mount
    const win = doc.defaultView || window;
    win.scrollBy(0, 600);
    await sleep(400);
  }
}

export interface CoreScrapeResult {
  experiences: number;
  educations: number;
  attempts: number;
  timedOut: boolean;
  experienceReady: boolean;
  educationReady: boolean;
  durationMs: number;
}

/**
 * Keep scrolling / expanding / waiting until Experience AND Education
 * each yield ≥1 parsed record, or until maxMs / confirmed absent.
 */
export async function scrapeUntilExperienceAndEducation(
  doc: Document,
  opts: { maxMs?: number } = {},
): Promise<CoreScrapeResult> {
  const maxMs = opts.maxMs ?? 18000;
  const t0 = Date.now();
  let attempts = 0;
  let experienceReady = false;
  let educationReady = false;
  let expAbsentStreak = 0;
  let eduAbsentStreak = 0;

  await waitForTopCard(doc, 10000);
  await scrollProfileFully(doc, { stepPx: 650, settleMs: 280, maxMs: 16000 });
  await expandInlineSeeMores(doc);

  while (Date.now() - t0 < maxMs) {
    attempts += 1;
    const sections = extractSections(doc);
    experienceReady = sections.experiences.length > 0;
    educationReady = sections.educations.length > 0;

    if (experienceReady && educationReady) {
      (doc.defaultView || window).scrollTo(0, 0);
      return {
        experiences: sections.experiences.length,
        educations: sections.educations.length,
        attempts,
        timedOut: false,
        experienceReady,
        educationReady,
        durationMs: Date.now() - t0,
      };
    }

    const expRoot = findSectionRoot(doc, SECTION_KEYS.experience);
    const eduRoot = findSectionRoot(doc, SECTION_KEYS.education);

    // If heading never appears after several full passes, stop insisting on that section
    if (!experienceReady) {
      if (!expRoot) expAbsentStreak += 1;
      else expAbsentStreak = 0;
      await hydrateSection(doc, "experience");
    }
    if (!educationReady) {
      if (!eduRoot) eduAbsentStreak += 1;
      else eduAbsentStreak = 0;
      await hydrateSection(doc, "education");
    }

    // Periodic full re-scroll to catch late lazy mounts
    if (attempts % 3 === 0) {
      await scrollProfileFully(doc, { stepPx: 700, settleMs: 260, maxMs: 8000 });
      await expandInlineSeeMores(doc);
    }

    // Give up on a section only if its heading never showed after many tries
    // (profile genuinely has no Education / Experience on first page)
    const giveUpExp = !experienceReady && expAbsentStreak >= 8;
    const giveUpEdu = !educationReady && eduAbsentStreak >= 8;
    if ((experienceReady || giveUpExp) && (educationReady || giveUpEdu)) {
      break;
    }

    await sleep(450);
  }

  const final = extractSections(doc);
  (doc.defaultView || window).scrollTo(0, 0);
  await sleep(150);

  return {
    experiences: final.experiences.length,
    educations: final.educations.length,
    attempts,
    timedOut: !(final.experiences.length > 0 && final.educations.length > 0),
    experienceReady: final.experiences.length > 0,
    educationReady: final.educations.length > 0,
    durationMs: Date.now() - t0,
  };
}

export interface PrepareResult {
  scrolled: boolean;
  expandsClicked: number;
  sections: Record<string, SectionWaitResult>;
  durationMs: number;
  core?: CoreScrapeResult;
}

/**
 * Full prepare pipeline — prioritizes Experience + Education until scraped.
 */
export async function prepareProfileDom(doc: Document): Promise<PrepareResult> {
  const core = await scrapeUntilExperienceAndEducation(doc, { maxMs: 18000 });

  let expandsClicked = await expandInlineSeeMores(doc);

  const sections: Record<string, SectionWaitResult> = {
    experience: core.experienceReady ? "loaded" : findSectionRoot(doc, SECTION_KEYS.experience) ? "empty" : "missing",
    education: core.educationReady ? "loaded" : findSectionRoot(doc, SECTION_KEYS.education) ? "empty" : "missing",
  };

  for (const key of ["about", "skills", "certifications", "languages"] as const) {
    const root = findSectionRoot(doc, SECTION_KEYS[key]);
    if (root) {
      scrollIntoViewSafe(root);
      expandsClicked += await expandInlineSeeMores(doc, root);
      sections[key] = sectionLooksLoaded(key, root)
        ? "loaded"
        : await waitForSectionContent(doc, key, 2500);
    } else {
      sections[key] = "missing";
    }
  }

  (doc.defaultView || window).scrollTo(0, 0);
  await sleep(120);

  return {
    scrolled: true,
    expandsClicked,
    sections,
    durationMs: core.durationMs,
    core,
  };
}
