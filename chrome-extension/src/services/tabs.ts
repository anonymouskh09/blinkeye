import type { ExtractionResult, RuntimeMessage, RuntimeResponse } from "../types";
import { isSupportedProfileUrl } from "../content/pageStatus";

function isBrowserPage(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:")
  );
}

async function getTargetTab(): Promise<chrome.tabs.Tab | null> {
  // Side panel focus can make "currentWindow" unreliable — prefer last focused.
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused?.id && focused.url && !isBrowserPage(focused.url)) {
    return focused;
  }

  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (current?.id && current.url && !isBrowserPage(current.url)) {
    return current;
  }

  // Fallback: any open LinkedIn profile tab
  const profiles = await chrome.tabs.query({ url: ["https://www.linkedin.com/in/*"] });
  const activeProfile = profiles.find((t) => t.active);
  return activeProfile ?? profiles[0] ?? focused ?? current ?? null;
}

async function sendMessage(tabId: number, message: RuntimeMessage): Promise<RuntimeResponse> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response: RuntimeResponse | undefined) => {
      if (chrome.runtime.lastError || !response) {
        resolve({ ok: false, error: chrome.runtime.lastError?.message ?? "No response from page." });
      } else {
        resolve(response);
      }
    });
  });
}

async function ensureContentScript(tabId: number): Promise<void> {
  const candidates = ["assets/content.ts-loader.js", "src/content/content.ts"];
  for (const file of candidates) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
      return;
    } catch {
      /* try next */
    }
  }
}

export interface PageContext {
  supported: boolean;
  url: string;
  tabId: number | null;
}

export async function getPageContext(): Promise<PageContext> {
  const tab = await getTargetTab();
  if (!tab?.id || !tab.url) {
    return { supported: false, url: tab?.url ?? "", tabId: tab?.id ?? null };
  }
  const supported = isSupportedProfileUrl(tab.url);
  return { supported, url: tab.url, tabId: tab.id };
}

async function requestExtract(
  tabId: number,
  type: "EXTRACT_QUICK" | "EXTRACT_PROFILE",
): Promise<ExtractionResult> {
  await ensureContentScript(tabId);
  await new Promise((r) => setTimeout(r, 150));

  let response = await sendMessage(tabId, { type });
  if (!response.ok) {
    await ensureContentScript(tabId);
    await new Promise((r) => setTimeout(r, 250));
    response = await sendMessage(tabId, { type });
  }
  if (!response.ok) throw new Error(response.error);
  if (response.type !== "EXTRACTION") throw new Error("Unexpected response from page.");
  return response.result;
}

/** Instant top-card extract for progressive UI. */
export async function requestQuickExtraction(tabId: number): Promise<ExtractionResult> {
  return requestExtract(tabId, "EXTRACT_QUICK");
}

/** Full scroll + section extract. */
export async function requestExtraction(tabId: number): Promise<ExtractionResult> {
  return requestExtract(tabId, "EXTRACT_PROFILE");
}
