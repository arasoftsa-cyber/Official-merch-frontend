import React from 'react';
import BlackHeader from './BlackHeader';
import BlackFooter from './BlackFooter';

type PublicLayoutProps = {
  children: React.ReactNode;
};

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <BlackHeader />

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6">{children}</main>

      <BlackFooter />
    </div>
  );
}
