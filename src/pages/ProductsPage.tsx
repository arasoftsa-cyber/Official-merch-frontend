import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../shared/api';
import EmptyState from '../components/ux/EmptyState';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';
import { trackPageView } from '../shared/telemetry';
import ProductsGrid from '../components/products/ProductsGrid';

type ProductDTO = {
  id: string;
  title: string;
  artist?: string;
  description?: string;
  createdAt?: string;
  price?: number;
};

type RowStatus = 'idle' | 'loading' | 'success' | 'error';

const parsePrice = (value: any): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[^0-9.]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const mapProduct = (source: any): ProductDTO | null => {
  const id = source?.id ?? source?.productId ?? source?.sku ?? source?.product_id;
  if (!id) return null;
  const title = source?.title ?? source?.name ?? `Product ${String(id)}`;
  const artist =
    source?.artistName ??
    source?.artist?.name ??
    source?.artist_name ??
    source?.artist?.handle ??
    undefined;
  const description = source?.description ?? source?.blurb ?? source?.summary;
  const createdAt = source?.createdAt ?? source?.created ?? source?.created_at;
  const price =
    parsePrice(source?.price) ??
    parsePrice(source?.priceCents ? Number(source.priceCents) / 100 : undefined);
  return { id: String(id), title, artist, description, createdAt, price };
};

const chooseArray = (payload: any) =>
  payload?.items ?? payload?.products ?? payload?.data ?? payload?.results ?? [];

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<'relevance' | 'price-asc' | 'price-desc' | 'newest'>(
    'relevance'
  );
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [status, setStatus] = useState<RowStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const payload = await fetchJson<{ items?: any[]; products?: any[] }>('/products');
      const rawItems = Array.isArray(payload) ? payload : chooseArray(payload);
      const mapped = rawItems
        .map(mapProduct)
        .filter((item): item is ProductDTO => Boolean(item));
      setProducts(mapped);
      setStatus('success');
    } catch (err: any) {
      setProducts([]);
      setError(err?.message ?? 'Failed to load products');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loadProducts();
    trackPageView('Products');
  }, [loadProducts]);

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isEmpty = status === 'success' && products.length === 0;

  const displayedProducts = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    const matchesSearch = (product: ProductDTO) => {
      if (!normalized) return true;
      const haystack = [product.title, product.artist, product.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    };

    const bySort = [...products]
      .filter(matchesSearch)
      .sort((a, b) => {
        if (sortKey === 'price-asc' || sortKey === 'price-desc') {
          const pa = Number(a.price ?? NaN);
          const pb = Number(b.price ?? NaN);
          if (Number.isFinite(pa) && Number.isFinite(pb)) {
            return sortKey === 'price-asc' ? pa - pb : pb - pa;
          }
        }
        if (sortKey === 'newest') {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return db - da;
        }
        return 0;
      });

    return bySort;
  }, [products, searchText, sortKey]);

  const pageCount = Math.max(1, Math.ceil(displayedProducts.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchText, sortKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageItems = displayedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">Catalog</p>
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight text-white">Merch catalog</h1>
            <p className="text-base text-neutral-300 max-w-3xl">
              Browse products from featured artists and fresh OfficialMerch releases. Search by
              title, artist, or keywords to find the right item and open the detail page for full
              purchase information.
            </p>
          </div>
        </header>

        <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-900/50 p-4 shadow-lg shadow-black/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <label htmlFor="product-search" className="sr-only">
              Search catalog
            </label>
            <input
              id="product-search"
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search artists, merchandise, vibes..."
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
            />
            <div className="text-xs text-neutral-400 sm:hidden">
              Showing {displayedProducts.length} match{displayedProducts.length === 1 ? '' : 'es'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="product-sort" className="text-xs uppercase tracking-[0.3em] text-neutral-400">
              Sort by
            </label>
            <select
              id="product-sort"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as any)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
            >
              <option value="relevance">Curated relevance</option>
              <option value="price-asc">Price: low to high (detail pricing)</option>
              <option value="price-desc">Price: high to low (detail pricing)</option>
              <option value="newest">Newest products</option>
            </select>
          </div>
        </section>

        <section className="space-y-6">
          {isError && (
            <EmptyState
              title="Something went wrong"
              message={
                error
                  ? `Unable to load products (${error}).`
                  : 'Unable to load products at the moment.'
              }
              actionLabel="Retry"
              onAction={loadProducts}
            />
          )}

          {isLoading && (
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 shadow-lg shadow-black/40">
              <LoadingSkeleton count={4} className="gap-5 sm:grid-cols-2 lg:grid-cols-3" />
            </div>
          )}

          {!isLoading && !isError && (
            <>
              {displayedProducts.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  message="Try again in a moment."
                  actionLabel="Retry"
                  onAction={loadProducts}
                />
              ) : (
                <>
                  <ProductsGrid
                    products={pageItems}
                    emptyMessage="No products available yet."
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-neutral-400">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="rounded-full border border-white/20 px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={page === pageCount}
                      className="rounded-full border border-white/20 px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
