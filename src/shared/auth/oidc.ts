import { API_BASE } from '../api/http';

export type OidcPortal = 'fan' | 'partner';
const DEFAULT_OIDC_CALLBACK_PATH = '/auth/oidc/callback';
const isProdBuild = Boolean(import.meta.env.PROD);

const DEFAULT_RETURN_TO: Record<OidcPortal, string> = {
  fan: '/fan',
  partner: '/partner/dashboard',
};

const normalizePublicOrigin = (rawValue: string, envName: string): string => {
  const value = String(rawValue || '').trim();
  if (!value) return '';

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${envName} must be a valid absolute http(s) URL`);
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    throw new Error(`${envName} must use http or https`);
  }

  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    throw new Error(`${envName} must not include query/hash/credentials`);
  }

  const pathname = parsed.pathname || '/';
  if (pathname !== '/' && pathname !== '') {
    throw new Error(`${envName} must be an origin URL without a path`);
  }

  const origin = parsed.origin;
  if (
    isProdBuild &&
    (origin.toLowerCase().includes('localhost') || origin.includes('127.0.0.1'))
  ) {
    throw new Error(`${envName} must not use localhost in production`);
  }

  return origin;
};

const normalizeCallbackPath = (rawValue: string | undefined): string => {
  const value = String(rawValue || '').trim();
  if (!value) return DEFAULT_OIDC_CALLBACK_PATH;
  if (/^https?:\/\//i.test(value)) {
    throw new Error('VITE_OIDC_CALLBACK_PATH must be a relative path');
  }
  if (!value.startsWith('/') || value.startsWith('//')) {
    throw new Error('VITE_OIDC_CALLBACK_PATH must start with a single "/"');
  }
  if (value.includes('?') || value.includes('#')) {
    throw new Error('VITE_OIDC_CALLBACK_PATH must not include query or hash');
  }
  if (value.length === 1) return value;
  return value.replace(/\/+$/, '');
};

const resolvePublicAppOrigin = (): string => {
  const envValue =
    (import.meta.env.VITE_APP_ORIGIN as string | undefined)?.trim() ||
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim() ||
    '';
  if (!envValue) {
    if (isProdBuild) {
      throw new Error('VITE_PUBLIC_APP_URL (or VITE_APP_ORIGIN) is required in production');
    }
    return '';
  }
  return normalizePublicOrigin(envValue, 'VITE_PUBLIC_APP_URL');
};

const PUBLIC_APP_ORIGIN = resolvePublicAppOrigin();
export const OIDC_CALLBACK_PATH = normalizeCallbackPath(
  (import.meta.env.VITE_OIDC_CALLBACK_PATH as string | undefined)?.trim()
);

export const toSafeReturnTo = (value: string | null | undefined, portal: OidcPortal): string => {
  const fallback = DEFAULT_RETURN_TO[portal];
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (decoded.startsWith('/') && !decoded.startsWith('//')) {
    return decoded;
  }
  return fallback;
};

export const buildGoogleOidcStartUrl = (
  portal: OidcPortal,
  returnTo: string | null | undefined
): string => {
  const params = new URLSearchParams();
  params.set('portal', portal);
  params.set('returnTo', toSafeReturnTo(returnTo, portal));
  if (PUBLIC_APP_ORIGIN) {
    params.set('appOrigin', PUBLIC_APP_ORIGIN);
  }
  return `${API_BASE}/api/auth/oidc/google/start?${params.toString()}`;
};
