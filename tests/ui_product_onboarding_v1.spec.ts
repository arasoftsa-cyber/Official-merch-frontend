import { test, expect, type Page } from '@playwright/test';
import { gotoApp, loginAdmin, loginArtist, loginBuyer } from './helpers/auth';
import { getApiUrl } from './helpers/urls';
import {
  DESIGN_IMAGE_PATH,
  createPendingMerchRequestViaArtistApi,
  ensureOnboardingFixtures,
  ensureOnboardingSmokeSeed,
  uploadMarketplaceImages,
} from './helpers/onboarding';

const readResponseSnippet = async (response: any) =>
  (await response.text().catch(() => '<unavailable>')).replace(/\s+/g, ' ').trim().slice(0, 600);

const makeStamp = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const extractProductId = (payload: any): string => {
  const candidate =
    payload?.productId ||
    payload?.product_id ||
    payload?.id ||
    payload?.product?.id ||
    '';
  return typeof candidate === 'string' ? candidate.trim() : '';
};

const fetchArtists = async (page: Page): Promise<any[]> => {
  const response = await page.request.get(getApiUrl('/api/artists'), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok()) {
    const body = await readResponseSnippet(response);
    throw new Error(`Failed to load artists (${response.status()}): ${body}`);
  }
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.artists) ? payload.artists : Array.isArray(payload) ? payload : [];
};

const ensureArtistIdentityForAdmin = async (page: Page) => {
  let artists = await fetchArtists(page);
  if (artists.length === 0) {
    const seedResponse = await page.request.post(getApiUrl('/api/dev/seed-ui-smoke-product'), {
      headers: { Accept: 'application/json' },
    });
    if (!seedResponse.ok()) {
      const body = await readResponseSnippet(seedResponse);
      throw new Error(`Unable to seed artist/product (${seedResponse.status()}): ${body}`);
    }
    artists = await fetchArtists(page);
  }
  const firstArtist = artists[0];
  const artistId = String(firstArtist?.id || '').trim();
  const artistHandle = String(firstArtist?.handle || '').trim();
  if (!artistId || !artistHandle) {
    throw new Error(`Invalid artist payload for seeding: ${JSON.stringify(firstArtist ?? null)}`);
  }
  return { artistId, artistHandle };
};

const createAdminProductWithStatus = async (
  page: Page,
  {
    artistId,
    title,
    status,
  }: {
    artistId: string;
    title: string;
    status: 'pending' | 'inactive' | 'active' | 'rejected';
  }
) => {
  const response = await page.request.post(getApiUrl('/api/admin/products'), {
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    data: {
      artistId,
      title,
      description: `Playwright onboarding visibility ${title}`,
      status,
      priceCents: 1999,
      stock: 10,
      size: 'M',
      color: 'Black',
      sku: `PW-ONB-${status}-${Date.now()}`,
    },
  });
  if (!response.ok()) {
    const body = await readResponseSnippet(response);
    throw new Error(`Create product ${title} failed (${response.status()}): ${body}`);
  }
  const payload = await response.json().catch(() => null);
  const productId = extractProductId(payload);
  if (!productId) {
    throw new Error(`Create product ${title} returned no productId: ${JSON.stringify(payload ?? null)}`);
  }
  return { productId };
};

const gotoArtistProducts = async (page: Page) => {
  await gotoApp(page, '/partner/artist/products', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /artist products/i })).toBeVisible({
    timeout: 20000,
  });
};

const artistRowByTitle = (page: Page, title: string) =>
  page.getByTestId('artist-product-row').filter({ hasText: title }).first();

const openPendingMerchModalByTitle = async (page: Page, title: string) => {
  await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
  const rowByTitle = () => page.getByTestId('admin-pending-merch-row').filter({ hasText: title }).first();

  const pendingTabByTestId = page.getByTestId('admin-pending-merch-tab').first();
  const pendingTabByRole = page.getByRole('button', { name: /pending merch/i }).first();

  const openPendingQueueIfNeeded = async () => {
    if ((await rowByTitle().count().catch(() => 0)) > 0) {
      return true;
    }

    const tab =
      (await pendingTabByTestId.count().catch(() => 0)) > 0 ? pendingTabByTestId : pendingTabByRole;

    if ((await tab.count().catch(() => 0)) === 0) {
      return false;
    }
    if (!(await tab.isVisible().catch(() => false))) {
      return false;
    }

    const tabAriaSelected = (await tab.getAttribute('aria-selected').catch(() => null)) || '';
    if (tabAriaSelected !== 'true') {
      await tab.click().catch(() => null);
    }

    return (await rowByTitle().count().catch(() => 0)) > 0;
  };

  await expect
    .poll(async () => openPendingQueueIfNeeded(), {
      timeout: 30000,
      message: `Unable to find pending merch row in admin queue for title: ${title}`,
    })
    .toBe(true);

  const row = rowByTitle();
  await expect(row).toBeVisible({ timeout: 10000 });
  await row.getByTestId('admin-pending-merch-open').click();
  await expect(page.getByTestId('admin-pending-merch-name')).toBeVisible({ timeout: 10000 });
};

