import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { LegacyRedirect, RouteElementWrapper } from './routeHelpers';

const LogoutPage = lazy(() => import('../../pages/LogoutPage'));

export function AuthRoutes({ loginEntryElement }: { loginEntryElement: RouteElementWrapper }) {
  return (
    <>
      <Route path="/login" element={loginEntryElement(<LegacyRedirect to="/fan/login" />)} />
      <Route path="/logout" element={<LogoutPage />} />
    </>
  );
}
