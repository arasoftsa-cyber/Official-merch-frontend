import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Navigate, useLocation } from 'react-router-dom';
import { apiFetch, API_BASE } from '../shared/api/http';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../shared/auth/tokenStore';
import { getMe, getConfig } from '../shared/api/appApi';
import { safeErrorMessage } from '../shared/utils/safeError';
import { CartProvider } from '../cart/CartContext';
import ThemeToggle from '../shared/components/ThemeToggle';
import { PublicRoutes } from './routes/publicRoutes';
import { AuthRoutes } from './routes/authRoutes';
import { PartnerRoutes } from './routes/partnerRoutes';
import { AccountRoutes } from './routes/accountRoutes';
import { AliasRoutes } from './routes/aliasRoutes';
import { AdminRoutes } from './routes/adminRoutes';
import { DebugRoutes } from './routes/debugRoutes';
import { FallbackRoutes } from './routes/fallbackRoutes';

const SmokePage = lazy(() => import('../pages/SmokePage'));

const LOGIN_PATHS = ['/fan/login', '/partner/login', '/login'];
const AUTH_BYPASS_PATHS = [...LOGIN_PATHS, '/logout'];
const LOGIN_CONTEXT_KEY = 'om_login_context';
const LOGIN_OR_REGISTER_PATH_RE = /^\/(fan|partner)\/(login|register)(?:\/|$)/i;
const STOREFRONT_SHOPPER_ROLES = new Set(['buyer', 'fan', 'artist', 'label', 'admin']);
const ENABLE_DEBUG_ROUTES =
  import.meta.env.DEV &&
  /^(1|true|yes)$/i.test(String(import.meta.env.VITE_ENABLE_DEBUG_ROUTES || '').trim());

function isExactPath(pathname: string, candidate: string): boolean {
  return pathname === candidate || pathname === `${candidate}/`;
}

function isAuthBypassPath(pathname: string): boolean {
  return AUTH_BYPASS_PATHS.some((path) => isExactPath(pathname, path));
}

function roleHomePath(role: string | null): string {
  const roleNorm = (role || '').toLowerCase();
  if (roleNorm === 'admin') return '/partner/admin';
  if (roleNorm === 'label') return '/partner/label';
  if (roleNorm === 'artist') return '/partner/artist';
  return '/fan';
}

function getRequestedLoginPath(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('returnTo') || params.get('next') || '';
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  return decoded;
}

