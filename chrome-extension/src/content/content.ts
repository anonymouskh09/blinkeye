import { extractProfile, waitForProfileReady } from "./extractProfile";
import { waitForRichProfile } from "./aggressiveScrape";
import { isSupportedProfileUrl } from "./pageStatus";
import type { RuntimeMessage, RuntimeResponse } from "../types";

// Content script: respond to popup extract requests. Also kept alive on all
// linkedin.com pages (see manifest) so SPA navigations to /in/* still work.
// Extraction is user-triggered and reads only the current DOM — no auto-scroll
// or "Show all" clicks.

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (r: RuntimeResponse) => void) => {
    const handle = async () => {
      try {
        switch (message.type) {
          case "PING_CONTENT":
            return {
              ok: true as const,
              type: "PAGE_STATUS" as const,
              supported: isSupportedProfileUrl(location.href),
              url: location.href,
            };

          case "GET_PAGE_STATUS":
            return {
              ok: true as const,
              type: "PAGE_STATUS" as const,
              supported: isSupportedProfileUrl(location.href),
              url: location.href,
            };

          case "EXTRACT_PROFILE": {
            if (!isSupportedProfileUrl(location.href)) {
              return { ok: false as const, error: "This is not a LinkedIn profile page." };
            }
            // Wait briefly for SPA hydration of the top card; do not scroll or expand.
            await waitForProfileReady(document, 5000);
            await waitForRichProfile(document, 5000);

            const result = extractProfile(document, location.href);
            return { ok: true as const, type: "EXTRACTION" as const, result };
          }

          default:
            return { ok: false as const, error: "Unknown message." };
        }
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : "Extraction failed.",
        };
      }
    };

    void handle().then(sendResponse);
    return true;
  },
);
