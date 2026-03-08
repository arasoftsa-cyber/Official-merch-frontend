import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import BlackFooter from '../../../shared/layout/BlackFooter';
import BlackHeader from '../../../shared/layout/BlackHeader';
import { Page, Container } from '../../../shared/ui/Page';

const tabs = [
  { to: '', label: 'Dashboard' },
  { to: 'orders', label: 'Orders' },
  { to: 'addresses', label: 'Addresses' },
  { to: 'payment-methods', label: 'Payment Methods', disabled: true },
];

export default function BuyerLayout() {
  return (
    <Page className="min-h-screen flex flex-col bg-white dark:bg-black">
      <BlackHeader />
      <main className="flex-1">
        <Container className="py-8">
          <header className="mb-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/60">Buyer</p>
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Portal</h1>
          </header>
          <nav className="mb-8 flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === ""}
                className={({ isActive }) =>
                  `rounded-full border px-4 py-2 text-sm font-semibold transition ${tab.disabled
                    ? "border-slate-200 dark:border-white/20 text-slate-400 dark:text-white/40 cursor-not-allowed"
                    : isActive
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white/10 dark:text-white"
                      : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-white/20 dark:text-white/70 dark:hover:border-white/40 dark:hover:text-white"
                  }`
                }
                aria-disabled={tab.disabled}
                onClick={(event) => {
                  if (tab.disabled) {
                    event.preventDefault();
                  }
                }}
              >
                {tab.label}
                {tab.disabled && (
                  <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">
                    Soon
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-8">
            <Outlet />
          </div>
        </Container>
      </main>
      <BlackFooter />
    </Page>
  );
}
