import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from 'react-router-dom';
import { apiFetch } from '../shared/api/http';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../shared/auth/tokenStore';
import { API_BASE } from '../shared/api/http';
import { getMe, getConfig } from '../shared/api/appApi';
import { ForbiddenPage, NotFoundPage } from '../pages/ErrorPages';
import { safeErrorMessage } from '../shared/utils/safeError';
import PublicLayout from '../shared/layout/PublicLayout';
import LandingPage from '../pages/LandingPage';
import ProductsPage from '../pages/ProductsPage';
import ArtistPage from '../pages/ArtistPage';
import ArtistsPage from '../pages/ArtistsPage';
import DropsPage from '../pages/DropsPage';
import RedirectPage from '../pages/RedirectPage';
import { CartProvider } from '../cart/CartContext';
import ThemeToggle from '../shared/components/ThemeToggle';

const PartnerLayout = lazy(() => import('../layouts/PartnerLayout'));
const SmokePage = lazy(() => import('../pages/SmokePage'));
const FanLoginPage = lazy(() => import('../features/auth/pages/fan/FanLoginPage'));
const FanRegisterPage = lazy(() => import('../features/auth/pages/fan/FanRegisterPage'));
const PartnerLoginPage = lazy(() => import('../features/auth/pages/partner/PartnerLoginPage'));
const OidcCallbackPage = lazy(() => import('../features/auth/pages/OidcCallbackPage'));
const PartnerEntryRedirectPage = lazy(
  () => import('../features/auth/pages/partner/PartnerEntryRedirectPage')
);
const CartPage = lazy(() => import('../pages/CartPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const DropPage = lazy(() => import('../pages/DropPage'));
const ApplyArtistPage = lazy(() => import('../features/onboarding/pages/ApplyArtistPage'));
const LogoutPage = lazy(() => import('../pages/LogoutPage'));
const LabelDashboardPage = lazy(() => import('../features/label/pages/LabelDashboardPage'));
const LabelArtistDetailPage = lazy(() => import('../features/label/pages/LabelArtistDetailPage'));
const AdminDashboardPage = lazy(() => import('../features/admin/pages/AdminDashboardPage'));
const AdminOrderDetailPage = lazy(() => import('../features/admin/pages/AdminOrderDetailPage'));
const AdminOrdersPage = lazy(() => import('../features/admin/pages/AdminOrdersPage'));
const AdminArtistRequestsPage = lazy(
  () => import('../features/admin/pages/AdminArtistRequestsPage')
);
const AdminProductsPage = lazy(() => import('../features/admin/pages/AdminProductsPage'));
const AdminCreateProductPage = lazy(
  () => import('../features/admin/pages/AdminCreateProductPage')
);
const AdminProductVariantsPage = lazy(
  () => import('../features/admin/pages/AdminProductVariantsPage')
);
const AdminSkuMasterPage = lazy(() => import('../features/admin/pages/AdminSkuMasterPage'));
const AdminDropsPage = lazy(() => import('../features/admin/pages/AdminDropsPage'));
const AdminProvisioningPage = lazy(() => import('../features/admin/pages/AdminProvisioningPage'));
const AdminLeadsPage = lazy(() => import('../features/admin/pages/AdminLeadsPage'));
const AdminArtistsPage = lazy(() => import('../features/admin/pages/AdminArtistsPage'));
const AdminArtistDetailPage = lazy(() => import('../features/admin/pages/AdminArtistDetailPage'));
const AdminArtistEditPage = lazy(() => import('../features/admin/pages/AdminArtistEditPage'));
const AdminHomepageBannersPage = lazy(
  () => import('../features/admin/pages/AdminHomepageBannersPage')
);
const BuyerOrdersPage = lazy(() => import('../features/buyer/pages/BuyerOrdersPage'));
const BuyerOrderDetailPage = lazy(() => import('../features/buyer/pages/BuyerOrderDetailPage'));
const BuyerLayout = lazy(() => import('../features/buyer/pages/BuyerLayout'));
const BuyerDashboardPage = lazy(() => import('../features/buyer/pages/BuyerDashboardPage'));
const BuyerAddressesPage = lazy(() => import('../features/buyer/pages/BuyerAddressesPage'));
const BuyerPaymentMethodsPage = lazy(
  () => import('../features/buyer/pages/BuyerPaymentMethodsPage')
);
const ArtistProductsPage = lazy(() => import('../features/artist/pages/ArtistProductsPage'));
const ArtistProductVariantsPage = lazy(
  () => import('../features/artist/pages/ArtistProductVariantsPage')
);
const ArtistDropsPage = lazy(() => import('../features/artist/pages/ArtistDropsPage'));
const ArtistDashboardPage = lazy(() =>
  import('../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistDashboardPage,
  }))
);
const ArtistOrdersPage = lazy(() =>
  import('../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistOrdersPage,
  }))
);
const ArtistOrderDetailPage = lazy(() =>
  import('../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistOrderDetailPage,
  }))
);

