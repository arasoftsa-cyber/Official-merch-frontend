import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { LegacyRedirect, ParamsRedirect } from './routeHelpers';

export function AliasRoutes() {
  return (
    <>
      {/* Legacy buyer/account aliases retained for deep-link compatibility. */}
      <Route path="/buyer" element={<LegacyRedirect to="/fan" />} />
      <Route path="/account" element={<Navigate to="/fan" replace />} />
      <Route path="/buyer/orders" element={<LegacyRedirect to="/fan/orders" />} />
      <Route path="/buyer/orders/:id" element={<ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />} />
      <Route path="/buyer/order/:id" element={<ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />} />

      {/* Legacy partner area aliases retained for compatibility. */}
      <Route path="/artist/*" element={<Navigate to="/partner/artist" replace />} />
      <Route path="/artists/dashboard" element={<LegacyRedirect to="/partner/artist" />} />
      <Route path="/artists/products" element={<LegacyRedirect to="/partner/artist/products" />} />
      <Route path="/label" element={<LegacyRedirect to="/partner/label" />} />
      <Route path="/label/orders" element={<LegacyRedirect to="/partner/label/orders" />} />
      <Route
        path="/label/orders/:id"
        element={<ParamsRedirect to={(params) => `/partner/label/orders/${params.id ?? ''}`} />}
      />
      <Route path="/label/artists" element={<LegacyRedirect to="/partner/label/artists" />} />
      <Route
        path="/label/artist/:artistId"
        element={<ParamsRedirect to={(params) => `/partner/label/artists/${params.artistId ?? ''}`} />}
      />

      {/* Legacy admin aliases retained for compatibility. */}
      <Route path="/admin" element={<LegacyRedirect to="/partner/admin" />} />
      <Route path="/admin/orders" element={<LegacyRedirect to="/partner/admin/orders" />} />
      <Route path="/admin/artist-requests" element={<LegacyRedirect to="/partner/admin/artist-requests" />} />
      <Route path="/admin/leads" element={<LegacyRedirect to="/partner/admin/leads" />} />
      <Route path="/admin/artists" element={<LegacyRedirect to="/partner/admin/artists" />} />
      <Route
        path="/admin/artists/:id"
        element={<ParamsRedirect to={(params) => `/partner/admin/artists/${params.id ?? ''}`} />}
      />
      <Route
        path="/admin/artists/:id/edit"
        element={<ParamsRedirect to={(params) => `/partner/admin/artists/${params.id ?? ''}/edit`} />}
      />
      <Route path="/admin/products" element={<LegacyRedirect to="/partner/admin/products" />} />
      <Route path="/admin/inventory-skus" element={<LegacyRedirect to="/partner/admin/inventory-skus" />} />
      <Route path="/admin/homepage-banners" element={<LegacyRedirect to="/partner/admin/homepage-banners" />} />
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
        element={<ParamsRedirect to={(params) => `/partner/admin/orders/${params.id ?? ''}`} />}
      />
      <Route
        path="/admin/order/:id"
        element={<ParamsRedirect to={(params) => `/partner/admin/order/${params.id ?? ''}`} />}
      />
    </>
  );
}
