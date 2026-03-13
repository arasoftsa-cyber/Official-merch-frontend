import { expect, type Page } from '@playwright/test';
import { gotoApp } from './auth';
import {
  assertOkResponse,
  getApiUrl,
  readResponseSnippet,
} from './api';
import { ensureOnboardingFixtures, getPartnerAccessToken } from './onboarding';
export { readResponseSnippet } from './api';

export const prepareOnboardingSuite = async () => {
  ensureOnboardingFixtures();
};

export const makeStamp = (prefix: string) =>
  `${prefix}-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export const extractProductId = (payload: any): string => {
  const candidate = payload?.productId || payload?.product_id || payload?.id || payload?.product?.id || '';
  return typeof candidate === 'string' ? candidate.trim() : '';
};

const fetchArtists = async (page: Page): Promise<any[]> => {
  const accessToken = await getPartnerAccessToken('admin');
  const response = await page.request.get(getApiUrl('/api/artists'), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  await assertOkResponse(response, 'Failed to load artists');
  const payload = await response.json().catch(() => null);
  return Array.isArray(payload?.artists) ? payload.artists : Array.isArray(payload) ? payload : [];
};

const createArtistForOnboarding = async (page: Page) => {
  const accessToken = await getPartnerAccessToken('admin');
  const suffix = makeStamp('pw-onb-artist').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const handle = suffix.slice(0, 48);
  const response = await page.request.post(getApiUrl('/api/admin/provisioning/create-artist'), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      handle,
      name: `PW Onboarding ${handle}`,
      theme: {},
    },
  });
  await assertOkResponse(response, 'Unable to create artist for onboarding');
  const payload = await response.json().catch(() => null);
  const artistId = String(payload?.artist?.id || '').trim();
  const artistHandle = String(payload?.artist?.handle || handle).trim();
  if (!artistId || !artistHandle) {
    throw new Error(`Invalid create-artist response payload: ${JSON.stringify(payload ?? null)}`);
  }
  return { artistId, artistHandle };
};

export const ensureArtistIdentityForAdmin = async (page: Page) => {
  const artists = await fetchArtists(page);
  if (artists.length === 0) {
    return createArtistForOnboarding(page);
  }
  const firstArtist = artists[0];
  const artistId = String(firstArtist?.id || '').trim();
  const artistHandle = String(firstArtist?.handle || '').trim();
  if (!artistId || !artistHandle) {
    throw new Error(`Invalid artist payload for seeding: ${JSON.stringify(firstArtist ?? null)}`);
  }
  return { artistId, artistHandle };
};

export const createAdminProductWithStatus = async (
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
  const accessToken = await getPartnerAccessToken('admin');
  const response = await page.request.post(getApiUrl('/api/admin/products'), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
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
  await assertOkResponse(response, `Create product ${title}`);
  const payload = await response.json().catch(() => null);
  const productId = extractProductId(payload);
  if (!productId) {
    throw new Error(`Create product ${title} returned no productId: ${JSON.stringify(payload ?? null)}`);
  }
  return { productId };
};

export const gotoArtistProducts = async (page: Page) => {
  await gotoApp(page, '/partner/artist/products', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/partner\/artist\/products(?:[/?#]|$)/i, { timeout: 20000 });
  await expect(
    page.locator('h1').filter({ hasText: /artist products/i }).first()
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('combobox').first()).toBeVisible({ timeout: 20000 });
};

export const artistRowByTitle = (page: Page, title: string) =>
  page.getByTestId('artist-product-row').filter({ hasText: title }).first();

export const pendingMerchReview = (page: Page) => ({
  name: page.getByTestId('admin-pending-merch-name'),
  story: page.getByTestId('admin-pending-merch-story'),
  designPreview: page.getByTestId('admin-pending-merch-design-preview'),
  skus: page.getByTestId('admin-pending-merch-skus'),
  artist: page.getByTestId('admin-pending-merch-artist'),
  approve: page.getByTestId('admin-approve-merch'),
  approveDisabledReason: page.getByTestId('admin-approve-disabled-reason'),
  rejectReason: page.getByTestId('admin-rejection-reason'),
  reject: page.getByTestId('admin-reject-merch'),
  uploadList: page.getByTestId('admin-marketplace-upload-list'),
});

export const openPendingMerchModalByTitle = async (page: Page, title: string) => {
  const rowByTitle = () => page.getByTestId('admin-pending-merch-row').filter({ hasText: title }).first();
  const searchInputs = [
    page.getByTestId('admin-pending-merch-search').first(),
    page.getByPlaceholder(/search/i).first(),
  ];

  const pendingTabByTestId = page.getByTestId('admin-pending-merch-tab').first();
  const pendingTabByRole = page.getByRole('button', { name: /pending merch/i }).first();

  const openPendingQueueIfNeeded = async () => {
    if ((await rowByTitle().count().catch(() => 0)) > 0) return true;

    const tab =
      (await pendingTabByTestId.count().catch(() => 0)) > 0 ? pendingTabByTestId : pendingTabByRole;

    if ((await tab.count().catch(() => 0)) === 0) return false;
    if (!(await tab.isVisible().catch(() => false))) return false;

    const tabAriaSelected = (await tab.getAttribute('aria-selected').catch(() => null)) || '';
    if (tabAriaSelected !== 'true') {
      await tab.click().catch(() => null);
    }

    for (const input of searchInputs) {
      if ((await input.count().catch(() => 0)) === 0) continue;
      if (!(await input.isVisible().catch(() => false))) continue;
      await input.fill(title).catch(() => null);
      await page.waitForTimeout(100).catch(() => null);
      break;
    }

    return (await rowByTitle().count().catch(() => 0)) > 0;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });

    await expect
      .poll(async () => openPendingQueueIfNeeded(), {
        timeout: 60000,
        message: `Unable to find pending merch row in admin queue for title: ${title}`,
      })
      .toBe(true);

    const row = rowByTitle();
    await expect(row).toBeVisible({ timeout: 10000 });
    const opened = await expect
      .poll(async () => {
        const openButton = row.getByTestId('admin-pending-merch-open').first();
        if (await openButton.isVisible().catch(() => false)) {
          await openButton.click().catch(() => null);
        } else {
          await row.click().catch(() => null);
        }

        const nameVisible = await page
          .getByTestId('admin-pending-merch-name')
          .isVisible()
          .catch(() => false);
        if (nameVisible) return true;

        return page
          .getByTestId('admin-marketplace-images-input')
          .isVisible()
          .catch(() => false);
      }, { timeout: 30000 })
      .toBe(true)
      .then(() => true)
      .catch(() => false);

    if (opened) return;
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  }

  throw new Error(`Unable to open pending merch modal for title: ${title}`);
};

export const openFirstPendingMerchModal = async (page: Page) => {
  const pendingTabByTestId = page.getByTestId('admin-pending-merch-tab').first();
  const pendingTabByRole = page.getByRole('button', { name: /pending merch/i }).first();
  const openPendingTab = async () => {
    const tab =
      (await pendingTabByTestId.count().catch(() => 0)) > 0
        ? pendingTabByTestId
        : pendingTabByRole;
    if ((await tab.count().catch(() => 0)) === 0) return;
    if (!(await tab.isVisible().catch(() => false))) return;
    const tabAriaSelected = (await tab.getAttribute('aria-selected').catch(() => null)) || '';
    if (tabAriaSelected !== 'true') {
      await tab.click().catch(() => null);
    }
  };

  let rowsFound = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await openPendingTab();

    rowsFound = await expect
      .poll(async () => page.getByTestId('admin-pending-merch-row').count(), {
        timeout: 25000,
      })
      .toBeGreaterThan(0)
      .then(() => true)
      .catch(() => false);

    if (rowsFound) break;
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null);
  }

  if (!rowsFound) {
    throw new Error('Pending merch queue did not render any rows.');
  }

  const row = page.getByTestId('admin-pending-merch-row').first();
  await row.scrollIntoViewIfNeeded().catch(() => null);
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect
    .poll(async () => {
      const openButton = row.getByTestId('admin-pending-merch-open').first();
      if (await openButton.isVisible().catch(() => false)) {
        await openButton.click().catch(() => null);
      } else {
        await row.click().catch(() => null);
      }
      return page.getByTestId('admin-pending-merch-name').isVisible().catch(() => false);
    }, { timeout: 30000 })
    .toBe(true);
};
