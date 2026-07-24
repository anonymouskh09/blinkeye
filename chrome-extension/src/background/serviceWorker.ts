// MV3 background service worker.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.info("[RecruitPro] Candidate Importer installed.");
  }
});

chrome.runtime.onStartup?.addListener(() => {
  console.info("[RecruitPro] service worker started.");
});

/**
 * Fetch LinkedIn CDN images with extension host_permissions (avoids popup
 * referrer/CORS blocks that show a broken avatar).
 */
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
      // Cap ~1.5MB to keep chrome.storage / message size reasonable.
      if (blob.size > 1.5 * 1024 * 1024) {
        sendResponse({ ok: false, error: "Image too large" });
        return;
      }
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const dataUrl = `data:${blob.type || "image/jpeg"};base64,${base64}`;
      sendResponse({ ok: true, dataUrl });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : "fetch failed" });
    }
  })();

  return true;
});
