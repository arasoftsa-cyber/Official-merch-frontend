import React, { lazy } from 'react';
import { Navigate, Outlet, Route } from 'react-router-dom';
import { RouteElementWrapper, ParamsRedirect } from './routeHelpers';

const PartnerLayout = lazy(() => import('../../layouts/PartnerLayout'));
const PartnerEntryRedirectPage = lazy(
  () => import('../../features/auth/pages/partner/PartnerEntryRedirectPage')
);
const LabelDashboardPage = lazy(() => import('../../features/label/pages/LabelDashboardPage'));
const LabelArtistDetailPage = lazy(() => import('../../features/label/pages/LabelArtistDetailPage'));
const AdminDashboardPage = lazy(() => import('../../features/admin/pages/AdminDashboardPage'));
const AdminOrderDetailPage = lazy(() => import('../../features/admin/pages/AdminOrderDetailPage'));
const AdminOrdersPage = lazy(() => import('../../features/admin/pages/AdminOrdersPage'));
const AdminArtistRequestsPage = lazy(
  () => import('../../features/admin/pages/AdminArtistRequestsPage')
);
const AdminProductsPage = lazy(() => import('../../features/admin/pages/AdminProductsPage'));
const AdminCreateProductPage = lazy(
  () => import('../../features/admin/pages/AdminCreateProductPage')
);
const AdminProductVariantsPage = lazy(
  () => import('../../features/admin/pages/AdminProductVariantsPage')
);
const AdminSkuMasterPage = lazy(() => import('../../features/admin/pages/AdminSkuMasterPage'));
const AdminDropsPage = lazy(() => import('../../features/admin/pages/AdminDropsPage'));
const AdminLeadsPage = lazy(() => import('../../features/admin/pages/AdminLeadsPage'));
const AdminArtistsPage = lazy(() => import('../../features/admin/pages/AdminArtistsPage'));
const AdminArtistDetailPage = lazy(() => import('../../features/admin/pages/AdminArtistDetailPage'));
const AdminArtistEditPage = lazy(() => import('../../features/admin/pages/AdminArtistEditPage'));
const AdminHomepageBannersPage = lazy(
  () => import('../../features/admin/pages/AdminHomepageBannersPage')
);
const ArtistProductsPage = lazy(() => import('../../features/artist/pages/ArtistProductsPage'));
const ArtistProductVariantsPage = lazy(
  () => import('../../features/artist/pages/ArtistProductVariantsPage')
);
const ArtistDropsPage = lazy(() => import('../../features/artist/pages/ArtistDropsPage'));
const ArtistDashboardPage = lazy(() =>
  import('../../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistDashboardPage,
  }))
);
const ArtistOrdersPage = lazy(() =>
  import('../../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistOrdersPage,
  }))
);
const ArtistOrderDetailPage = lazy(() =>
  import('../../features/artist/pages/ArtistDashboardPage').then((module) => ({
    default: module.ArtistOrderDetailPage,
  }))
);

export function PartnerRoutes({
  requireAuthElement,
}: {
  requireAuthElement: RouteElementWrapper;
}) {
  return (
    <Route path="/partner" element={<PartnerLayout />}>
      <Route index element={<PartnerEntryRedirectPage />} />
      <Route path="dashboard" element={<PartnerEntryRedirectPage />} />
      <Route path="artist" element={requireAuthElement(<Outlet />)}>
        <Route index element={<ArtistDashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/partner/artist" replace />} />
        <Route path="orders" element={<ArtistOrdersPage />} />
        <Route path="orders/:orderId" element={<ArtistOrderDetailPage />} />
        <Route path="drop/:id" element={<Navigate to="/partner/artist/drops" replace />} />
        <Route path="products" element={<ArtistProductsPage />} />
        <Route path="products/:id/variants" element={<ArtistProductVariantsPage />} />
        <Route path="drops" element={<ArtistDropsPage />} />
      </Route>
      <Route path="label" element={requireAuthElement(<LabelDashboardPage />)} />
      <Route path="label/orders" element={requireAuthElement(<LabelDashboardPage />)} />
      <Route path="label/orders/:id" element={requireAuthElement(<LabelDashboardPage />)} />
      <Route path="label/artists" element={requireAuthElement(<LabelDashboardPage />)} />
      <Route path="label/artists/:artistId" element={requireAuthElement(<LabelArtistDetailPage />)} />
      <Route
        path="label/artist/:artistId"
        element={
          requireAuthElement(
            <ParamsRedirect to={(params) => `/partner/label/artists/${params.artistId ?? ''}`} />
          )
        }
      />
      <Route path="admin" element={requireAuthElement(<Outlet />)}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="artist-requests" element={<AdminArtistRequestsPage />} />
        <Route path="leads" element={<AdminLeadsPage />} />
        <Route path="artists" element={<AdminArtistsPage />} />
        <Route path="artists/:id" element={<AdminArtistDetailPage />} />
        <Route path="artists/:id/edit" element={<AdminArtistEditPage />} />
        <Route path="products" element={<AdminProductsPage />} />
        <Route path="products/new" element={<AdminCreateProductPage />} />
        <Route path="inventory-skus" element={<AdminSkuMasterPage />} />
        <Route path="drops" element={<AdminDropsPage />} />
        <Route path="homepage-banners" element={<AdminHomepageBannersPage />} />
        <Route path="products/:productId/variants" element={<AdminProductVariantsPage />} />
        <Route path="orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="order/:id" element={<AdminOrderDetailPage />} />
      </Route>
    </Route>
  );
}
