// LinkedIn changes its DOM frequently and ships A/B variants. Every field is
// therefore backed by an ORDERED list of fallback selectors — the extractor
// tries each in turn and uses the first that yields non-empty text.
//
// When LinkedIn breaks extraction, update the arrays here first.
// See SELECTOR_MAINTENANCE.md for the maintenance workflow.

export interface FieldSelectors {
  /** Ordered CSS selectors, most specific/stable first. */
  css: string[];
  /** Optional attribute to read instead of textContent (e.g. "src"). */
  attr?: string;
}

export const SELECTORS = {
  fullName: {
    css: [
      // Current LinkedIn top-card variants (2025/2026)
      "main section h1 span[aria-hidden='true']",
      "main section h1",
      "h1.inline.t-24 span[aria-hidden='true']",
      "h1.inline.t-24",
      "h1.text-heading-xlarge span[aria-hidden='true']",
      "h1.text-heading-xlarge",
      ".pv-text-details__left-panel h1",
      "div.ph5 h1",
      "section.artdeco-card h1",
      "[data-member-id] h1",
      "main h1",
      "h1",
    ],
  } satisfies FieldSelectors,

  headline: {
    css: [
      "main section .text-body-medium.break-words",
      "div.text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "main .ph5 .text-body-medium",
      "[data-generated-suggestion-target] + .text-body-medium",
      "div.ph5 div.text-body-medium",
    ],
  } satisfies FieldSelectors,

  location: {
    css: [
      // Prefer the top-card geo line next to "Contact info"
      "main section .pv-text-details__left-panel span.text-body-small.inline",
      "main .ph5 span.text-body-small.inline.t-black--light.break-words",
      "span.text-body-small.inline.t-black--light.break-words",
      ".pv-text-details__left-panel span.text-body-small.t-black--light",
    ],
  } satisfies FieldSelectors,

  profileImageUrl: {
    // Intentionally narrow — never match global-nav / "me" avatar.
    css: [
      "main section img.pv-top-card-profile-picture__image--show",
      "main section img.pv-top-card-profile-picture__image",
      "main .pv-top-card-profile-picture img",
      "main button.pv-top-card-profile-picture img",
      "main section.artdeco-card button[aria-label*='profile photo' i] img",
      "main section.artdeco-card button[aria-label*='profile picture' i] img",
    ],
    attr: "src",
  } satisfies FieldSelectors,

  summary: {
    css: [
      "section[data-section='summary'] span[aria-hidden='true']",
      "div#about ~ * span[aria-hidden='true']",
      "section.pv-about-section span[aria-hidden='true']",
      "#about ~ div .inline-show-more-text span[aria-hidden='true']",
      "section:has(#about) .inline-show-more-text span[aria-hidden='true']",
      "section:has(#about) .inline-show-more-text",
      "section[aria-label='About'] .inline-show-more-text span[aria-hidden='true']",
    ],
  } satisfies FieldSelectors,
} as const;

export type SelectorKey = keyof typeof SELECTORS;
