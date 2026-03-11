import React from 'react';
import { Route } from 'react-router-dom';
import { NotFoundPage } from '../../pages/ErrorPages';

export function FallbackRoutes() {
  return <Route path="*" element={<NotFoundPage />} />;
}