const LOGIN_PATHS = ['/fan/login', '/partner/login', '/login'];
const AUTH_BYPASS_PATHS = [...LOGIN_PATHS, '/logout'];
const LOGIN_CONTEXT_KEY = 'om_login_context';
const LOGIN_OR_REGISTER_PATH_RE = /^\/(fan|partner)\/(login|register)(?:\/|$)/i;

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
  if (path.startsWith('/fan')) return Boolean(roleNorm);
  if (path.startsWith('/admin')) return roleNorm === 'admin';
  if (path.startsWith('/artist')) return roleNorm === 'artist' || roleNorm === 'admin';
  if (path.startsWith('/label')) return roleNorm === 'label' || roleNorm === 'admin';
  if (path.startsWith('/buyer')) return roleNorm === 'buyer';
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
    const currentToken = getAccessToken();
    setHasToken(Boolean(currentToken));
    setAuthChecked(false);

    (async () => {
      const fetchRole = async () => {
        const me = await apiFetch('/auth/whoami');
        if (!isMounted) return;
        const resolvedRoleRaw =
          me?.role ||
          (Array.isArray(me?.roles) ? me.roles[0] : null) ||
          me?.user?.role ||
          null;
        const resolvedRole = String(resolvedRoleRaw || '').trim().toLowerCase();
        if (!resolvedRole) {
          clearTokens();
          setRole(null);
          setHasToken(false);
          return;
        }
        setRole(resolvedRole);
        setHasToken(true);
      };

      try {
        let tokenForRequest = currentToken;
        if (!tokenForRequest) {
          tokenForRequest = await ensureSessionForProtectedRoute(location.pathname);
        }
        if (!tokenForRequest) {
          if (isMounted) {
            setRole(null);
            setHasToken(false);
          }
          return;
        }
        await fetchRole();
      } catch (err: any) {
        const message = typeof err?.message === 'string' ? err.message : '';
        if (message.includes('401') || message.includes('403')) {
          clearTokens();
          setHasToken(false);
          setRole(null);
        } else if (isMounted) {
          setRole(null);
          setHasToken(false);
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

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={{ pathname: to, search: location.search }} />;
}

function ParamsRedirect({
  to,
}: {
  to: (params: Record<string, string | undefined>) => string;
}) {
  const params = useParams<Record<string, string | undefined>>();
  const location = useLocation();
  return (
    <Navigate
      replace
      to={{
        pathname: to(params),
        search: location.search,
      }}
    />
  );
}

function AppRoutes() {
  const { role, authChecked, hasToken } = useAuthStatus();
  const location = useLocation();
  const effectiveRole = hasToken ? role : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (hasToken && !authChecked) {
    return <Loading />;
  }

  const requireAuthElement = (element: React.ReactNode) => {
    if (isAuthBypassPath(location.pathname)) {
      return element;
    }

    if (!hasToken && !authChecked) {
      return <Loading />;
    }

    if (!hasToken) {
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
      console.log('[guard] redirecting', {
        role: effectiveRole,
        path: location.pathname,
        reason: 'forbidden',
      });
      return <Navigate to="/forbidden" replace />;
    }

    return element;
  };

  const loginEntryElement = (element: React.ReactNode) => {
    if (hasToken && !authChecked) {
      return <Loading />;
    }
    if (hasToken && authChecked) {
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
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <PublicLayout>
              <LandingPage />
            </PublicLayout>
          }
        />
        <Route
          path="products"
          element={
            <PublicLayout>
              <ProductsPage />
            </PublicLayout>
          }
        />
        <Route
          path="products/:id"
          element={
            <PublicLayout>
              <ProductDetailPage />
            </PublicLayout>
          }
        />
        <Route
          path="artists"
          element={
            <PublicLayout>
              <ArtistsPage />
            </PublicLayout>
          }
        />
        <Route
          path="artists/:handle"
          element={
            <PublicLayout>
              <ArtistPage />
            </PublicLayout>
          }
        />
        <Route
          path="artists/dashboard"
          element={<RedirectPage to="/partner/artist" />}
        />
        <Route
          path="artists/products"
          element={<RedirectPage to="/partner/artist/products" />}
        />
        <Route
          path="artists/drop/:id"
          element={<RedirectPage to="/partner/artist/drop/:id" />}
        />
        <Route
          path="drops"
          element={
            <PublicLayout>
              <DropsPage />
            </PublicLayout>
          }
        />
        <Route
          path="drops/:handle"
          element={
            <PublicLayout>
              <DropPage />
            </PublicLayout>
          }
        />
        <Route
          path="apply/artist"
          element={
            <PublicLayout>
              <ApplyArtistPage />
            </PublicLayout>
          }
        />
        <Route path="cart" element={<CartPage />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="notfound" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/login"
        element={loginEntryElement(<LegacyRedirect to="/fan/login" />)}
      />
      <Route
        path="/fan/login"
        element={loginEntryElement(<FanLoginPage />)}
      />
      <Route path="/fan/register" element={<FanRegisterPage />} />
      <Route path="/auth/oidc/callback" element={<OidcCallbackPage />} />
      <Route
        path="/partner"
        element={<PartnerLayout />}
      >
        <Route index element={<PartnerEntryRedirectPage />} />
        <Route
          path="login"
          element={loginEntryElement(<PartnerLoginPage />)}
        />
        <Route path="dashboard" element={<PartnerEntryRedirectPage />} />
        <Route
          path="artist"
          element={requireAuthElement(<Outlet />)}
        >
          <Route index element={<ArtistDashboardPage />} />
          <Route
            path="dashboard"
            element={<Navigate to="/partner/artist" replace />}
          />
          <Route
            path="orders"
            element={<ArtistOrdersPage />}
          />
          <Route
            path="orders/:orderId"
            element={<ArtistOrderDetailPage />}
          />
          <Route
            path="drop/:id"
            element={<Navigate to="/partner/artist/drops" replace />}
          />
          <Route
            path="products"
            element={<ArtistProductsPage />}
          />
          <Route
            path="products/:id/variants"
            element={<ArtistProductVariantsPage />}
          />
          <Route
            path="drops"
            element={<ArtistDropsPage />}
          />
        </Route>
        <Route
          path="label"
          element={requireAuthElement(<LabelDashboardPage />)}
        />
        <Route
          path="label/orders"
          element={requireAuthElement(<LabelDashboardPage />)}
        />
        <Route
          path="label/orders/:id"
          element={requireAuthElement(<LabelDashboardPage />)}
        />
        <Route
          path="label/artists"
          element={requireAuthElement(<LabelDashboardPage />)}
        />
        <Route
          path="label/artists/:artistId"
          element={requireAuthElement(<LabelArtistDetailPage />)}
        />
        <Route
          path="label/artist/:artistId"
          element={requireAuthElement(<ParamsRedirect to={(params) => `/partner/label/artists/${params.artistId ?? ''}`} />)}
        />
        <Route
          path="admin"
          element={requireAuthElement(<AdminDashboardPage />)}
        />
        <Route
          path="admin/orders"
          element={requireAuthElement(<AdminOrdersPage />)}
        />
        <Route
          path="admin/artist-requests"
          element={requireAuthElement(<AdminArtistRequestsPage />)}
        />
        <Route
          path="admin/leads"
          element={requireAuthElement(<AdminLeadsPage />)}
        />
        <Route
          path="admin/artists"
          element={requireAuthElement(<AdminArtistsPage />)}
        />
        <Route
          path="admin/artists/:id"
          element={requireAuthElement(<AdminArtistDetailPage />)}
        />
        <Route
          path="admin/artists/:id/edit"
          element={requireAuthElement(<AdminArtistEditPage />)}
        />
        <Route
          path="admin/products"
          element={requireAuthElement(<AdminProductsPage />)}
        />
        <Route
          path="admin/products/new"
          element={requireAuthElement(<AdminCreateProductPage />)}
        />
        <Route
          path="admin/inventory-skus"
          element={requireAuthElement(<AdminSkuMasterPage />)}
        />
        <Route
          path="admin/drops"
          element={requireAuthElement(<AdminDropsPage />)}
        />
        <Route
          path="admin/homepage-banners"
          element={requireAuthElement(<AdminHomepageBannersPage />)}
        />
        <Route
          path="admin/products/:productId/variants"
          element={requireAuthElement(<AdminProductVariantsPage />)}
        />
        <Route
          path="admin/orders/:id"
          element={requireAuthElement(<AdminOrderDetailPage />)}
        />
        <Route
          path="admin/order/:id"
          element={requireAuthElement(<AdminOrderDetailPage />)}
        />
      </Route>
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/smoke" element={requireAuthElement(<SmokePage />)} />
      <Route path="/fan" element={requireAuthElement(<BuyerLayout />)}>
        <Route index element={<BuyerDashboardPage />} />
        <Route path="orders" element={<BuyerOrdersPage />} />
        <Route path="orders/:id" element={<BuyerOrderDetailPage />} />
        <Route path="addresses" element={<BuyerAddressesPage />} />
        <Route path="payment-methods" element={<BuyerPaymentMethodsPage />} />
      </Route>
      <Route path="/buyer" element={<LegacyRedirect to="/fan" />} />
      <Route
        path="/account"
        element={<Navigate to="/fan" replace />}
      />
      <Route path="/buyer/orders" element={<LegacyRedirect to="/fan/orders" />} />
      <Route
        path="/buyer/orders/:id"
        element={
          <ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />
        }
      />
      <Route
        path="/buyer/order/:id"
        element={
          <ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />
        }
      />
      <Route
        path="/artist/*"
        element={<Navigate to="/partner/artist" replace />}
      />
      <Route
        path="/artists/dashboard"
        element={<LegacyRedirect to="/partner/artist" />}
      />
      <Route
        path="/artists/products"
        element={<LegacyRedirect to="/partner/artist/products" />}
      />
      <Route
        path="/label"
        element={<LegacyRedirect to="/partner/label" />}
      />
      <Route
        path="/label/orders"
        element={<LegacyRedirect to="/partner/label/orders" />}
      />
      <Route
        path="/label/orders/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/label/orders/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/label/artists"
        element={<LegacyRedirect to="/partner/label/artists" />}
      />
      <Route
        path="/label/artist/:artistId"
        element={
          <ParamsRedirect
            to={(params) => `/partner/label/artists/${params.artistId ?? ''}`}
          />
        }
      />
      <Route
        path="/admin"
        element={<LegacyRedirect to="/partner/admin" />}
      />
      <Route
        path="/admin/orders"
        element={<LegacyRedirect to="/partner/admin/orders" />}
      />
      <Route
        path="/admin/artist-requests"
        element={
          <LegacyRedirect to="/partner/admin/artist-requests" />
        }
      />
      <Route
        path="/admin/leads"
        element={<LegacyRedirect to="/partner/admin/leads" />}
      />
      <Route
        path="/admin/artists"
        element={<LegacyRedirect to="/partner/admin/artists" />}
      />
      <Route
        path="/admin/artists/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/artists/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/artists/:id/edit"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/artists/${params.id ?? ''}/edit`}
          />
        }
      />
      <Route
        path="/admin/products"
        element={<LegacyRedirect to="/partner/admin/products" />}
      />
      <Route
        path="/admin/inventory-skus"
        element={<LegacyRedirect to="/partner/admin/inventory-skus" />}
      />
      <Route
        path="/admin/homepage-banners"
        element={<LegacyRedirect to="/partner/admin/homepage-banners" />}
      />
      <Route
        path="/admin/products/:productId/variants"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/products/${params.productId ?? ''}/variants`}
          />
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/orders/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/order/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/order/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/provisioning"
        element={requireAuthElement(<AdminProvisioningPage />)}
      />
      <Route path="*" element={<NotFoundPage />} />
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

function AppLayout() {
  return <Outlet />;
}
