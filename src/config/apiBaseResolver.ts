export type ApiBaseResolutionInput = {
  mode?: string | null;
  isDev?: boolean | null;
  isProd?: boolean | null;
  isTest?: boolean | null;
  apiBaseUrl?: string | null;
  hostname?: string | null;
  origin?: string | null;
};

const DEFAULT_DEV_API_BASE = "http://localhost:3000";
const DEFAULT_PROD_API_BASE = "/api";
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
  const explicitIsTest = typeof input.isTest === "boolean" ? input.isTest : null;
  const isDev = explicitIsDev ?? mode === "development";
  const isProd = explicitIsProd ?? mode === "production";
  const isTest = explicitIsTest ?? mode === "test";
  const apiBaseUrl = trim(input.apiBaseUrl);
  // Resolution order:
  // 1. Explicit VITE_API_BASE_URL for cross-origin API deployments.
  // 2. Localhost fallback for local development and static test execution.
  // 3. Relative same-origin /api for production builds.
  const explicitApiBase = parseAbsoluteApiBase("VITE_API_BASE_URL", apiBaseUrl);
  if (explicitApiBase) {
    if (isProd) {
      assertNoLocalhost("VITE_API_BASE_URL", explicitApiBase);
    }
    return explicitApiBase;
  }

  if (isDev || isTest) {
    return DEFAULT_DEV_API_BASE;
  }

  if (isProd) {
    return DEFAULT_PROD_API_BASE;
  }

  throw new Error(
    "[config] Missing API base URL. Set VITE_API_BASE_URL for cross-origin deployments, use the localhost fallback in development, or rely on the production same-origin /api default."
  );
}
