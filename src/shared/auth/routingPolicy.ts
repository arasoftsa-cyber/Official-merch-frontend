export type AuthPortal = 'fan' | 'partner';

type NullableString = string | null | undefined;

const LOGIN_PATHS = ['/fan/login', '/partner/login', '/login'] as const;
const AUTH_BYPASS_PATHS = [...LOGIN_PATHS, '/logout'] as const;

const STOREFRONT_SHOPPER_ROLES = new Set(['buyer', 'fan', 'customer', 'artist', 'label', 'admin']);
const PARTNER_ALLOWED_ROLES = new Set(['artist', 'label', 'admin']);
const FAN_ALLOWED_ROLES = new Set(['buyer', 'fan', 'customer']);

const ROLE_HOME_ROUTE: Record<string, string> = {
  admin: '/partner/admin',
  label: '/partner/label',
  artist: '/partner/artist',
  buyer: '/fan',
  fan: '/fan',
  customer: '/fan',
};

const PORTAL_LOGIN_ROUTE: Record<AuthPortal, string> = {
  fan: '/fan/login',
  partner: '/partner/login',
};

const PORTAL_DEFAULT_ROUTE: Record<AuthPortal, string> = {
  fan: '/fan',
  partner: '/partner',
};

const AUTH_PORTAL_MISMATCH_FAN_TO_PARTNER = 'auth_portal_mismatch_fan_to_partner';
const AUTH_PORTAL_MISMATCH_PARTNER_TO_FAN = 'auth_portal_mismatch_partner_to_fan';
const AUTH_PARTNER_ACCOUNT_NOT_FOUND = 'auth_partner_account_not_found';
const AUTH_PARTNER_ACCOUNT_UNAPPROVED = 'auth_partner_account_unapproved';
const AUTH_OIDC_PROFILE_INCOMPLETE = 'auth_oidc_profile_incomplete';
const AUTH_OIDC_FAILED = 'auth_oidc_failed';

export function normalizeRole(role: NullableString): string | null {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized || null;
}

