import React from 'react';
import type { Product } from '../../pages/AdminProductsPage.utils';
import { extractListingPhotoUrls } from '../../pages/AdminProductsPage.utils';

type Props = {
  loading: boolean;
  products: Product[];
  artistLabelById: Record<string, string>;
  onEditProduct: (product: Product) => void;
  onOpenVariants: (productId: string) => void;
};

export default function AdminProductsCatalogTable({
  loading,
  products,
  artistLabelById,
  onEditProduct,
  onOpenVariants,
}: Props) {
  return (
    <div
      data-testid="admin-products-list"
      className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
            <th className="px-8 py-5">Product Info</th>
            <th className="px-8 py-5">Artist</th>
            <th className="px-8 py-5">Performance</th>
            <th className="px-8 py-5">Status</th>
            <th className="px-8 py-5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {!loading && products.length === 0 && (
            <tr>
              <td colSpan={5} className="px-8 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <svg className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-4m-8 0H4"
                    />
                  </svg>
                  <p className="text-sm font-bold uppercase tracking-widest">No products found</p>
                </div>
              </td>
            </tr>
          )}
          {products.map((product) => {
            const active = Boolean(product.isActive ?? product.is_active);
            const statusLabel =
              typeof product.status === 'string' && product.status.trim().length > 0
                ? product.status.toLowerCase()
                : active
                  ? 'active'
                  : 'inactive';
            const rowProductId = String(product.productId || product.id || '').trim();
            const artistId = product.artistId || product.artist_id || '';
            const thumbnail = extractListingPhotoUrls(product)[0] || '';

            return (
              <tr
                key={rowProductId || product.id}
                data-testid="admin-product-row"
                data-product-id={rowProductId}
                className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    {thumbnail ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105">
                        <img
                          data-testid="admin-product-row-thumbnail"
                          src={thumbnail}
                          alt={product.title ?? 'Product'}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div
                        data-testid="admin-product-row-thumbnail-empty"
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {product.title ?? 'Untitled Product'}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        ID: {product.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {artistLabelById[artistId] || 'Unknown Artist'}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                      {(String(product.merchType || product.merch_type || 'Other')).replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Category</span>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${
                      active
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-white/10'
                    }`}
                  >
                    {statusLabel}
                  </span>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      type="button"
                      data-testid="admin-product-row-edit"
                      onClick={() => onEditProduct(product)}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenVariants(rowProductId)}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                    >
                      Variants
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
