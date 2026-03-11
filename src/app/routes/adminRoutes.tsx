import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RouteElementWrapper } from './routeHelpers';

const AdminProvisioningPage = lazy(() => import('../../features/admin/pages/AdminProvisioningPage'));

export function AdminRoutes({ requireAuthElement }: { requireAuthElement: RouteElementWrapper }) {
  return (
    <Route path="/admin/provisioning" element={requireAuthElement(<AdminProvisioningPage />)} />
  );
}
