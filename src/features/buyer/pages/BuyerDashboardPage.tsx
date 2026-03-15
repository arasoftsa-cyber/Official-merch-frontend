import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../shared/ui/Page';

export default function BuyerDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/60">Buyer Dashboard</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Welcome back</h1>
        <p className="text-sm text-slate-600 dark:text-white/70">Quick links to your active orders and account info.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-white/50">Orders</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Track purchases</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-white/70">
            View all your orders, payment status, and shipping updates.
          </p>
          <Link
            to="/fan/orders"
            className="mt-5 inline-flex items-center rounded-full border border-slate-300 dark:border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white transition hover:border-slate-900 dark:hover:border-white/60 hover:bg-slate-900 hover:text-white dark:hover:bg-white/10"
          >
            Open orders
          </Link>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-white/50">Addresses</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Delivery info</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-white/70">Manage your saved addresses for faster checkout.</p>
          <Link
            to="/fan/addresses"
            className="mt-5 inline-flex items-center rounded-full border border-slate-300 dark:border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white transition hover:border-slate-900 dark:hover:border-white/60 hover:bg-slate-900 hover:text-white dark:hover:bg-white/10"
          >
            Manage addresses
          </Link>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-white/50">Payment</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Payment methods</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-white/70">Save cards or use buy-now-pay-later (coming soon).</p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex items-center rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-400 dark:text-white/40"
          >
            Coming soon
          </button>
        </Card>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400 dark:text-white/50">Support</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">Need help?</h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-white/70">Contact support for refunds, disputes, or questions.</p>
          <button
            type="button"
            className="mt-5 inline-flex items-center rounded-full border border-slate-300 dark:border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white transition hover:border-slate-900 dark:hover:border-white/60 hover:bg-slate-900 hover:text-white dark:hover:bg-white/10"
          >
            Contact support
          </button>
        </Card>
      </div>
    </section>
  );
}
