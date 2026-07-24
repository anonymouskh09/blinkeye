// Centralised runtime configuration. Values come from Vite env variables
// (prefixed with VITE_) that are inlined at build time. No secrets live here.

function readEnv(key: string, fallback: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv] as string | undefined;
  return value && value.length > 0 ? value : fallback;
}

const apiBaseUrl = readEnv("VITE_API_BASE_URL", "http://localhost:8000").replace(/\/+$/, "");
const appBaseUrl = readEnv("VITE_APP_BASE_URL", "http://localhost:3000").replace(/\/+$/, "");

export const environment = {
  /** Backend origin, e.g. http://localhost:8000 */
  apiBaseUrl,
  /** Full API prefix used by the extension endpoints. */
  apiPrefix: `${apiBaseUrl}/api/v1/extension`,
  /** RecruitPro web app origin, e.g. http://localhost:3000 */
  appBaseUrl,
  /** Deep link to the settings page used to obtain an auth code. */
  connectUrl: `${appBaseUrl}/settings?tab=extension`,
  /** Dev-only paste-token fallback. Never enable for production builds. */
  allowDevToken: readEnv("VITE_ALLOW_DEV_TOKEN", "false") === "true",
  isProduction: import.meta.env.PROD,
} as const;

export type Environment = typeof environment;
