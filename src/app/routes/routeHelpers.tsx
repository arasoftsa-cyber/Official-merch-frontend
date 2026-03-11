import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

export type RouteElementWrapper = (element: React.ReactNode) => React.ReactNode;

export function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={{ pathname: to, search: location.search }} />;
}

export function ParamsRedirect({
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
