import React from 'react';
import { Link } from 'react-router-dom';

export default function BuyerDashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Buyer Dashboard</p>
        <h1 className="text-3xl font-semibold text-white">Welcome back</h1>
        <p className="text-sm text-white/70">Quick links to your active orders and account info.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Orders</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Track purchases</h2>
          <p className="mt-3 text-sm text-white/70">
            View all your orders, payment status, and shipping updates.
          </p>
          <Link
            to="/buyer/orders"
            className="mt-5 inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:bg-white/10"
          >
            Open orders
          </Link>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Addresses</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Delivery info</h2>
          <p className="mt-3 text-sm text-white/70">Manage your saved addresses for faster checkout.</p>
          <Link
            to="/buyer/addresses"
            className="mt-5 inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:bg-white/10"
          >
            Manage addresses
          </Link>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Payment</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Payment methods</h2>
          <p className="mt-3 text-sm text-white/70">Save cards or use buy-now-pay-later (coming soon).</p>
          <button
            type="button"
            disabled
            className="mt-5 inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/40"
          >
            Coming soon
          </button>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">Support</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Need help?</h2>
          <p className="mt-3 text-sm text-white/70">Contact support for refunds, disputes, or questions.</p>
          <button
            type="button"
            className="mt-5 inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white/60 hover:bg-white/10"
          >
            Contact support
          </button>
        </article>
      </div>
    </section>
  );
}
