# Selector Maintenance Guide

LinkedIn changes its DOM frequently and ships A/B-tested variants. When profile
extraction starts returning empty or wrong fields, the fix is almost always in
one file:

```
src/content/selectors.ts
```

## How extraction works

Every field maps to an **ordered list of CSS selectors** plus an optional
attribute to read. The extractor (`src/content/extractProfile.ts`) tries each
selector in order and uses the first one that yields non-empty text/attribute.
Selectors that throw (e.g. unsupported `:has()`) are skipped gracefully.

```ts
fullName: {
  css: ["main h1", "section.artdeco-card h1", "h1.text-heading-xlarge", "h1"],
}
```

## Fixing a broken field

1. Open a LinkedIn profile (`linkedin.com/in/...`) in Chrome.
2. Open DevTools → **Elements**, and inspect the element that holds the value.
3. Find a **stable** selector. Prefer, in order:
   - semantic containers (`main`, `section[data-section=...]`)
   - stable class fragments (`.text-heading-xlarge`, `.text-body-medium`)
   - avoid hashed/auto-generated classes and deep positional chains.
4. Add your new selector to the **front** of that field's `css` array (most
   specific first), keeping the old ones as fallbacks.
5. Grab the element's `outerHTML` and add/update a fixture in
   `tests/fixtures/profile.ts`, then extend `tests/extractProfile.test.ts`.
6. Run the tests:

```bash
npm test
```

## Field reference

| Field              | What to inspect                                  | Reads       |
| ------------------ | ------------------------------------------------ | ----------- |
| `fullName`         | The large name heading (`h1`) in the top card    | textContent |
| `headline`         | The subtitle line under the name                 | textContent |
| `location`         | The small grey location line                     | textContent |
| `profileImageUrl`  | The profile photo `<img>`                        | `src` attr  |
| `summary`          | The "About" section body text                    | textContent |

The LinkedIn URL is taken from `<link rel="canonical">` / `og:url` and falls
back to the page URL, then normalized in `src/utils/normalizeUrl.ts`.

## Tips

- Names/summaries are wrapped in `span[aria-hidden="true"]` to avoid duplicate
  screen-reader text — target that span for clean text.
- Email/phone are intentionally **not** scraped (they sit behind LinkedIn's
  contact-info modal); users can add them in the preview form.
- Keep changes Unicode-safe: don't strip non-ASCII letters. Cleaning lives in
  `src/utils/text.ts`.
