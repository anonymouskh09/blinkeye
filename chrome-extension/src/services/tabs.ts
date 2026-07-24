import type { ExtractionResult, RuntimeMessage, RuntimeResponse } from "../types";
import { isSupportedProfileUrl } from "../content/pageStatus";

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
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
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url) {
    return { supported: false, url: tab?.url ?? "", tabId: tab?.id ?? null };
  }
  const supported = isSupportedProfileUrl(tab.url);
  return { supported, url: tab.url, tabId: tab.id };
}

export async function requestExtraction(tabId: number): Promise<ExtractionResult> {
  // Always reinject — LinkedIn SPA navigations often leave us without a content script.
  await ensureContentScript(tabId);
  await new Promise((r) => setTimeout(r, 150));

  let response = await sendMessage(tabId, { type: "EXTRACT_PROFILE" });
  if (!response.ok) {
    await ensureContentScript(tabId);
    await new Promise((r) => setTimeout(r, 250));
    response = await sendMessage(tabId, { type: "EXTRACT_PROFILE" });
  }
  if (!response.ok) throw new Error(response.error);
  if (response.type !== "EXTRACTION") throw new Error("Unexpected response from page.");
  return response.result;
}
