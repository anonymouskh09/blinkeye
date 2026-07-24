// Defensive helpers to guarantee we never inject raw HTML from a scraped page
// into the popup DOM. Everything rendered from extracted data must go through
// setText / attribute setters — never innerHTML.

export function setText(el: HTMLElement | null, value: string | null | undefined): void {
  if (!el) return;
  el.textContent = value ?? "";
}

/**
 * Allow http(s) and data:image/* (used when we proxy LinkedIn CDN photos so the
 * extension popup can display them without referrer blocks).
 */
export function safeImageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^data:image\/[a-zA-Z0-9+.-]+;base64,/i.test(value)) return value;
  if (value.startsWith("blob:")) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    return null;
  } catch {
    return null;
  }
}
