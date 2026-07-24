# RecruitPro Candidate Importer (Chrome Extension)

A Manifest V3 Chrome extension that extracts a **single LinkedIn profile**
(`linkedin.com/in/…`) and saves it into the RecruitPro / BlinkEye ATS via the
secure `/api/v1/extension` backend surface. It reuses the existing Candidate
model, activity log and role scoping — no multi-tenant/organization work.

## Features

- One-click import of the currently open LinkedIn profile.
- Editable preview form (required Full Name) before saving.
- Assign to a **job**, **pipeline stage** and **owner** (role-scoped).
- Duplicate detection by normalized LinkedIn URL / email.
- Bearer-token auth via a single-use connection code from RecruitPro Settings.
- Unicode-safe extraction (Arabic, CJK, emoji) with no raw HTML injection.

## Prerequisites

- Node.js 18+
- A running RecruitPro backend and web app.

## Configure

```bash
cp .env.example .env
```

| Variable               | Description                                   | Dev default             |
| ---------------------- | --------------------------------------------- | ----------------------- |
| `VITE_API_BASE_URL`    | Backend origin                                | `http://localhost:8000` |
| `VITE_APP_BASE_URL`    | RecruitPro web app origin                     | `http://localhost:3000` |
| `VITE_ALLOW_DEV_TOKEN` | Enable the dev "paste JWT" fallback (dev only)| `true`                  |

For production, create `.env.production` with your real HTTPS domains and set
`VITE_ALLOW_DEV_TOKEN=false`.

## Install dependencies

```bash
npm install
```

## Build (load unpacked)

```bash
npm run build          # outputs dist/
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `chrome-extension/dist` folder.
4. Pin the extension for quick access.

`npm run dev` rebuilds `dist/` on change (reload the extension in Chrome to pick
up changes).

## Connect

1. In RecruitPro, open **Settings → Chrome Extension** and click
   **Generate connection code**.
2. Open a LinkedIn profile, click the RecruitPro toolbar icon, and paste the
   code. The extension exchanges it for access/refresh tokens.

## Package for the Chrome Web Store

```bash
npm run build
npm run zip            # creates recruitpro-candidate-importer.zip from dist/
```

Upload the generated ZIP to the Chrome Web Store Developer Dashboard. After the
extension is published (or loaded unpacked), copy its ID and, if you call the API
from an extension *page* context, add `chrome-extension://<id>` to the backend
`EXTENSION_CORS_ORIGINS`. (Popup/service-worker fetches are already exempt from
CORS via `host_permissions`.)

## Test & typecheck

```bash
npm test               # vitest unit tests (normalize / detect / extract / validate)
npm run typecheck      # tsc --noEmit
```

## Project layout

```
chrome-extension/
├─ manifest.json            # MV3 manifest (entries reference src/*)
├─ vite.config.ts           # @crxjs/vite-plugin build
├─ src/
│  ├─ popup/                # popup UI + state machine (popup.ts/.html/.css)
│  ├─ content/              # content script, selectors (fallbacks), extractor
│  ├─ background/           # MV3 service worker
│  ├─ services/             # api, auth, storage, dropdowns, candidates, tabs
│  ├─ utils/                # normalizeUrl, text, validators, errors, sanitize
│  ├─ config/environment.ts # env-driven config
│  └─ types/                # shared TypeScript types
├─ scripts/                 # icon generator + zip packager
└─ tests/                   # vitest unit tests + HTML fixtures
```

When LinkedIn changes its DOM and extraction breaks, see
[`SELECTOR_MAINTENANCE.md`](./SELECTOR_MAINTENANCE.md).

## Security notes

- Tokens live in `chrome.storage.local` (origin-isolated; not readable by pages).
- Authorization codes are single-use, short-lived, and stored hashed server-side.
- Access tokens are short-lived JWTs; refresh tokens rotate on every refresh.
- Scraped text is only ever rendered via `textContent` — never `innerHTML`.
- Ownership (`created_by`) and all permissions are enforced server-side.

## Out of scope (MVP)

No organization model, no employment/education/skills extraction, no bulk
import, no auto-navigation/messaging, no enrichment/AI, no billing.
