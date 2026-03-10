import React from 'react';
import { Outlet } from 'react-router-dom';
import AppHeader from '../shared/layout/AppHeader';

export default function PartnerLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