test.describe.serial('Product Onboarding v1', () => {
  test.beforeAll(async () => {
    ensureOnboardingFixtures();
    await ensureOnboardingSmokeSeed();
  });

  test('artist sees New Merchandise button and non-artist views do not', async ({ page }) => {
    await loginArtist(page);
    await gotoArtistProducts(page);
    await expect(page.getByTestId('artist-new-merch-button')).toBeVisible({ timeout: 10000 });

    await loginAdmin(page);
    await gotoArtistProducts(page);
    await expect(page.getByTestId('artist-new-merch-button')).toHaveCount(0);

    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('artist-new-merch-button')).toHaveCount(0);
  });

  test('artist form validation blocks invalid submission with inline errors', async ({ page }) => {
    await loginArtist(page);
    await gotoArtistProducts(page);
    await page.getByTestId('artist-new-merch-button').click();
    await expect(page.getByTestId('artist-new-merch-form')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/merch name is required/i)).toBeVisible();
    await expect(page.getByText(/merch story is required/i)).toBeVisible();
    await expect(page.getByText(/design image is required/i)).toBeVisible();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();

    await page.getByTestId('artist-merch-name').fill(makeStamp('validation-merch'));
    await page.getByTestId('artist-merch-story').fill('Validation story with enough detail.');
    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/design image is required/i)).toBeVisible();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();

    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);
    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();
  });

  test('artist can submit valid merch request and sees Pending status', async ({ page }) => {
    const merchName = makeStamp('pw-onb-success');
    const merchStory = `Story for ${merchName} with enough descriptive detail for validation.`;

    await loginArtist(page);
    await gotoArtistProducts(page);
    await page.getByTestId('artist-new-merch-button').click();
    await page.getByTestId('artist-merch-name').fill(merchName);
    await page.getByTestId('artist-merch-story').fill(merchStory);
    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);
    await page.getByTestId('artist-sku-regular-tshirt').check();
    await page.getByTestId('artist-sku-hoodie').check();
    await page.getByTestId('artist-request-merch-submit').click();

    await expect(page.getByTestId('artist-merch-submit-success')).toBeVisible({ timeout: 20000 });
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i, {
      timeout: 20000,
    });
  });

  test('admin review queue shows pending details and approval image gating', async ({ page }) => {
    const merchName = makeStamp('pw-onb-review');
    const merchStory = `Admin review story for ${merchName} with enough detail.`;

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory,
      skuTypes: ['regular_tshirt', 'oversized_tshirt'],
    });

    await loginAdmin(page);
    await openPendingMerchModalByTitle(page, merchName);

    await expect(page.getByTestId('admin-pending-merch-name')).toContainText(merchName);
    await expect(page.getByTestId('admin-pending-merch-story')).toContainText(merchStory);
    await expect(page.getByTestId('admin-pending-merch-design-preview')).toBeVisible();
    await expect(page.getByTestId('admin-pending-merch-skus')).toContainText(/regular t-shirt/i);
    await expect(page.getByTestId('admin-pending-merch-skus')).toContainText(/oversized t-shirt/i);
    await expect(page.getByTestId('admin-pending-merch-artist')).not.toContainText(/^unknown artist$/i);

    await uploadMarketplaceImages(page, 3);
    await expect(page.getByTestId('admin-approve-merch')).toBeDisabled();
    await expect(page.getByTestId('admin-approve-disabled-reason')).toContainText(/at least 4/i);

    await uploadMarketplaceImages(page, 4);
    await expect(page.getByTestId('admin-marketplace-upload-list')).toBeVisible();
    await expect(page.getByTestId('admin-approve-merch')).toBeEnabled({ timeout: 10000 });
  });

  test('admin rejection persists reason visible to artist', async ({ page }) => {
    const merchName = makeStamp('pw-onb-reject');
    const rejectionReason = `Rejected by smoke ${Date.now()} - missing fit for launch.`;

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Rejection path story for ${merchName}.`,
      skuTypes: ['hoodie'],
    });

    await loginAdmin(page);
    await openPendingMerchModalByTitle(page, merchName);
    await page.getByTestId('admin-rejection-reason').fill(rejectionReason);

    const rejectResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/admin\/products\/[^/]+\/onboarding\/reject(?:[/?#]|$)/i.test(response.url()),
      { timeout: 20000 }
    );
    await page.getByTestId('admin-reject-merch').click();
    const rejectResponse = await rejectResponsePromise;
    if (!rejectResponse.ok()) {
      const body = await readResponseSnippet(rejectResponse);
      throw new Error(`Reject onboarding failed (${rejectResponse.status()}): ${body}`);
    }

    await loginArtist(page);
    await gotoArtistProducts(page);
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/rejected/i);
    await expect(row.getByTestId('artist-merch-rejection-reason')).toContainText(rejectionReason);
  });

  test('admin approval sets Inactive and artist can toggle active/inactive', async ({ page }) => {
    const merchName = makeStamp('pw-onb-approve');

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Approval path story for ${merchName}.`,
      skuTypes: ['regular_tshirt', 'hoodie'],
    });

    await loginAdmin(page);
    await openPendingMerchModalByTitle(page, merchName);
    await uploadMarketplaceImages(page, 4);
    await expect(page.getByTestId('admin-approve-merch')).toBeEnabled();

    const approveResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/admin\/products\/[^/]+\/onboarding\/approve(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('admin-approve-merch').click();
    const approveResponse = await approveResponsePromise;
    if (!approveResponse.ok()) {
      const body = await readResponseSnippet(approveResponse);
      throw new Error(`Approve onboarding failed (${approveResponse.status()}): ${body}`);
    }

    await loginArtist(page);
    await gotoArtistProducts(page);
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/inactive/i, {
      timeout: 20000,
    });

    const toggle = row.getByTestId('artist-merch-status-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(row.getByTestId('artist-product-status')).toContainText(/active/i, {
      timeout: 20000,
    });

    await toggle.click();
    await expect(row.getByTestId('artist-product-status')).toContainText(/inactive/i, {
      timeout: 20000,
    });
  });

  test('fan sees only active products across listing/search/storefront/detail', async ({ page }) => {
    const stamp = makeStamp('pw-onb-fan');

    await loginAdmin(page);
    const { artistId, artistHandle } = await ensureArtistIdentityForAdmin(page);

    const activeTitle = `${stamp}-active`;
    const pendingTitle = `${stamp}-pending`;
    const inactiveTitle = `${stamp}-inactive`;
    const rejectedTitle = `${stamp}-rejected`;

    const { productId: activeProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: activeTitle,
      status: 'active',
    });
    const { productId: pendingProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: pendingTitle,
      status: 'pending',
    });
    const { productId: inactiveProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: inactiveTitle,
      status: 'inactive',
    });
    const { productId: rejectedProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: rejectedTitle,
      status: 'rejected',
    });

    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/search artists, merchandise, vibes/i).fill(stamp);
    await expect(page.getByText(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(pendingTitle)).toHaveCount(0);
    await expect(page.getByText(inactiveTitle)).toHaveCount(0);
    await expect(page.getByText(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/artists/${artistHandle}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(pendingTitle)).toHaveCount(0);
    await expect(page.getByText(inactiveTitle)).toHaveCount(0);
    await expect(page.getByText(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/products/${activeProductId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('product-title')).toContainText(activeTitle, { timeout: 15000 });

    for (const blockedId of [pendingProductId, inactiveProductId, rejectedProductId]) {
      await gotoApp(page, `/products/${blockedId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('artist sees submitted merch fields as read-only after submission/approval', async ({ page }) => {
    const merchName = makeStamp('pw-onb-readonly');

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Read-only enforcement story for ${merchName}.`,
      skuTypes: ['oversized_hoodie'],
    });

    await gotoArtistProducts(page);
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i);
    await expect(row.getByTestId('artist-merch-readonly-name')).toContainText(merchName);
    await expect(row.getByTestId('artist-merch-readonly-story')).toBeVisible();
    await expect(row.getByTestId('artist-merch-readonly-design-image')).toContainText(/uploaded/i);
    await expect(row.getByTestId('artist-merch-readonly-skus')).toContainText(/oversized hoodie/i);
    await expect(row.getByTestId('artist-merch-status-toggle')).toHaveCount(0);
    await expect(row.locator('input, textarea, select')).toHaveCount(0);
  });
});