function getPathnameOnly(candidate: string): string {
  return candidate.split(/[?#]/)[0] || '/';
}

function roleAllowsPath(role: string | null, path: string): boolean {
  if (isAuthBypassPath(path)) return true;
  const roleNorm = (role || '').toLowerCase();
  if (!roleNorm) return false;
  const isStorefrontShopper = STOREFRONT_SHOPPER_ROLES.has(roleNorm);
  if (path.startsWith('/partner/admin')) {
    return roleNorm === 'admin';
  }
  if (path.startsWith('/partner/artist')) {
    return roleNorm === 'artist' || roleNorm === 'admin';
  }
  if (path.startsWith('/partner/label')) {
    return roleNorm === 'label' || roleNorm === 'admin';
  }
  if (path.startsWith('/partner')) {
    return roleNorm === 'artist' || roleNorm === 'label' || roleNorm === 'admin';
  }
  if (path.startsWith('/fan')) return isStorefrontShopper;
  if (path.startsWith('/admin')) return roleNorm === 'admin';
  if (path.startsWith('/artist')) return roleNorm === 'artist' || roleNorm === 'admin';
  if (path.startsWith('/label')) return roleNorm === 'label' || roleNorm === 'admin';
  if (path.startsWith('/buyer')) return isStorefrontShopper;
  return true;
}

function getPostLoginRedirect({
  loginContext,
  next,
  role,
}: {
  loginContext: string | null;
  next: string | null;
  role: string | null;
}): string {
  const requested = next ?? '';
  const nextPath = requested ? getPathnameOnly(requested) : '';

  if (loginContext === 'fan') {
    const canUseNext =
      Boolean(requested) &&
      requested.startsWith('/') &&
      !requested.startsWith('//') &&
      !nextPath.startsWith('/partner');
    return canUseNext ? requested : '/fan';
  }

  const canUsePartnerNext =
    Boolean(requested) &&
    nextPath.startsWith('/partner') &&
    roleAllowsPath(role, nextPath);
  if (canUsePartnerNext) {
    return requested;
  }

  return roleHomePath(role);
}

function StatusPage() {
  return (
    <main>
      <h1>Status</h1>
      <p>API Base: {API_BASE}</p>
      <p>OK</p>
    </main>
  );
}

function useAsyncResult<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err: any) {
      setError(safeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

function MePage() {
  const { data, loading, error, reload } = useAsyncResult(getMe);
  return (
    <main>
      <h1>Me</h1>
      {loading && <p>Loading...</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {!loading && !error && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}

function ConfigPage() {
  const { data, loading, error, reload } = useAsyncResult(getConfig);
  return (
    <main>
      <h1>Config</h1>
      {loading && <p>Loading...</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {!loading && !error && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}

function useAuthStatus() {
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(() => Boolean(getAccessToken()));
  const refreshAttemptedRef = useRef(false);
  const validatedTokenRef = useRef<string | null>(null);

  const ensureSessionForProtectedRoute = useCallback(async (pathname: string) => {
    const currentPath = getPathnameOnly(pathname || '/');
    const isLoginOrRegisterPath = LOGIN_OR_REGISTER_PATH_RE.test(currentPath);
    const isProtectedPortalPath =
      currentPath === '/fan' ||
      currentPath.startsWith('/fan/') ||
      currentPath === '/partner' ||
      currentPath.startsWith('/partner/');

    if (isLoginOrRegisterPath || !isProtectedPortalPath) return null;
    if (refreshAttemptedRef.current) return null;
    refreshAttemptedRef.current = true;
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const refreshResponse = await apiFetch('/api/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      const refreshedToken =
        refreshResponse?.accessToken ||
        refreshResponse?.token ||
        refreshResponse?.data?.accessToken ||
        refreshResponse?.access_token ||
        null;
      if (!refreshedToken) {
        return null;
      }
      setAccessToken(refreshedToken);
      const rotatedRefreshToken =
        refreshResponse?.refreshToken ||
        refreshResponse?.data?.refreshToken ||
        refreshResponse?.refresh_token ||
        null;
      if (rotatedRefreshToken) {
        setRefreshToken(rotatedRefreshToken);
      }
      return refreshedToken;
    } catch (err: any) {
      const status = Number(err?.status || 0);
      if (status === 401) {
        return null;
      }
      if (status >= 500 || !status) {
        console.error('[auth] refresh failed', err);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const currentPath = getPathnameOnly(location.pathname || '/');
    const isProtectedPortalPath =
      currentPath === '/fan' ||
      currentPath.startsWith('/fan/') ||
      currentPath === '/partner' ||
      currentPath.startsWith('/partner/');
    const currentToken = getAccessToken() || null;
    if (currentToken) {
      refreshAttemptedRef.current = false;
    }
    setHasToken(Boolean(currentToken));
    if (currentToken && validatedTokenRef.current !== currentToken) {
      setAuthChecked(false);
    }

    (async () => {
      const fetchRole = async () => {
        const me = await apiFetch('/auth/whoami');
        const resolvedRoleRaw =
          me?.role ||
          (Array.isArray(me?.roles) ? me.roles[0] : null) ||
          me?.user?.role ||
          null;
        const resolvedRole = String(resolvedRoleRaw || '').trim().toLowerCase();
        return resolvedRole || null;
      };

      try {
        let tokenForRequest = currentToken;
        if (!tokenForRequest && isProtectedPortalPath) {
          setAuthChecked(false);
          tokenForRequest = await ensureSessionForProtectedRoute(currentPath);
        }
        if (!tokenForRequest) {
          if (isMounted) {
            setRole(null);
            setHasToken(false);
            validatedTokenRef.current = null;
          }
          return;
        }

        if (validatedTokenRef.current === tokenForRequest) {
          if (isMounted) setHasToken(true);
          return;
        }

        const resolvedRole = await fetchRole();
        if (!isMounted) return;

        if (!resolvedRole) {
          clearTokens();
          setRole(null);
          setHasToken(false);
          validatedTokenRef.current = null;
          return;
        }
        setRole(resolvedRole);
        setHasToken(true);
        validatedTokenRef.current = tokenForRequest;
      } catch (err: any) {
        const message = typeof err?.message === 'string' ? err.message : '';
        if (message.includes('401') || message.includes('403')) {
          clearTokens();
          setHasToken(false);
          setRole(null);
          validatedTokenRef.current = null;
        } else if (isMounted) {
          setRole(null);
          setHasToken(false);
          validatedTokenRef.current = null;
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, ensureSessionForProtectedRoute]);

  return { role, authChecked, hasToken };
}

function Loading() {
  return (
    <main>
      <p>Loading...</p>
    </main>
  );
}

function AppRoutes() {
  const { role, authChecked, hasToken } = useAuthStatus();
  const location = useLocation();
  // Use live token presence as source-of-truth to avoid stale auth state after logout.
  const hasLiveToken = Boolean(getAccessToken());
  const isAuthenticated = hasToken && hasLiveToken;
  const effectiveRole = isAuthenticated ? role : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (isAuthenticated && !authChecked) {
    return <Loading />;
  }

  const requireAuthElement = (element: React.ReactNode) => {
    if (isAuthBypassPath(location.pathname)) {
      return element;
    }

    if (!isAuthenticated && !authChecked) {
      return <Loading />;
    }

    if (!isAuthenticated) {
      const returnTo = encodeURIComponent(location.pathname + location.search + location.hash);
      if (location.pathname.startsWith('/partner')) {
        return <Navigate to={`/partner/login?returnTo=${returnTo}`} replace />;
      }
      if (location.pathname.startsWith('/fan')) {
        return <Navigate to={`/fan/login?returnTo=${returnTo}`} replace />;
      }
      return element;
    }

    if (!authChecked) {
      return <Loading />;
    }

    if (effectiveRole && !roleAllowsPath(effectiveRole, location.pathname)) {
      return <Navigate to="/forbidden" replace />;
    }

    return element;
  };

  const loginEntryElement = (element: React.ReactNode) => {
    if (isAuthenticated && !authChecked) {
      return <Loading />;
    }
    if (isAuthenticated && authChecked) {
      const loginContext = localStorage.getItem(LOGIN_CONTEXT_KEY);
      const requested = getRequestedLoginPath(location.search);
      const target = getPostLoginRedirect({
        loginContext,
        next: requested,
        role: effectiveRole,
      });
      localStorage.removeItem(LOGIN_CONTEXT_KEY);
      return <Navigate to={target} replace />;
    }
    return element;
  };

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {PublicRoutes({ loginEntryElement })}
        {AuthRoutes({ loginEntryElement })}
        {PartnerRoutes({ requireAuthElement })}
        {DebugRoutes({
          enabled: ENABLE_DEBUG_ROUTES,
          requireAuthElement,
          statusElement: <StatusPage />,
          meElement: <MePage />,
          configElement: <ConfigPage />,
          smokeElement: <SmokePage />,
        })}
        {AccountRoutes({ requireAuthElement })}
        {AliasRoutes()}
        {AdminRoutes({ requireAuthElement })}
        {FallbackRoutes()}
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppRoutes />
      <ThemeToggle />
    </CartProvider>
  );
}
