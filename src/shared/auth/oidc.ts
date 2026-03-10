import { API_BASE } from '../api/http';

export type OidcPortal = 'fan' | 'partner';

const DEFAULT_RETURN_TO: Record<OidcPortal, string> = {
  fan: '/fan',
  partner: '/partner/dashboard',
};

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
  const params = new URLSearchParams({
    portal,
    returnTo: toSafeReturnTo(returnTo, portal),
  });
  return `${API_BASE}/api/auth/oidc/google/start?${params.toString()}`;
};
