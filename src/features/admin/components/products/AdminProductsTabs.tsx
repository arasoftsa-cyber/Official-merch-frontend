import React from 'react';
import type { ProductsTab } from '../../pages/AdminProductsPage.utils';

type Props = {
  activeTab: ProductsTab;
  pendingQueueCount: number;
  onTabChange: (tab: ProductsTab) => void;
};

export default function AdminProductsTabs({ activeTab, pendingQueueCount, onTabChange }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onTabChange('catalog')}
        className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
          activeTab === 'catalog'
            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-950'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        Catalog Products
      </button>
      <button
        type="button"
        data-testid="admin-pending-merch-tab"
        onClick={() => onTabChange('pending')}
        className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
          activeTab === 'pending'
            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-950'
            : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        Pending Merch ({pendingQueueCount})
      </button>
    </div>
  );
}
