/**
 * MV3 service worker — native Chrome Side Panel only.
 * Do NOT hardcode side panel HTML paths here (CRX/Vite rewrites them in dist).
 * Manifest `side_panel.default_path` is the source of truth.
 */

async function configureSidePanel(): Promise<void> {
  try {
    // Only toggle open-on-icon. Path comes from manifest side_panel.default_path.
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.error("[RecruitPro] setPanelBehavior failed", err);
  }
}

void configureSidePanel();

chrome.runtime.onInstalled.addListener(() => {
  console.info("[RecruitPro] installed/updated — Side Panel mode");
  void configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
});

/**
 * Fallback open when openPanelOnActionClick is not active yet.
 * Only fires if there is no default_popup (we intentionally have none).
 */
chrome.action.onClicked.addListener((tab) => {
  const windowId = tab.windowId;
  if (typeof windowId !== "number") return;
  void chrome.sidePanel
    .open({ windowId, tabId: tab.id })
    .catch((err) => console.error("[RecruitPro] sidePanel.open failed", err));
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "FETCH_IMAGE_DATA_URL" || typeof message.url !== "string") {
    return false;
  }

  void (async () => {
    try {
      const res = await fetch(message.url, { credentials: "omit", cache: "force-cache" });
      if (!res.ok) {
        sendResponse({ ok: false, error: `HTTP ${res.status}` });
        return;
      }
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) {
        sendResponse({ ok: false, error: "Not an image" });
        return;
      }
      if (blob.size > 1.5 * 1024 * 1024) {
        sendResponse({ ok: false, error: "Image too large" });
        return;
      }
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      sendResponse({ ok: true, dataUrl: `data:${blob.type || "image/jpeg"};base64,${base64}` });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : "fetch failed" });
    }
  })();

  return true;
});
