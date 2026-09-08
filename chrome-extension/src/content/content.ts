import { extractProfile, waitForProfileReady } from "./extractProfile";
import { prepareProfileDom } from "./prepareProfileDom";
import { isSupportedProfileUrl } from "./pageStatus";
import { debugLog } from "../utils/normalizeProfile";
import type { RuntimeMessage, RuntimeResponse } from "../types";

// Progressive extract:
// 1) EXTRACT_QUICK — top card only (instant UI)
// 2) EXTRACT_PROFILE — scroll + sections (background enrich)

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse: (r: RuntimeResponse) => void) => {
    const handle = async () => {
      try {
        switch (message.type) {
          case "PING_CONTENT":
          case "GET_PAGE_STATUS":
            return {
              ok: true as const,
              type: "PAGE_STATUS" as const,
              supported: isSupportedProfileUrl(location.href),
              url: location.href,
            };

          case "EXTRACT_QUICK": {
            if (!isSupportedProfileUrl(location.href)) {
              return { ok: false as const, error: "This is not a LinkedIn profile page." };
            }
            await waitForProfileReady(document, 8000);
            const result = extractProfile(document, location.href);
            return {
              ok: true as const,
              type: "EXTRACTION" as const,
              phase: "quick" as const,
              result,
            };
          }

          case "EXTRACT_PROFILE": {
            if (!isSupportedProfileUrl(location.href)) {
              return { ok: false as const, error: "This is not a LinkedIn profile page." };
            }

            await waitForProfileReady(document, 8000);

            // Cap wait — show partial results rather than blocking forever
            const prep = await prepareProfileDom(document);
            debugLog("prepareProfileDom", prep);

            const result = extractProfile(document, location.href);
            debugLog("final extraction counts", {
              experiences: result.profile.experiences.length,
              educations: result.profile.educations.length,
              skills: result.profile.skills.length,
            });

            return {
              ok: true as const,
              type: "EXTRACTION" as const,
              phase: "full" as const,
              result,
            };
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
