import React from 'react';
import { Card } from '../../ui/Page';

export default function BuyerAddressesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/60">Manage</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Addresses</h1>
        <p className="text-sm text-slate-600 dark:text-white/70">Your saved shipping and billing destinations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <p className="text-sm text-slate-500 dark:text-white/40">No addresses saved yet.</p>
          <button
            type="button"
            className="mt-4 rounded-full border border-slate-300 dark:border-white/30 px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-white transition hover:bg-slate-900 hover:text-white dark:hover:bg-white/10"
          >
            Add new address
          </button>
        </Card>
      </div>
    </section>
  );
}