export function resolveRoleFromAuthPayload(payload: any): string | null {
  const roleSource =
    payload?.role ||
    (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
    payload?.user?.role ||
    null;
  return normalizeRole(roleSource);
}

export function isPartnerRole(role: NullableString): boolean {
  const normalized = normalizeRole(role);
  return Boolean(normalized && PARTNER_ALLOWED_ROLES.has(normalized));
}

export function isFanRole(role: NullableString): boolean {
  const normalized = normalizeRole(role);
  return Boolean(normalized && FAN_ALLOWED_ROLES.has(normalized));
}

export function getRoleHomeRoute(role: NullableString): string {
  const normalized = normalizeRole(role);
  if (!normalized) return '/fan';
  return ROLE_HOME_ROUTE[normalized] || '/fan';
}

export function getPortalLoginRoute(portal: AuthPortal): string {
  return PORTAL_LOGIN_ROUTE[portal];
}

export function normalizeAuthPortal(value: NullableString, fallback: AuthPortal = 'fan'): AuthPortal {
  return String(value || '').trim().toLowerCase() === 'partner' ? 'partner' : fallback;
}

export function getRequestedAuthPortal(search: NullableString, fallback: AuthPortal = 'fan'): AuthPortal {
  const params = new URLSearchParams(String(search || ''));
  return normalizeAuthPortal(params.get('portal'), fallback);
}

export function getPortalForPath(pathname: NullableString): AuthPortal | null {
  const path = getPathnameOnly(String(pathname || '/'));
  if (path.startsWith('/partner')) return 'partner';
  if (path.startsWith('/fan')) return 'fan';
  return null;
}

export function getPathnameOnly(path: NullableString): string {
  const resolved = String(path || '/');
  return resolved.split(/[?#]/)[0] || '/';
}

export function isAuthBypassPath(pathname: NullableString): boolean {
  const path = getPathnameOnly(pathname);
  return AUTH_BYPASS_PATHS.some((candidate) => isExactPath(path, candidate));
}

function isExactPath(pathname: string, candidate: string): boolean {
  return pathname === candidate || pathname === `${candidate}/`;
}

function isLoginPath(pathname: string): boolean {
  return LOGIN_PATHS.some((candidate) => isExactPath(pathname, candidate));
}

function decodePath(raw: NullableString): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isSafeInternalPath(path: NullableString): boolean {
  const value = String(path || '').trim();
  return value.startsWith('/') && !value.startsWith('//');
}

function normalizeReturnTarget(raw: NullableString): string | null {
  const decoded = decodePath(raw);
  if (!isSafeInternalPath(decoded)) return null;
  return decoded;
}

function normalizePartnerEntryTarget(target: string, role: NullableString): string {
  const pathname = getPathnameOnly(target);
  if (!isExactPath(pathname, '/partner') && !isExactPath(pathname, '/partner/dashboard')) {
    return target;
  }
  if (!isPartnerRole(role)) {
    return '/';
  }
  return getRoleHomeRoute(role);
}

function isAllowedForPortal(pathname: string, portal: AuthPortal | null): boolean {
  if (!portal) return true;
  if (portal === 'fan') return !pathname.startsWith('/partner');
  return !isLoginPath(pathname);
}

export function roleAllowsPath(role: NullableString, path: NullableString): boolean {
  const pathname = getPathnameOnly(path);
  if (isAuthBypassPath(pathname)) return true;
  const roleNorm = normalizeRole(role);
  if (!roleNorm) return false;
  const isStorefrontRole = STOREFRONT_SHOPPER_ROLES.has(roleNorm);

  if (pathname.startsWith('/partner/admin')) return roleNorm === 'admin';
  if (pathname.startsWith('/partner/artist')) return roleNorm === 'artist' || roleNorm === 'admin';
  if (pathname.startsWith('/partner/label')) return roleNorm === 'label' || roleNorm === 'admin';
  if (pathname.startsWith('/partner')) return isPartnerRole(roleNorm);
  if (pathname.startsWith('/fan')) return isStorefrontRole;
  if (pathname.startsWith('/admin')) return roleNorm === 'admin';
  if (pathname.startsWith('/artist')) return roleNorm === 'artist' || roleNorm === 'admin';
  if (pathname.startsWith('/label')) return roleNorm === 'label' || roleNorm === 'admin';
  if (pathname.startsWith('/buyer')) return isStorefrontRole;
  return true;
}

export function getRequestedReturnTo(search: NullableString): string | null {
  const params = new URLSearchParams(String(search || ''));
  return normalizeReturnTarget(params.get('returnTo') || params.get('next'));
}

export function getSafeFallbackRoute({
  portal,
  role,
  fallbackRoute = '/',
}: {
  portal?: AuthPortal | null;
  role?: NullableString;
  fallbackRoute?: string;
} = {}): string {
  if (normalizeRole(role)) {
    return getRoleHomeRoute(role);
  }
  if (portal) {
    return PORTAL_DEFAULT_ROUTE[portal];
  }
  return fallbackRoute;
}

export function resolvePostLoginRedirect({
  returnTo,
  search,
  portal,
  role,
  fallbackRoute = '/',
}: {
  returnTo?: NullableString;
  search?: NullableString;
  portal?: AuthPortal | null;
  role?: NullableString;
  fallbackRoute?: string;
}): string {
  const normalizedRole = normalizeRole(role);
  const candidate = normalizeReturnTarget(returnTo ?? getRequestedReturnTo(search || ''));
  const effectivePortal = portal || null;

  if (candidate) {
    const candidatePath = getPathnameOnly(candidate);
    const allowByRole = normalizedRole ? roleAllowsPath(normalizedRole, candidatePath) : true;
    const canUseCandidate =
      !isLoginPath(candidatePath) &&
      allowByRole &&
      isAllowedForPortal(candidatePath, effectivePortal);
    if (canUseCandidate) {
      return normalizePartnerEntryTarget(candidate, normalizedRole);
    }
  }

  if (effectivePortal === 'partner') {
    if (normalizedRole) {
      return getRoleHomeRoute(normalizedRole);
    }
    return PORTAL_DEFAULT_ROUTE.partner;
  }

  if (effectivePortal === 'fan') {
    return PORTAL_DEFAULT_ROUTE.fan;
  }

  if (normalizedRole) {
    return getRoleHomeRoute(normalizedRole);
  }

  return fallbackRoute;
}

export function resolvePartnerEntryRedirect(role: NullableString, fallbackRoute = '/'): string {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole && isPartnerRole(normalizedRole)) {
    return getRoleHomeRoute(normalizedRole);
  }
  return fallbackRoute;
}

export function toSafeReturnTo(
  value: NullableString,
  {
    portal,
    role,
    fallbackRoute = '/',
  }: {
    portal?: AuthPortal | null;
    role?: NullableString;
    fallbackRoute?: string;
  } = {}
): string {
  const normalized = normalizeReturnTarget(value);
  if (!normalized) {
    return getSafeFallbackRoute({ portal, role, fallbackRoute });
  }
  const path = getPathnameOnly(normalized);
  const normalizedRole = normalizeRole(role);
  const allowByRole = normalizedRole ? roleAllowsPath(normalizedRole, path) : true;
  const allowByPortal = isAllowedForPortal(path, portal || null);
  if (!allowByRole || !allowByPortal || isLoginPath(path)) {
    return getSafeFallbackRoute({ portal, role, fallbackRoute });
  }
  return normalized;
}

type PortalIssueCode =
  | 'auth_portal_mismatch_fan_to_partner'
  | 'auth_portal_mismatch_partner_to_fan'
  | 'auth_partner_account_not_found'
  | 'auth_partner_account_unapproved'
  | 'auth_oidc_profile_incomplete'
  | 'auth_oidc_failed'
  | 'unknown';

type PortalIssueResult = {
  code: PortalIssueCode | null;
  message: string | null;
  redirectTo: string | null;
};

function normalizePortalIssueCode(rawCode: NullableString): PortalIssueCode | null {
  const normalized = String(rawCode || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === AUTH_PORTAL_MISMATCH_FAN_TO_PARTNER) return AUTH_PORTAL_MISMATCH_FAN_TO_PARTNER;
  if (normalized === AUTH_PORTAL_MISMATCH_PARTNER_TO_FAN) return AUTH_PORTAL_MISMATCH_PARTNER_TO_FAN;
  if (normalized === AUTH_PARTNER_ACCOUNT_NOT_FOUND) return AUTH_PARTNER_ACCOUNT_NOT_FOUND;
  if (normalized === AUTH_PARTNER_ACCOUNT_UNAPPROVED) return AUTH_PARTNER_ACCOUNT_UNAPPROVED;
  if (normalized === AUTH_OIDC_PROFILE_INCOMPLETE) return AUTH_OIDC_PROFILE_INCOMPLETE;
  if (normalized === AUTH_OIDC_FAILED) return AUTH_OIDC_FAILED;
  return 'unknown';
}

function buildPortalLoginHref(portal: AuthPortal, returnTo: NullableString): string {
  const safeReturnTo = normalizeReturnTarget(returnTo) || getSafeFallbackRoute({ portal });
  const loginPath = getPortalLoginRoute(portal);
  return `${loginPath}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

export function getPortalLoginHref(portal: AuthPortal, returnTo?: NullableString): string {
  return buildPortalLoginHref(portal, returnTo);
}

export function parseAuthErrorFromSearch(search: NullableString): {
  code: string | null;
  message: string | null;
  returnTo: string | null;
} {
  const params = new URLSearchParams(String(search || ''));
  const code = String(params.get('error') || '').trim();
  const message = String(params.get('message') || '').trim();
  const returnTo = String(params.get('returnTo') || '').trim();
  return {
    code: code || null,
    message: message || null,
    returnTo: returnTo || null,
  };
}

export function resolvePortalIssue({
  code,
  message,
  currentPortal,
  returnTo,
}: {
  code?: NullableString;
  message?: NullableString;
  currentPortal: AuthPortal;
  returnTo?: NullableString;
}): PortalIssueResult {
  const normalizedCode = normalizePortalIssueCode(code);
  if (!normalizedCode && !message) {
    return { code: null, message: null, redirectTo: null };
  }

  if (normalizedCode === AUTH_PORTAL_MISMATCH_FAN_TO_PARTNER) {
    return {
      code: normalizedCode,
      message: String(message || '').trim() || 'This account belongs to the Partner Portal. Use partner login.',
      redirectTo: currentPortal === 'fan' ? buildPortalLoginHref('partner', returnTo) : null,
    };
  }

  if (normalizedCode === AUTH_PORTAL_MISMATCH_PARTNER_TO_FAN) {
    return {
      code: normalizedCode,
      message: String(message || '').trim() || 'This account belongs to the Fan Portal. Use fan login.',
      redirectTo: currentPortal === 'partner' ? buildPortalLoginHref('fan', returnTo) : null,
    };
  }

  if (normalizedCode === AUTH_PARTNER_ACCOUNT_NOT_FOUND) {
    return {
      code: normalizedCode,
      message: String(message || '').trim() || 'No approved partner account found for this email.',
      redirectTo: null,
    };
  }

  if (normalizedCode === AUTH_PARTNER_ACCOUNT_UNAPPROVED) {
    return {
      code: normalizedCode,
      message: String(message || '').trim() || 'Partner account is not approved yet.',
      redirectTo: null,
    };
  }

  if (normalizedCode === AUTH_OIDC_PROFILE_INCOMPLETE) {
    return {
      code: normalizedCode,
      message:
        String(message || '').trim() || 'Google account did not return a usable email profile.',
      redirectTo: null,
    };
  }

  if (normalizedCode === AUTH_OIDC_FAILED) {
    return {
      code: normalizedCode,
      message: String(message || '').trim() || 'Google login failed. Please try again.',
      redirectTo: null,
    };
  }

  const finalMessage = String(message || '').trim();
  return {
    code: normalizedCode || 'unknown',
    message: finalMessage || null,
    redirectTo: null,
  };
}

export function resolvePortalIssueFromSearch({
  search,
  currentPortal,
  fallbackReturnTo,
}: {
  search: NullableString;
  currentPortal: AuthPortal;
  fallbackReturnTo?: NullableString;
}): PortalIssueResult {
  const parsed = parseAuthErrorFromSearch(search);
  return resolvePortalIssue({
    code: parsed.code,
    message: parsed.message,
    currentPortal,
    returnTo: parsed.returnTo || fallbackReturnTo,
  });
}
