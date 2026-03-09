import React from 'react';
import { Card } from '../../../shared/ui/Page';

export default function BuyerPaymentMethodsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-white/60">Manage</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Payment Methods</h1>
        <p className="text-sm text-slate-600 dark:text-white/70">Save your cards for faster checkout.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <p className="text-sm text-slate-500 dark:text-white/40">You have not saved any payment methods yet.</p>
          <button
            type="button"
            disabled
            className="mt-4 rounded-full border border-slate-200 dark:border-white/10 px-6 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-white/40 cursor-not-allowed"
          >
            Add payment method
          </button>
        </Card>
      </div>
    </section>
  );
}
