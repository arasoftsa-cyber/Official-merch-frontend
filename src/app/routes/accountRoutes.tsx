import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { RouteElementWrapper } from './routeHelpers';

const BuyerOrdersPage = lazy(() => import('../../features/buyer/pages/BuyerOrdersPage'));
const BuyerOrderDetailPage = lazy(() => import('../../features/buyer/pages/BuyerOrderDetailPage'));
const BuyerLayout = lazy(() => import('../../features/buyer/pages/BuyerLayout'));
const BuyerDashboardPage = lazy(() => import('../../features/buyer/pages/BuyerDashboardPage'));
const BuyerAddressesPage = lazy(() => import('../../features/buyer/pages/BuyerAddressesPage'));
const BuyerPaymentMethodsPage = lazy(
  () => import('../../features/buyer/pages/BuyerPaymentMethodsPage')
);

export function AccountRoutes({
  requireAuthElement,
}: {
  requireAuthElement: RouteElementWrapper;
}) {
  return (
    <Route path="/fan" element={requireAuthElement(<BuyerLayout />)}>
      <Route index element={<BuyerDashboardPage />} />
      <Route path="orders" element={<BuyerOrdersPage />} />
      <Route path="orders/:id" element={<BuyerOrderDetailPage />} />
      <Route path="addresses" element={<BuyerAddressesPage />} />
      <Route path="payment-methods" element={<BuyerPaymentMethodsPage />} />
    </Route>
  );
}
