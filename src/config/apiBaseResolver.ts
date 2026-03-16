export type ApiBaseResolutionInput = {
  mode?: string | null;
  isDev?: boolean | null;
  isProd?: boolean | null;
  apiBaseUrl?: string | null;
  hostname?: string | null;
  origin?: string | null;
};

const DEFAULT_DEV_API_BASE = "http://localhost:3000";
const trim = (value: unknown) => String(value || "").trim();

const isLocalHostname = (hostname: string) => {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
};

const normalizeApiBase = (value: string) => trim(value).replace(/\/+$/, "");

const parseAbsoluteApiBase = (key: string, rawValue: string): string => {
  const value = normalizeApiBase(rawValue);
  if (!value) return "";

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[config] ${key} must be a valid absolute http(s) URL.`);
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`[config] ${key} must use http or https.`);
  }
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(
      `[config] ${key} must not include query/hash/credentials.`
    );
  }
  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(`[config] ${key} must not include a path.`);
  }

  return parsed.origin;
};

const assertNoLocalhost = (key: string, resolved: string) => {
  const host = new URL(resolved).hostname;
  if (isLocalHostname(host)) {
    throw new Error(`[config] ${key} must not point to localhost in this environment.`);
  }
};

export function resolveApiBase(input: ApiBaseResolutionInput): string {
  const mode = trim(input.mode).toLowerCase();
  const explicitIsDev = typeof input.isDev === "boolean" ? input.isDev : null;
  const explicitIsProd = typeof input.isProd === "boolean" ? input.isProd : null;
  const isDev = explicitIsDev ?? mode === "development";
  const isProd = explicitIsProd ?? mode === "production";
  const apiBaseUrl = trim(input.apiBaseUrl);
  const hostname = trim(input.hostname);
  const origin = trim(input.origin);
  const nonLocalHost = hostname ? !isLocalHostname(hostname) : false;

  // Supported frontend inputs:
  // 1. Explicit VITE_API_BASE_URL for cross-origin API deployments.
  // 2. Same-origin runtime fallback for deployed production hosts.
  // 3. Localhost fallback only while running a dev build.
  const explicitApiBase = parseAbsoluteApiBase("VITE_API_BASE_URL", apiBaseUrl);
  if (explicitApiBase) {
    if (isProd || nonLocalHost) {
      assertNoLocalhost("VITE_API_BASE_URL", explicitApiBase);
    }
    return explicitApiBase;
  }

  const sameOriginApiBase = parseAbsoluteApiBase("window.location.origin", origin);
  if ((isProd || nonLocalHost) && sameOriginApiBase) {
    assertNoLocalhost("window.location.origin", sameOriginApiBase);
    return sameOriginApiBase;
  }

  if (isDev) {
    return DEFAULT_DEV_API_BASE;
  }

  throw new Error(
    "[config] Missing API base URL. Set VITE_API_BASE_URL for cross-origin deployments, rely on same-origin hosting in production, or use the development localhost fallback."
  );
}
