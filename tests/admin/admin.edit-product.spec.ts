import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { loginAdmin } from '../helpers/auth';
import { gotoApp } from '../helpers/navigation';

type ProductItem = {
  id: string;
  productId: string;
  title: string;
  description: string;
  artistId: string;
  isActive: boolean;
  listingPhotoUrls: string[];
};

const makeInitialProducts = (): ProductItem[] => [
  {
    id: 'product-1',
    productId: 'product-1',
    title: 'Original Product Name',
    description: 'Original product description with enough length.',
    artistId: 'artist-1',
    isActive: true,
    listingPhotoUrls: ['/uploads/products/original-thumb.png'],
  },
];

const mockArtists = [{ id: 'artist-1', name: 'Artist One' }];

const getFixturePhotos = () => {
  const fixturesDir = path.resolve(__dirname, '..', 'fixtures');
  return [
    path.join(fixturesDir, 'listing-photo-1.png'),
    path.join(fixturesDir, 'listing-photo-2.png'),
    path.join(fixturesDir, 'listing-photo-3.png'),
    path.join(fixturesDir, 'listing-photo-4.png'),
  ];
};

const setupAdminProductsMocks = async (
  page: Page,
  options?: {
    initialProducts?: ProductItem[];
    waitForLoadingStateBeforeDetailResponse?: boolean;
    failDetailForId?: string;
  }
) => {
  const buildCorsHeaders = (route: any) => {
    const requestHeaders = route.request().headers();
    const origin = requestHeaders?.origin || 'http://localhost:5173';
    const requestedHeaders =
      requestHeaders?.['access-control-request-headers'] ||
      'authorization,content-type,accept';
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,OPTIONS',
      'Access-Control-Allow-Headers': requestedHeaders,
      Vary: 'Origin',
    };
  };
  const fulfillJson = async (route: any, status: number, payload: unknown) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: buildCorsHeaders(route),
      body: JSON.stringify(payload),
    });
  };
  const fulfillPreflight = async (route: any) => {
    await route.fulfill({
      status: 204,
      headers: buildCorsHeaders(route),
      body: '',
    });
  };

  const state = {
    products: options?.initialProducts ? [...options.initialProducts] : makeInitialProducts(),
    patchCalls: 0,
    photoCalls: 0,
    lastPatchBody: null as any,
    lastPhotoUrls: [] as string[],
  };

  await page.route(/\/api\/artists(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    await fulfillJson(route, 200, { artists: mockArtists });
  });

  await page.route(/\/api\/products\/[^/]+(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'GET') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    const id = route.request().url().split('/api/products/')[1]?.split('?')[0];
    if (options?.waitForLoadingStateBeforeDetailResponse) {
      await page.getByText(/fetching matrix/i).waitFor({ state: 'visible', timeout: 5000 });
    }
    if (options?.failDetailForId && options.failDetailForId === id) {
      await fulfillJson(route, 500, { message: 'detail_failed' });
      return;
    }
    const row = state.products.find((item) => item.id === id || item.productId === id);
    await fulfillJson(route, row ? 200 : 404, row ? { product: row } : { error: 'not_found' });
  });

  await page.route(/\/api\/admin\/products\/.+/i, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (/\/photos(?:[/?#]|$)/i.test(url)) {
      if (method !== 'PUT') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      state.photoCalls += 1;
      const id = url.split('/api/admin/products/')[1]?.split('/photos')[0];
      const replacementUrls = [
        '/uploads/products/replacement-1.png',
        '/uploads/products/replacement-2.png',
        '/uploads/products/replacement-3.png',
        '/uploads/products/replacement-4.png',
      ];
      state.lastPhotoUrls = replacementUrls;
      state.products = state.products.map((item) =>
        item.id === id || item.productId === id
          ? {
              ...item,
              listingPhotoUrls: replacementUrls,
            }
          : item
      );
      await fulfillJson(route, 200, { listingPhotoUrls: replacementUrls });
      return;
    }
    if (method !== 'PATCH') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    state.patchCalls += 1;
    const id = url.split('/api/admin/products/')[1]?.split('?')[0];
    const body = route.request().postDataJSON() as any;
    state.lastPatchBody = body;
    state.products = state.products.map((item) =>
      item.id === id || item.productId === id
        ? {
            ...item,
            title: typeof body?.title === 'string' ? body.title : item.title,
            description:
              typeof body?.description === 'string'
                ? body.description
                : typeof body?.merch_story === 'string'
                  ? body.merch_story
                  : item.description,
            isActive:
              typeof body?.isActive === 'boolean' ? body.isActive : item.isActive,
          }
        : item
    );
    await fulfillJson(route, 200, { ok: true });
  });

  await page.route(/\/api\/admin\/products\/?(?:[?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'GET') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    await fulfillJson(route, 200, { items: state.products });
  });

  return state;
};

