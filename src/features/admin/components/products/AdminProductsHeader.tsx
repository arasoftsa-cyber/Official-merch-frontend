import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminProductsHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100 dark:border-white/5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">
            Inventory Management
          </p>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Products</h1>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/partner/admin/inventory-skus"
          className="group relative inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200 transition-all hover:scale-[1.02] hover:border-slate-900 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white"
        >
          SKU Master
        </Link>
        <Link
          to="/partner/admin/products/new"
          className="group relative inline-flex items-center justify-center rounded-2xl bg-slate-900 dark:bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white dark:text-slate-950 shadow-2xl shadow-slate-900/20 dark:shadow-white/10 transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            Create Product
          </span>
        </Link>
        <Link
          className="group flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all shadow-sm"
          to="/partner/admin"
        >
          <svg
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
