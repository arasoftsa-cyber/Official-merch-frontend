import { test, expect, type Page } from '@playwright/test';
import { loginAdmin } from '../helpers/auth';
import { gotoApp } from '../helpers/navigation';

type PendingRequestItem = {
  id: string;
  productId: string;
  title: string;
  description: string;
  artistId: string;
  artistName?: string;
  status: 'pending' | 'rejected';
  rejectionReason?: string | null;
  designImageUrl?: string;
  skuTypes?: string[];
  createdAt?: string;
};

const mockArtists = [{ id: 'artist-1', name: 'Artist One' }];

const makePendingRequests = (): PendingRequestItem[] => [
  {
    id: 'pending-1',
    productId: 'pending-1',
    title: 'First Pending Request',
    description: 'First pending request story with enough detail.',
    artistId: 'artist-1',
    status: 'pending',
    designImageUrl: '/uploads/designs/pending-1.png',
    skuTypes: ['hoodie'],
    createdAt: '2026-03-10T10:00:00.000Z',
  },
  {
    id: 'pending-2',
    productId: 'pending-2',
    title: 'Second Pending Request',
    description: 'Second pending request story with enough detail.',
    artistId: 'artist-1',
    artistName: 'Artist One',
    status: 'rejected',
    rejectionReason: 'Needs a higher resolution design.',
    designImageUrl: '/uploads/designs/pending-2.png',
    skuTypes: ['oversized_tshirt'],
    createdAt: '2026-03-11T12:00:00.000Z',
  },
];

