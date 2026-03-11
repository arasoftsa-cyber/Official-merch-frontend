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
      <Route path="admin" element={requireAuthElement(<AdminDashboardPage />)} />
      <Route path="admin/orders" element={requireAuthElement(<AdminOrdersPage />)} />
      <Route path="admin/artist-requests" element={requireAuthElement(<AdminArtistRequestsPage />)} />
      <Route path="admin/leads" element={requireAuthElement(<AdminLeadsPage />)} />
      <Route path="admin/artists" element={requireAuthElement(<AdminArtistsPage />)} />
      <Route path="admin/artists/:id" element={requireAuthElement(<AdminArtistDetailPage />)} />
      <Route path="admin/artists/:id/edit" element={requireAuthElement(<AdminArtistEditPage />)} />
      <Route path="admin/products" element={requireAuthElement(<AdminProductsPage />)} />
      <Route path="admin/products/new" element={requireAuthElement(<AdminCreateProductPage />)} />
      <Route path="admin/inventory-skus" element={requireAuthElement(<AdminSkuMasterPage />)} />
      <Route path="admin/drops" element={requireAuthElement(<AdminDropsPage />)} />
      <Route
        path="admin/homepage-banners"
        element={requireAuthElement(<AdminHomepageBannersPage />)}
      />
      <Route
        path="admin/products/:productId/variants"
        element={requireAuthElement(<AdminProductVariantsPage />)}
      />
      <Route path="admin/orders/:id" element={requireAuthElement(<AdminOrderDetailPage />)} />
      <Route path="admin/order/:id" element={requireAuthElement(<AdminOrderDetailPage />)} />
    </Route>
  );
}