const openEditModal = async (page: Page) => {
  await loginAdmin(page, { returnTo: '/partner/admin/products' });
  await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admin-products-list')).toBeVisible({ timeout: 10000 });
  const firstRow = page.getByTestId('admin-product-row').first();
  await expect(firstRow).toBeVisible({ timeout: 10000 });
  await firstRow.getByTestId('admin-product-row-edit').click();
  await expect(page.getByTestId('admin-product-edit-modal')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible({ timeout: 10000 });
};

const openEditModalByTitle = async (page: Page, title: string) => {
  await loginAdmin(page, { returnTo: '/partner/admin/products' });
  await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
  const row = page.getByTestId('admin-product-row').filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByTestId('admin-product-row-edit').click();
  await expect(page.getByTestId('admin-product-edit-modal')).toBeVisible({ timeout: 10000 });
};

test.describe('Admin edit product modal', () => {
  test('removes legacy economics and color fields', async ({ page }) => {
    await setupAdminProductsMocks(page);
    await openEditModal(page);

    await expect(page.getByText(/vendor pay/i)).toHaveCount(0);
    await expect(page.getByText(/internal/i)).toHaveCount(0);
    await expect(page.getByText(/royalty/i)).toHaveCount(0);
    await expect(page.getByText(/color options/i)).toHaveCount(0);
  });

  test('commit button enables only on valid product-level changes', async ({ page }) => {
    await setupAdminProductsMocks(page);
    await openEditModal(page);

    const saveButton = page.getByTestId('admin-edit-product-save');
    const titleInput = page.getByTestId('admin-edit-product-merch-name');

    await expect(saveButton).toBeDisabled();
    await titleInput.fill('A');
    await expect(saveButton).toBeDisabled();
    await titleInput.fill('Updated Product Name');
    await expect(saveButton).toBeEnabled();
  });

  test('text-only save updates product and does not call photo endpoint', async ({ page }) => {
    const state = await setupAdminProductsMocks(page);
    await openEditModal(page);

    await page.getByTestId('admin-edit-product-merch-name').fill('Updated Text Save Product');
    await page.getByTestId('admin-edit-product-story').fill('Updated product story text that is definitely long enough.');
    await page.getByTestId('admin-edit-product-save').click();

    await expect.poll(() => state.patchCalls).toBe(1);
    await expect.poll(() => state.photoCalls).toBe(0);
    expect(state.lastPatchBody?.vendor_pay).toBeUndefined();
    expect(state.lastPatchBody?.our_share).toBeUndefined();
    expect(state.lastPatchBody?.royalty).toBeUndefined();
    expect(state.lastPatchBody?.colors).toBeUndefined();
    expect(state.lastPatchBody?.merch_type).toBeUndefined();

    await expect(page.getByTestId('admin-edit-product-save')).toHaveCount(0);
    await expect(page.getByTestId('admin-product-row').first()).toContainText('Updated Text Save Product');
  });

  test('image-only save updates row thumbnail and does not call product patch', async ({ page }) => {
    const state = await setupAdminProductsMocks(page);
    await openEditModal(page);

    const saveButton = page.getByTestId('admin-edit-product-save');
    await expect(saveButton).toBeDisabled();
    await page.getByTestId('admin-edit-product-photo-input').setInputFiles(getFixturePhotos());
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect.poll(() => state.photoCalls).toBe(1);
    await expect.poll(() => state.patchCalls).toBe(0);
    await expect(page.getByTestId('admin-edit-product-save')).toHaveCount(0);
    await expect(page.getByTestId('admin-product-row-thumbnail').first()).toHaveAttribute(
      'src',
      /replacement-1\.png/
    );
  });

  test('shows readable validation error for invalid image type', async ({ page }) => {
    await setupAdminProductsMocks(page);
    await openEditModal(page);

    await page.getByTestId('admin-edit-product-photo-input').setInputFiles({
      name: 'invalid-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not-an-image'),
    });

    await expect(page.getByText(/only png, jpg, and webp images are allowed/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('admin-edit-product-save')).toBeDisabled();
  });

  test('mixed text + image save calls both endpoints and refreshes row state', async ({ page }) => {
    const state = await setupAdminProductsMocks(page);
    await openEditModal(page);

    await page.getByTestId('admin-edit-product-merch-name').fill('Mixed Save Product');
    await page.getByTestId('admin-edit-product-story').fill('Mixed update story text with enough length for validation.');
    await page.getByTestId('admin-edit-product-photo-input').setInputFiles(getFixturePhotos());
    await page.getByTestId('admin-edit-product-save').click();

    await expect.poll(() => state.patchCalls).toBe(1);
    await expect.poll(() => state.photoCalls).toBe(1);
    await expect(page.getByTestId('admin-edit-product-save')).toHaveCount(0);
    await expect(page.getByTestId('admin-product-row').first()).toContainText('Mixed Save Product');
    await expect(page.getByTestId('admin-product-row-thumbnail').first()).toHaveAttribute(
      'src',
      /replacement-1\.png/
    );
  });

  test('binds selected row state into modal, clears on close, and reopens for the newly selected product', async ({ page }) => {
    await setupAdminProductsMocks(page, {
      initialProducts: [
        {
          id: 'product-1',
          productId: 'product-1',
          title: 'Original Product Name',
          description: 'Original product description with enough length.',
          artistId: 'artist-1',
          isActive: true,
          listingPhotoUrls: ['/uploads/products/original-thumb.png'],
        },
        {
          id: 'product-2',
          productId: 'product-2',
          title: 'Second Product Title',
          description: 'Second product description with enough length.',
          artistId: 'artist-1',
          isActive: true,
          listingPhotoUrls: ['/uploads/products/second-thumb.png'],
        },
      ],
    });
    await openEditModalByTitle(page, 'Second Product Title');

    await expect(page.getByTestId('admin-edit-product-merch-name')).toHaveValue('Second Product Title');
    await expect(page.getByTestId('admin-edit-product-story')).toHaveValue(
      'Second product description with enough length.'
    );
    await expect(page.getByTestId('admin-product-edit-modal')).toHaveAttribute(
      'data-product-id',
      'product-2'
    );
    await expect(page.getByTestId('admin-edit-product-initial-title')).toHaveText(
      'Second Product Title'
    );

    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByTestId('admin-product-edit-modal')).toHaveCount(0);

    await openEditModalByTitle(page, 'Original Product Name');
    await expect(page.getByTestId('admin-product-edit-modal')).toHaveAttribute(
      'data-product-id',
      'product-1'
    );
    await expect(page.getByTestId('admin-edit-product-merch-name')).toHaveValue(
      'Original Product Name'
    );
  });

  test('shows loading then error state when product detail hydration fails', async ({ page }) => {
    await setupAdminProductsMocks(page, {
      waitForLoadingStateBeforeDetailResponse: true,
      failDetailForId: 'product-1',
    });
    await openEditModal(page);

    await expect(page.getByText(/fetching matrix/i)).toBeVisible();
    await expect(page.getByText(/detail_failed|failed to load full product details/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
