import React from 'react';
import Header from '../shared/layout/AppHeader';

export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6">{children}</main>
    </div>
  );
}
