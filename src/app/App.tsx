import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Routes, Navigate, useLocation } from 'react-router-dom';
import { apiFetch, API_BASE } from '../shared/api/http';
import {
  clearSession,
  getAccessToken,
  clearTokens,
  getRefreshToken,
  loadPersistedSession,
} from '../shared/auth/tokenStore';
import {
  getPortalForPath,
  getPortalLoginRoute,
  isAuthBypassPath,
  resolvePostLoginRedirect,
  resolveRoleFromAuthPayload,
  roleAllowsPath,
} from '../shared/auth/routingPolicy';
import { getMe, getConfig } from '../shared/api/appApi';
import { safeErrorMessage } from '../shared/utils/safeError';
import { CartProvider } from '../cart/CartContext';
import ThemeToggle from '../shared/components/ThemeToggle';
import FormattingConfigProvider from '../shared/formatting/FormattingConfigProvider';
import { PublicRoutes } from './routes/publicRoutes';
import { AuthRoutes } from './routes/authRoutes';
import { PartnerRoutes } from './routes/partnerRoutes';
import { AccountRoutes } from './routes/accountRoutes';
import { AliasRoutes } from './routes/aliasRoutes';
import { AdminRoutes } from './routes/adminRoutes';
import { DebugRoutes } from './routes/debugRoutes';
import { FallbackRoutes } from './routes/fallbackRoutes';

const SmokePage = lazy(() => import('../pages/SmokePage'));

const ENABLE_DEBUG_ROUTES =
  import.meta.env.DEV &&
  /^(1|true|yes)$/i.test(String(import.meta.env.VITE_ENABLE_DEBUG_ROUTES || '').trim());

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
  const validatedTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const persistedSession = loadPersistedSession();
    const currentToken = getAccessToken() || null;
    const currentRefreshToken = persistedSession.refreshToken || null;
    const sessionCandidate = currentToken || currentRefreshToken;

    if (!sessionCandidate) {
      if (isMounted) {
        setRole(null);
        setAuthChecked(true);
        validatedTokenRef.current = null;
      }
      return () => {
        isMounted = false;
      };
    }

    const currentSessionKey = currentToken || `refresh:${currentRefreshToken}`;
    if (validatedTokenRef.current !== currentSessionKey) {
      setAuthChecked(false);
    }

    (async () => {
      const fetchRole = async () => {
        const me = await apiFetch('/auth/whoami');
        return resolveRoleFromAuthPayload(me);
      };

      try {
        if (validatedTokenRef.current === currentSessionKey) {
          return;
        }

        const resolvedRole = await fetchRole();
        if (!isMounted) return;

        if (!resolvedRole) {
          clearSession();
          setRole(null);
          validatedTokenRef.current = null;
          return;
        }
        setRole(resolvedRole);
        validatedTokenRef.current = getAccessToken() || currentSessionKey;
      } catch (err: any) {
        const message = typeof err?.message === 'string' ? err.message : '';
        if (message.includes('401') || message.includes('403')) {
          clearSession();
          setRole(null);
          validatedTokenRef.current = null;
        } else if (isMounted) {
          setRole(null);
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
  }, [location.pathname]);

  return {
    role,
    authChecked,
    hasSessionCandidate: Boolean(getAccessToken() || getRefreshToken()),
  };
}

function Loading() {
  return (
    <main>
      <p>Loading...</p>
    </main>
  );
}

function AppRoutes() {
  const { role, authChecked, hasSessionCandidate } = useAuthStatus();
  const location = useLocation();
  const isAuthenticated = authChecked && Boolean(role);
  const effectiveRole = isAuthenticated ? role : null;
  const isExplicitLoginRoute =
    location.pathname === '/fan/login' || location.pathname === '/partner/login';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!authChecked && hasSessionCandidate) {
    return <Loading />;
  }

  const requireAuthElement = (element: React.ReactNode) => {
    if (isAuthBypassPath(location.pathname)) {
      return element;
    }

    if (!authChecked && hasSessionCandidate) {
      return <Loading />;
    }

    if (!isAuthenticated) {
      const returnTo = encodeURIComponent(location.pathname + location.search + location.hash);
      const portal = getPortalForPath(location.pathname);
      if (portal) {
        return <Navigate to={`${getPortalLoginRoute(portal)}?returnTo=${returnTo}`} replace />;
      }
      return element;
    }

    if (effectiveRole && !roleAllowsPath(effectiveRole, location.pathname)) {
      return <Navigate to="/forbidden" replace />;
    }

    return element;
  };

  const loginEntryElement = (element: React.ReactNode) => {
    if (!authChecked && hasSessionCandidate) {
      return <Loading />;
    }
    if (isExplicitLoginRoute) {
      return element;
    }
    if (isAuthenticated && authChecked) {
      const target = resolvePostLoginRedirect({
        search: location.search,
        portal: getPortalForPath(location.pathname),
        role: effectiveRole,
      });
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
    <FormattingConfigProvider>
      <CartProvider>
        <AppRoutes />
        <ThemeToggle />
      </CartProvider>
    </FormattingConfigProvider>
  );
}