const buildCorsHeaders = (route: any) => {
  const requestHeaders = route.request().headers();
  const origin = requestHeaders?.origin || 'http://localhost:5173';
  const requestedHeaders =
    requestHeaders?.['access-control-request-headers'] || 'authorization,content-type,accept';
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

const setupPendingMerchMocks = async (
  page: Page,
  options?: {
    waitForLoadingStateBeforeDetailResponse?: boolean;
    failDetailForId?: string;
    approveErrorForId?: string;
    rejectErrorForId?: string;
    pendingRequests?: PendingRequestItem[];
  }
) => {
  const state = {
    pendingRequests: options?.pendingRequests ? [...options.pendingRequests] : makePendingRequests(),
    approveCalls: [] as Array<{ productId: string; fileNames: string[] }>,
    rejectCalls: [] as Array<{ productId: string; rejectionReason: string | null }>,
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
    await fulfillJson(
      route,
      method === 'GET' ? 200 : 405,
      method === 'GET' ? { items: [] } : { error: 'method_not_allowed' }
    );
  });

  await page.route(/\/api\/admin\/products\/onboarding\?status=(pending|rejected)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    const status = route.request().url().includes('status=rejected') ? 'rejected' : 'pending';
    await fulfillJson(route, 200, {
      items: state.pendingRequests.filter((request) => request.status === status),
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
    const productId = route.request().url().split('/api/products/')[1]?.split('?')[0];
    if (options?.waitForLoadingStateBeforeDetailResponse) {
      await page
        .getByTestId('admin-pending-merch-review-modal')
        .locator('.animate-spin')
        .first()
        .waitFor({ state: 'visible', timeout: 5000 });
    }
    if (options?.failDetailForId === productId) {
      await fulfillJson(route, 500, { message: 'detail_failed' });
      return;
    }
    const request = state.pendingRequests.find((item) => item.id === productId || item.productId === productId);
    await fulfillJson(route, request ? 200 : 404, request ? { product: request } : { error: 'not_found' });
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
    const productId = route.request().url().split('/api/admin/products/')[1]?.split('/onboarding/approve')[0];
    if (options?.approveErrorForId === productId) {
      await fulfillJson(route, 422, { message: 'validation', details: [{ message: 'at least 4' }] });
      return;
    }
    const postDataBuffer = route.request().postDataBuffer() || Buffer.from('');
    const bodyText = postDataBuffer.toString('utf8');
    const fileNames = Array.from(bodyText.matchAll(/filename=\"([^\"]+)\"/g)).map((match) => match[1]);
    state.approveCalls.push({ productId, fileNames });
    state.pendingRequests = state.pendingRequests.filter((item) => item.id !== productId);
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
    const productId = route.request().url().split('/api/admin/products/')[1]?.split('/onboarding/reject')[0];
    if (options?.rejectErrorForId === productId) {
      await fulfillJson(route, 500, { message: 'internal_server_error' });
      return;
    }
    const body = route.request().postDataJSON() as { rejection_reason?: string | null };
    state.rejectCalls.push({
      productId,
      rejectionReason: typeof body?.rejection_reason === 'string' ? body.rejection_reason : null,
    });
    state.pendingRequests = state.pendingRequests.map((item) =>
      item.id === productId
        ? {
            ...item,
            status: 'rejected',
            rejectionReason: body?.rejection_reason || null,
          }
        : item
    );
    await fulfillJson(route, 200, { ok: true });
  });

  return state;
};

const openPendingMerchModal = async (page: Page, title: string) => {
  await loginAdmin(page, { returnTo: '/partner/admin/products' });
  await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('admin-pending-merch-tab').click();
  const row = page.getByTestId('admin-pending-merch-row').filter({ hasText: title }).first();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByTestId('admin-pending-merch-open').click();
  const modal = page.getByTestId('admin-pending-merch-review-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });
  return modal;
};

const uploadMarketplaceFiles = async (
  modal: ReturnType<Page['getByTestId']>,
  count = 4
) => {
  const files = Array.from({ length: count }, (_, index) => ({
    name: `marketplace-${index + 1}.png`,
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmk8AAAAASUVORK5CYII=',
      'base64'
    ),
  }));
  await modal.getByTestId('admin-marketplace-images-input').setInputFiles(files);
};

test.describe('Admin pending merch review modal', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('opens from the selected row and closes cleanly', async ({ page }) => {
    await setupPendingMerchMocks(page);
    const modal = await openPendingMerchModal(page, 'First Pending Request');

    await expect(modal).toHaveAttribute('data-product-id', 'pending-1');
    await expect(modal.getByTestId('admin-pending-merch-name')).toContainText('First Pending Request');
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('admin-pending-merch-review-modal')).toHaveCount(0);
  });

  test('propagates the selected review entity and resets when reopened for another request', async ({ page }) => {
    await setupPendingMerchMocks(page);
    let modal = await openPendingMerchModal(page, 'Second Pending Request');

    await expect(modal).toHaveAttribute('data-product-id', 'pending-2');
    await expect(modal.getByTestId('admin-pending-merch-name')).toContainText('Second Pending Request');
    await expect(modal.getByTestId('admin-pending-merch-artist')).toContainText('Artist One');
    await expect(modal.getByTestId('admin-pending-merch-rejection-reason')).toContainText(
      'Needs a higher resolution design.'
    );

    await modal.getByRole('button', { name: 'Close' }).click();
    modal = await openPendingMerchModal(page, 'First Pending Request');

    await expect(modal).toHaveAttribute('data-product-id', 'pending-1');
    await expect(modal.getByTestId('admin-rejection-reason')).toHaveValue('');
  });

  test('invokes approve action with the selected request and marketplace images', async ({ page }) => {
    const state = await setupPendingMerchMocks(page);
    const modal = await openPendingMerchModal(page, 'First Pending Request');

    await uploadMarketplaceFiles(modal);
    await modal.getByTestId('admin-approve-merch').click();

    await expect.poll(() => state.approveCalls.length).toBe(1);
    expect(state.approveCalls[0]).toEqual({
      productId: 'pending-1',
      fileNames: ['marketplace-1.png', 'marketplace-2.png', 'marketplace-3.png', 'marketplace-4.png'],
    });
    await expect(page.getByTestId('admin-pending-merch-review-modal')).toHaveCount(0);
  });

  test('shows loading state while hydrating the selected request', async ({ page }) => {
    await setupPendingMerchMocks(page, { waitForLoadingStateBeforeDetailResponse: true });
    const modal = await openPendingMerchModal(page, 'First Pending Request');

    await expect(modal.locator('.animate-spin')).toBeVisible();
    await expect(modal.getByTestId('admin-pending-merch-name')).toContainText(
      'First Pending Request',
      { timeout: 10000 }
    );
  });

  test('surfaces approval errors and keeps the modal open', async ({ page }) => {
    const state = await setupPendingMerchMocks(page, { approveErrorForId: 'pending-1' });
    const modal = await openPendingMerchModal(page, 'First Pending Request');

    await uploadMarketplaceFiles(modal);
    await modal.getByTestId('admin-approve-merch').click();

    await expect(
      modal.getByText(/upload at least 4 marketplace images before approval/i)
    ).toBeVisible({ timeout: 10000 });
    expect(state.approveCalls).toHaveLength(0);
    await expect(modal).toHaveAttribute('data-product-id', 'pending-1');
  });
});
