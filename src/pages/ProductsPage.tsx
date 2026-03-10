import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../shared/api/fetchJson';
import { trackPageView } from '../shared/lib/telemetry';
import PublicCatalogCard from '../features/catalog/components/PublicCatalogCard';
import PublicCatalogEmptyState from '../features/catalog/components/PublicCatalogEmptyState';
import PublicCatalogGrid from '../features/catalog/components/PublicCatalogGrid';
import PublicCatalogGridSkeleton from '../features/catalog/components/PublicCatalogGridSkeleton';
import PublicCatalogHeader from '../features/catalog/components/PublicCatalogHeader';
import PublicCatalogPagination from '../features/catalog/components/PublicCatalogPagination';
import PublicCatalogToolbar, {
  PublicCatalogSortOption,
} from '../features/catalog/components/PublicCatalogToolbar';

type ProductDTO = {
  id: string;
  title: string;
  artist?: string;
  description?: string;
  createdAt?: string;
  price?: number;
  card_image_url?: string;
  cover_photo_url?: string;
  listing_photos?: string[];
};

type RowStatus = 'idle' | 'loading' | 'success' | 'error';
type ProductSortKey = 'relevance' | 'price-asc' | 'price-desc' | 'newest';

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
  const listingPhotosRaw =
    source?.listing_photos ??
    source?.listingPhotos ??
    source?.photo_urls ??
    source?.photoUrls;
  const listing_photos = Array.isArray(listingPhotosRaw)
    ? listingPhotosRaw.map((value: any) => String(value ?? '').trim()).filter(Boolean)
    : undefined;
  const cover_photo_url =
    (typeof source?.cover_photo_url === 'string' ? source.cover_photo_url : '') ||
    (typeof source?.coverPhotoUrl === 'string' ? source.coverPhotoUrl : '') ||
    (listing_photos?.[0] ?? '');
  return {
    id: String(id),
    title,
    artist,
    description,
    createdAt,
    price,
    card_image_url: cover_photo_url || undefined,
    cover_photo_url: cover_photo_url || undefined,
    listing_photos,
  };
};

const chooseArray = (payload: any) =>
  payload?.items ?? payload?.products ?? payload?.data ?? payload?.results ?? [];

const PAGE_SIZE = 12;
const PRODUCT_SORT_OPTIONS: PublicCatalogSortOption[] = [
  { value: 'relevance', label: 'Curated relevance' },
  { value: 'price-asc', label: 'Price: low to high (detail pricing)' },
  { value: 'price-desc', label: 'Price: high to low (detail pricing)' },
  { value: 'newest', label: 'Newest products' },
];

export default function ProductsPage() {
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<ProductSortKey>('relevance');
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
        .filter((item: any): item is ProductDTO => Boolean(item));
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

  const getProductImage = (product: ProductDTO): string | undefined => {
    const firstListingPhoto = Array.isArray(product.listing_photos)
      ? product.listing_photos.find((value) => Boolean(String(value).trim()))
      : undefined;
    return (
      (typeof product.card_image_url === 'string' && product.card_image_url.trim()) ||
      (typeof product.cover_photo_url === 'string' && product.cover_photo_url.trim()) ||
      (typeof firstListingPhoto === 'string' && firstListingPhoto.trim()) ||
      undefined
    );
  };

  return (
    <section className="space-y-8 py-4 text-slate-900 dark:text-slate-100">
      <PublicCatalogHeader
        eyebrow="Catalog"
        title="Merch catalog"
        description="Browse products from featured artists and fresh OfficialMerch releases. Search by title, artist, or keywords to find the right item."
      />

      <PublicCatalogToolbar
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search artists, merchandise, vibes..."
        resultCount={displayedProducts.length}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as ProductSortKey)}
        sortOptions={PRODUCT_SORT_OPTIONS}
      />

      <section className="space-y-6">
        {isError ? (
          <PublicCatalogEmptyState
            title="Something went wrong"
            message={
              error
                ? `Unable to load products (${error}).`
                : 'Unable to load products at the moment.'
            }
            actionLabel="Retry"
            onAction={loadProducts}
          />
        ) : null}

        {isLoading ? <PublicCatalogGridSkeleton count={8} /> : null}

        {!isLoading && !isError ? (
          <>
            {products.length === 0 ? (
              <PublicCatalogEmptyState
                title="No products yet"
                message="Try again in a moment."
                actionLabel="Retry"
                onAction={loadProducts}
              />
            ) : displayedProducts.length === 0 ? (
              <PublicCatalogEmptyState
                title="No product matches"
                message="Try a broader search term."
              />
            ) : (
              <>
                <PublicCatalogGrid>
                  {pageItems.map((product) => (
                    <PublicCatalogCard
                      key={product.id}
                      kind="product"
                      title={product.title}
                      subtitle={product.artist || 'OfficialMerch'}
                      description={product.description}
                      imageUrl={getProductImage(product)}
                      href={`/products/${product.id}`}
                      ctaLabel="View Product"
                      testId="product-catalog-card"
                    />
                  ))}
                </PublicCatalogGrid>
                <PublicCatalogPagination page={page} pageCount={pageCount} onPageChange={setPage} />
              </>
            )}
          </>
        ) : null}
      </section>
    </section>
  );
}
