import React, { lazy } from 'react';
import { Outlet, Route } from 'react-router-dom';
import { OIDC_CALLBACK_PATH } from '../../shared/auth/oidc';
import { ForbiddenPage, NotFoundPage } from '../../pages/ErrorPages';
import PublicLayout from '../../layouts/PublicLayout';
import BareLayout from '../../layouts/BareLayout';
import RedirectPage from '../../pages/RedirectPage';
import { RouteElementWrapper } from './routeHelpers';

const LandingPage = lazy(() => import('../../pages/LandingPage'));
const ProductsPage = lazy(() => import('../../pages/ProductsPage'));
const ArtistPage = lazy(() => import('../../pages/ArtistPage'));
const ArtistsPage = lazy(() => import('../../pages/ArtistsPage'));
const DropsPage = lazy(() => import('../../pages/DropsPage'));
const FanLoginPage = lazy(() => import('../../features/auth/pages/fan/FanLoginPage'));
const FanRegisterPage = lazy(() => import('../../features/auth/pages/fan/FanRegisterPage'));
const PartnerLoginPage = lazy(() => import('../../features/auth/pages/partner/PartnerLoginPage'));
const ForgotPasswordPage = lazy(() => import('../../features/auth/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('../../features/auth/pages/ResetPasswordPage'));
const OidcCallbackPage = lazy(() => import('../../features/auth/pages/OidcCallbackPage'));
const CartPage = lazy(() => import('../../pages/CartPage'));
const ProductDetailPage = lazy(() => import('../../pages/ProductDetailPage'));
const DropPage = lazy(() => import('../../pages/DropPage'));
const ApplyArtistPage = lazy(() => import('../../features/onboarding/pages/ApplyArtistPage'));

const OIDC_CALLBACK_ROUTE_PATH = OIDC_CALLBACK_PATH.replace(/^\/+/, '');

export function PublicRoutes({ loginEntryElement }: { loginEntryElement: RouteElementWrapper }) {
  return (
    <Route element={<AppLayout />}>
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="artists" element={<ArtistsPage />} />
        <Route path="artists/:handle" element={<ArtistPage />} />
        <Route path="drops" element={<DropsPage />} />
        <Route path="drops/:handle" element={<DropPage />} />
        <Route path="apply/artist" element={<ApplyArtistPage />} />
        <Route path="fan/login" element={loginEntryElement(<FanLoginPage />)} />
        <Route path="fan/register" element={<FanRegisterPage />} />
        <Route path="partner/login" element={loginEntryElement(<PartnerLoginPage />)} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="artists/dashboard" element={<RedirectPage to="/partner/artist" />} />
      <Route path="artists/products" element={<RedirectPage to="/partner/artist/products" />} />
      <Route path="artists/drop/:id" element={<RedirectPage to="/partner/artist/drop/:id" />} />
      <Route element={<BareLayout />}>
        <Route path={OIDC_CALLBACK_ROUTE_PATH} element={<OidcCallbackPage />} />
      </Route>
      <Route path="cart" element={<CartPage />} />
      <Route path="forbidden" element={<ForbiddenPage />} />
      <Route path="notfound" element={<NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  );
}

function AppLayout() {
  return <Outlet />;
}
