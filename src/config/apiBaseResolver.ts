export type ApiBaseResolutionInput = {
  mode?: string | null;
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

export function resolveApiBase(input: ApiBaseResolutionInput): string {
  const mode = trim(input.mode).toLowerCase();
  const apiBaseProd = trim(input.apiBaseProd);
  const apiBaseDev = trim(input.apiBaseDev);
  const apiBaseLegacy = trim(input.apiBaseLegacy);
  const apiBaseProdCompat = trim(input.apiBaseProdCompat);
  const resolvedProd = apiBaseProd || apiBaseProdCompat || "";
  const hostname = trim(input.hostname);
  const nonLocalHost = hostname ? !isLocalHostname(hostname) : false;

  let candidate = "";
  if (mode === "production") {
    candidate = resolvedProd || apiBaseLegacy;
  } else if (nonLocalHost) {
    // Defensive guard: if a non-local host serves a non-production build,
    // prefer explicit production API origin to avoid accidental DEV API targets.
    candidate = resolvedProd || apiBaseLegacy || apiBaseDev;
  } else {
    candidate = apiBaseDev || apiBaseLegacy || resolvedProd;
  }

  if (!candidate) {
    const expectedEnv = mode === "production" ? "VITE_API_BASE_PROD" : "VITE_API_BASE_DEV";
    throw new Error(
      `[config] Missing API base URL. Set ${expectedEnv} (fallbacks: VITE_API_BASE_URL, VITE_PROD_API_BASE_URL).`
    );
  }
  return normalizeApiBase(candidate);
}
