import { environment } from "../config/environment";
import { ApiError } from "../utils/errors";
import { apiRequest } from "./api";
import { storage } from "./storage";
import type { ApiEnvelope, AuthSession, ExtensionUser } from "../types";

// Auth flow: the user opens the RecruitPro Settings page, clicks "Connect",
// and receives a short-lived, single-use authorization code. They paste it
// into the popup, which exchanges it for access + refresh tokens.

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: ExtensionUser;
}

function sessionFromTokens(data: TokenResponse): AuthSession {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    user: data.user,
  };
}

export async function exchangeCode(code: string): Promise<AuthSession> {
  const trimmed = code.trim();
  if (!trimmed) throw new ApiError("validation", "Enter the connection code.", 400);

  let res: Response;
  try {
    res = await fetch(`${environment.apiPrefix}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    });
  } catch {
    throw new ApiError("network", "Cannot reach RecruitPro.");
  }

  const env = (await res.json().catch(() => null)) as ApiEnvelope<TokenResponse> | null;
  if (!res.ok || !env?.success || !env.data) {
    throw new ApiError(
      res.status === 400 || res.status === 401 ? "validation" : "server",
      env?.message || "Invalid or expired code.",
      res.status,
    );
  }

  const session = sessionFromTokens(env.data);
  await storage.setSession(session);
  return session;
}

/** Dev-only: accept a pasted JWT access token directly (guarded by env flag). */
export async function connectWithDevToken(token: string): Promise<AuthSession> {
  if (!environment.allowDevToken) {
    throw new ApiError("forbidden", "Dev token connection is disabled.", 403);
  }
  const trimmed = token.trim();
  if (!trimmed) throw new ApiError("validation", "Paste a token.", 400);

  // Temporarily persist so getMe() can use it, then hydrate the real session.
  await storage.setSession({
    accessToken: trimmed,
    refreshToken: "",
    expiresAt: Date.now() + 30 * 60 * 1000,
    user: { id: 0, name: "", email: "", role: "recruiter" },
  });
  const user = await getMe();
  const session: AuthSession = {
    accessToken: trimmed,
    refreshToken: "",
    expiresAt: Date.now() + 30 * 60 * 1000,
    user,
  };
  await storage.setSession(session);
  return session;
}

export async function getMe(): Promise<ExtensionUser> {
  return apiRequest<ExtensionUser>("/auth/me");
}

export async function logout(): Promise<void> {
  const session = await storage.getSession();
  if (session?.refreshToken) {
    try {
      await apiRequest<null>("/auth/logout", {
        method: "POST",
        body: { refresh_token: session.refreshToken },
      });
    } catch {
      // Best effort — clear locally regardless of server outcome.
    }
  }
  await storage.clearSession();
  await storage.clearDropdowns();
}

export async function getActiveSession(): Promise<AuthSession | null> {
  return storage.getSession();
}
