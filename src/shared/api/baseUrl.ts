const DEFAULT_API_BASE = 'http://localhost:3000';
const isProdBuild = Boolean(import.meta.env.PROD);

const normalizeBase = (value: string, envName: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${envName} must be a valid absolute http(s) URL`);
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`${envName} must use http or https`);
  }
  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(`${envName} must not include query/hash/credentials`);
  }

  let normalized = parsed.origin + (parsed.pathname || '/');
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/api')) normalized = normalized.slice(0, normalized.length - 4);

  if (
    isProdBuild &&
    (parsed.hostname.toLowerCase() === 'localhost' || parsed.hostname === '127.0.0.1')
  ) {
    throw new Error(`${envName} must not point to localhost in production`);
  }

  return normalized;
};

export function getApiBaseUrl(): string {
  const envBaseRaw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ||
    (import.meta.env.REACT_APP_API_BASE_URL as string | undefined)?.trim();

  if (envBaseRaw && envBaseRaw.length > 0) {
    return normalizeBase(envBaseRaw, 'VITE_API_BASE_URL');
  }
  if (isProdBuild) {
    throw new Error('VITE_API_BASE_URL (or VITE_API_URL/VITE_API_BASE) is required in production');
  }
  return DEFAULT_API_BASE;
}

export const API_BASE = getApiBaseUrl();
