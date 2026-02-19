import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import BlackFooter from '../../shared/layout/BlackFooter';
import BlackHeader from '../../shared/layout/BlackHeader';

const tabs = [
  { to: '', label: 'Dashboard' },
  { to: 'orders', label: 'Orders' },
  { to: 'addresses', label: 'Addresses' },
  { to: 'payment-methods', label: 'Payment Methods', disabled: true },
];

export default function BuyerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-white">
      <BlackHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <header className="mb-6 space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-white/60">Buyer</p>
            <h1 className="text-3xl font-semibold">Portal</h1>
          </header>
          <nav className="mb-8 flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.to === ""}
                className={({ isActive }) =>
                  `rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    tab.disabled
                      ? "border-white/20 text-white/40 cursor-not-allowed"
                      : isActive
                      ? "border-white bg-white/10 text-white"
                      : "border-white/20 text-white/70 hover:border-white/40 hover:text-white"
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
                  <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                    Soon
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="space-y-8">
            <Outlet />
          </div>
        </div>
      </main>
      <BlackFooter />
    </div>
  );
}
