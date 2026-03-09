import React from 'react';
import { Outlet } from 'react-router-dom';
import BlackHeader from '../shared/layout/BlackHeader';
import BlackFooter from '../shared/layout/BlackFooter';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-white">
      <BlackHeader />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6">
        <Outlet />
      </main>
      <BlackFooter />
    </div>
  );
}
