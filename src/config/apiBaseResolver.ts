export type ApiBaseResolutionInput = {
  mode?: string | null;
  backendBaseUrl?: string | null;
  apiBaseProd?: string | null;
  apiBaseDev?: string | null;
  apiBaseLegacy?: string | null;
  apiBaseProdCompat?: string | null;
  hostname?: string | null;
};

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
  const backendBaseUrl = trim(input.backendBaseUrl);
  const apiBaseProd = trim(input.apiBaseProd);
  const apiBaseDev = trim(input.apiBaseDev);
  const apiBaseLegacy = trim(input.apiBaseLegacy);
  const apiBaseProdCompat = trim(input.apiBaseProdCompat);
  const hostname = trim(input.hostname);
  const isProduction = mode === "production";
  const nonLocalHost = hostname ? !isLocalHostname(hostname) : false;

  const normalizedByKey = {
    VITE_BACKEND_BASE_URL: parseAbsoluteApiBase("VITE_BACKEND_BASE_URL", backendBaseUrl),
    VITE_API_BASE_PROD: parseAbsoluteApiBase("VITE_API_BASE_PROD", apiBaseProd),
    VITE_PROD_API_BASE_URL: parseAbsoluteApiBase("VITE_PROD_API_BASE_URL", apiBaseProdCompat),
    VITE_API_BASE_DEV: parseAbsoluteApiBase("VITE_API_BASE_DEV", apiBaseDev),
    VITE_API_BASE_URL: parseAbsoluteApiBase("VITE_API_BASE_URL", apiBaseLegacy),
  };

  const orderedKeys = isProduction || nonLocalHost
    ? [
        "VITE_BACKEND_BASE_URL",
        "VITE_API_BASE_PROD",
        "VITE_PROD_API_BASE_URL",
        "VITE_API_BASE_URL",
      ]
    : [
        "VITE_BACKEND_BASE_URL",
        "VITE_API_BASE_DEV",
        "VITE_API_BASE_URL",
        "VITE_API_BASE_PROD",
        "VITE_PROD_API_BASE_URL",
      ];

  const selectedKey = orderedKeys.find((key) => {
    const value = normalizedByKey[key as keyof typeof normalizedByKey];
    return Boolean(value);
  });
  const candidate = selectedKey
    ? normalizedByKey[selectedKey as keyof typeof normalizedByKey]
    : "";

  if (!candidate) {
    throw new Error(
      "[config] Missing API base URL. Set VITE_BACKEND_BASE_URL (canonical) or a documented compatibility key."
    );
  }

  if ((isProduction || nonLocalHost) && selectedKey) {
    assertNoLocalhost(selectedKey, candidate);
  }

  return candidate;
}
