import { environment } from "../config/environment";
import { ApiError, kindFromStatus } from "../utils/errors";
import { storage } from "./storage";
import type { ApiEnvelope, AuthSession } from "../types";

// Central fetch wrapper. Attaches the Bearer token, unwraps the standard
// { success, data, message } envelope, and transparently refreshes the access
// token once on a 401 before retrying.

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  /** Internal: prevents infinite refresh loops. */
  _retry?: boolean;
}

let refreshInFlight: Promise<AuthSession | null> | null = null;

async function refreshSession(): Promise<AuthSession | null> {
  const session = await storage.getSession();
  if (!session?.refreshToken) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${environment.apiPrefix}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: session.refreshToken }),
        });
        if (!res.ok) {
          await storage.clearSession();
          return null;
        }
        const env = (await res.json()) as ApiEnvelope<{
          access_token: string;
          refresh_token: string;
          expires_in: number;
        }>;
        if (!env.success || !env.data) {
          await storage.clearSession();
          return null;
        }
        const updated: AuthSession = {
          ...session,
          accessToken: env.data.access_token,
          refreshToken: env.data.refresh_token,
          expiresAt: Date.now() + env.data.expires_in * 1000,
        };
        await storage.setSession(updated);
        return updated;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, _retry = false } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const session = await storage.getSession();
    if (!session?.accessToken) {
      throw new ApiError("unauthorized", "Not connected.", 401);
    }
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${environment.apiPrefix}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network", "Network request failed.");
  }

  if (res.status === 401 && auth && !_retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retry: true });
    }
    throw new ApiError("unauthorized", "Session expired.", 401);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiError(kindFromStatus(res.status), res.statusText, res.status);
    throw new ApiError("unknown", "Malformed server response.", res.status);
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(
      kindFromStatus(res.status),
      envelope?.message || res.statusText || "Request failed.",
      res.status,
      envelope?.data ?? null,
    );
  }

  return envelope.data as T;
}

/** Multipart upload helper (do not set Content-Type — browser sets boundary). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options: { auth?: boolean; _retry?: boolean; method?: string } = {},
): Promise<T> {
  const { auth = true, _retry = false, method = "POST" } = options;
  const headers: Record<string, string> = { Accept: "application/json" };

  if (auth) {
    const session = await storage.getSession();
    if (!session?.accessToken) {
      throw new ApiError("unauthorized", "Not connected.", 401);
    }
    headers.Authorization = `Bearer ${session.accessToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${environment.apiPrefix}${path}`, {
      method,
      headers,
      body: formData,
    });
  } catch {
    throw new ApiError("network", "Network request failed.");
  }

  if (res.status === 401 && auth && !_retry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiUpload<T>(path, formData, { ...options, _retry: true });
    }
    throw new ApiError("unauthorized", "Session expired.", 401);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiError(kindFromStatus(res.status), res.statusText, res.status);
    throw new ApiError("unknown", "Malformed server response.", res.status);
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(
      kindFromStatus(res.status),
      envelope?.message || res.statusText || "Request failed.",
      res.status,
      envelope?.data ?? null,
    );
  }

  return envelope.data as T;
}
