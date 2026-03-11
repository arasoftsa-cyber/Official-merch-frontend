import React from 'react';
import { Route } from 'react-router-dom';
import { RouteElementWrapper } from './routeHelpers';

export function DebugRoutes({
  enabled,
  requireAuthElement,
  statusElement,
  meElement,
  configElement,
  smokeElement,
}: {
  enabled: boolean;
  requireAuthElement: RouteElementWrapper;
  statusElement: React.ReactNode;
  meElement: React.ReactNode;
  configElement: React.ReactNode;
  smokeElement: React.ReactNode;
}) {
  if (!enabled) return null;
  return (
    <>
      <Route path="/status" element={statusElement} />
      <Route path="/me" element={meElement} />
      <Route path="/config" element={configElement} />
      <Route path="/smoke" element={requireAuthElement(smokeElement)} />
    </>
  );
}
