import type { AuthSession, DropdownData } from "../types";

// Thin, typed wrapper over chrome.storage.local. Tokens live here (extension
// storage is origin-isolated and not readable by web pages).

const KEYS = {
  session: "recruitpro.session",
  dropdowns: "recruitpro.dropdowns",
} as const;

async function get<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function remove(key: string): Promise<void> {
  await chrome.storage.local.remove(key);
}

export const storage = {
  getSession: () => get<AuthSession>(KEYS.session),
  setSession: (session: AuthSession) => set(KEYS.session, session),
  clearSession: () => remove(KEYS.session),

  getDropdowns: () => get<DropdownData>(KEYS.dropdowns),
  setDropdowns: (data: DropdownData) => set(KEYS.dropdowns, data),
  clearDropdowns: () => remove(KEYS.dropdowns),
};

/** Dropdown cache is considered fresh for 10 minutes. */
export const DROPDOWN_TTL_MS = 10 * 60 * 1000;
