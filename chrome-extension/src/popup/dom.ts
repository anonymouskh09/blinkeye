// Tiny DOM builder. Using createElement + textContent everywhere guarantees we
// never inject scraped HTML strings into the popup.

type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else if (key === "html") throw new Error("Refusing to set innerHTML.");
    else if (key.startsWith("on") && typeof value === "string") continue;
    else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export function on<E extends keyof HTMLElementEventMap>(
  node: HTMLElement,
  event: E,
  handler: (ev: HTMLElementEventMap[E]) => void,
): void {
  node.addEventListener(event, handler);
}
