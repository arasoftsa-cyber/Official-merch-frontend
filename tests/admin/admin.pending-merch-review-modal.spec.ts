import { test, expect, type Page } from '@playwright/test';
import { gotoApp, loginAdmin } from '../helpers/auth';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmk8AAAAASUVORK5CYII=';

type PendingItem = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'rejected';
  artistId: string;
  artistName?: string;
  designImageUrl?: string;
  skuTypes?: string[];
  rejectionReason?: string | null;
};

const mockArtists = [{ id: 'artist-1', name: 'Artist One' }];

const makePendingItems = (): PendingItem[] => [
  {
    id: 'pending-1',
    title: 'Pending Merch One',
    description: 'Pending merch one description',
    status: 'pending',
    artistId: 'artist-1',
    artistName: 'Artist One',
    designImageUrl: '/uploads/pending-one.png',
    skuTypes: ['regular_tshirt'],
  },
  {
    id: 'pending-2',
    title: 'Pending Merch Two',
    description: 'Pending merch two description',
    status: 'pending',
    artistId: 'artist-1',
    artistName: 'Artist One',
    designImageUrl: '/uploads/pending-two.png',
    skuTypes: ['hoodie'],
  },
];

const createPngBuffer = () => Buffer.from(TINY_PNG_BASE64, 'base64');

const setupPendingReviewMocks = async (
  page: Page,
  options?: { detailDelayMs?: number; failDetailForId?: string }
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
    pendingItems: makePendingItems(),
    approveCalls: [] as string[],
  };

  await page.route(/\/api\/artists(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    await fulfillJson(route, 200, { artists: mockArtists });
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
    await fulfillJson(route, 200, { items: [] });
  });

  await page.route(/\/api\/admin\/products\/onboarding\?status=pending(?:[&#].*)?$/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'GET') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    await fulfillJson(route, 200, {
      items: state.pendingItems.filter((item) => item.status === 'pending'),
    });
  });

  await page.route(/\/api\/admin\/products\/onboarding\?status=rejected(?:[&#].*)?$/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'GET') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    await fulfillJson(route, 200, {
      items: state.pendingItems.filter((item) => item.status === 'rejected'),
    });
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

    const id = route.request().url().split('/api/products/')[1]?.split('?')[0] || '';
    if (options?.detailDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.detailDelayMs));
    }
    if (options?.failDetailForId && id === options.failDetailForId) {
      await fulfillJson(route, 500, { message: 'detail_failed' });
      return;
    }

    const row = state.pendingItems.find((item) => item.id === id);
    await fulfillJson(
      route,
      row ? 200 : 404,
      row
        ? {
            product: {
              ...row,
              merch_story: row.description,
            },
          }
        : { error: 'not_found' }
    );
  });

  await page.route(/\/api\/admin\/products\/[^/]+\/onboarding\/approve(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'POST') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    const url = route.request().url();
    const productId = url.split('/api/admin/products/')[1]?.split('/onboarding/approve')[0] || '';
    state.approveCalls.push(productId);
    state.pendingItems = state.pendingItems.map((item) =>
      item.id === productId ? { ...item, status: 'rejected' } : item
    );
    await fulfillJson(route, 200, { ok: true });
  });

  await page.route(/\/api\/admin\/products\/[^/]+\/onboarding\/reject(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'POST') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    await fulfillJson(route, 200, { ok: true });
  });

  return state;
};

const openPendingTab = async (page: Page) => {
  await page.getByTestId('admin-pending-merch-tab').click();
  await expect(page.getByTestId('admin-pending-merch-row').first()).toBeVisible({ timeout: 10000 });
};

test.describe('Admin pending merch review modal', () => {
  test('opens selected request details and closes cleanly', async ({ page }) => {
    await setupPendingReviewMocks(page);
    await loginAdmin(page, { returnTo: '/partner/admin/products' });
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await openPendingTab(page);

    const row = page.getByTestId('admin-pending-merch-row').filter({ hasText: 'Pending Merch Two' }).first();
    await expect(row).toBeVisible();
    await row.getByTestId('admin-pending-merch-open').click();

    await expect(page.getByTestId('admin-pending-merch-name')).toContainText('Pending Merch Two');
    await expect(page.getByTestId('admin-pending-merch-story')).toContainText('Pending merch two description');
    await expect(page.getByTestId('admin-pending-merch-artist')).toContainText('Artist One');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('admin-pending-merch-name')).toHaveCount(0);
  });

  test('invokes approve workflow with selected files and closes modal', async ({ page }) => {
    const state = await setupPendingReviewMocks(page);
    await loginAdmin(page, { returnTo: '/partner/admin/products' });
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await openPendingTab(page);

    const row = page.getByTestId('admin-pending-merch-row').filter({ hasText: 'Pending Merch One' }).first();
    await row.getByTestId('admin-pending-merch-open').click();

    await expect(page.getByTestId('admin-approve-merch')).toBeDisabled();
    await expect(page.getByTestId('admin-approve-disabled-reason')).toContainText(/at least 4/i);

    const png = createPngBuffer();
    await page.getByTestId('admin-marketplace-images-input').setInputFiles([
      { name: 'marketplace-1.png', mimeType: 'image/png', buffer: png },
      { name: 'marketplace-2.png', mimeType: 'image/png', buffer: png },
      { name: 'marketplace-3.png', mimeType: 'image/png', buffer: png },
      { name: 'marketplace-4.png', mimeType: 'image/png', buffer: png },
    ]);
    await expect(page.getByTestId('admin-approve-merch')).toBeEnabled({ timeout: 10000 });

    await page.getByTestId('admin-approve-merch').click();

    await expect.poll(() => state.approveCalls.length).toBe(1);
    expect(state.approveCalls[0]).toBe('pending-1');
    await expect(page.getByTestId('admin-pending-merch-name')).toHaveCount(0);
  });

  test('shows loading state then modal error when detail request fails', async ({ page }) => {
    await setupPendingReviewMocks(page, { detailDelayMs: 600, failDetailForId: 'pending-1' });
    await loginAdmin(page, { returnTo: '/partner/admin/products' });
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await openPendingTab(page);

    const row = page.getByTestId('admin-pending-merch-row').filter({ hasText: 'Pending Merch One' }).first();
    await row.getByTestId('admin-pending-merch-open').click();

    await expect(page.getByText(/loading request details/i).first()).toBeVisible();
    await expect(page.getByText(/detail_failed|failed to load pending merchandise details/i)).toBeVisible({
      timeout: 10000,
    });
  });
});
