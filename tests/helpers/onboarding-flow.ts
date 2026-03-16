import { expect, type Page } from '@playwright/test';
import { gotoApp } from './navigation';
import { DESIGN_IMAGE_PATH, ensureOnboardingFixtures } from './onboarding';
import { ensureLocalTestSupportSeed } from './localTestSupport';

export const prepareOnboardingSuite = async () => {
  ensureOnboardingFixtures();
  await ensureLocalTestSupportSeed();
};

export const makeStamp = (prefix: string) =>
  `${prefix}-${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

export const extractProductId = (payload: any): string => {
  const candidate =
    payload?.productId || payload?.product_id || payload?.id || payload?.product?.id || '';
  return typeof candidate === 'string' ? candidate.trim() : '';
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

export const submitArtistMerchRequest = async (
  page: Page,
  {
    merchName,
    merchStory,
    skuTestIds,
  }: {
    merchName: string;
    merchStory: string;
    skuTestIds: string[];
  }
) => {
  await page.getByTestId('artist-new-merch-button').click();
  await expect(page.getByTestId('artist-new-merch-form')).toBeVisible({ timeout: 10000 });
  await page.getByTestId('artist-merch-name').fill(merchName);
  await page.getByTestId('artist-merch-story').fill(merchStory);
  for (const skuTestId of skuTestIds) {
    await page.getByTestId(skuTestId).check();
  }
};

export const submitArtistMerchRequestViaUi = async (
  page: Page,
  {
    merchName,
    merchStory,
    skuTestIds,
    designImagePath = DESIGN_IMAGE_PATH,
  }: {
    merchName: string;
    merchStory: string;
    skuTestIds: string[];
    designImagePath?: string;
  }
) => {
  await submitArtistMerchRequest(page, {
    merchName,
    merchStory,
    skuTestIds,
  });
  await page.getByTestId('artist-merch-design-image').setInputFiles(designImagePath);
  const submitResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/artist\/products\/onboarding(?:[/?#]|$)/i.test(response.url()) &&
      response.ok(),
    { timeout: 30000 }
  );
  await page.getByTestId('artist-request-merch-submit').click();
  const response = await submitResponse;
  const payload = await response.json().catch(() => null);
  const productId = extractProductId(payload);
  if (!productId) {
    throw new Error(`Artist onboarding submission returned no productId: ${JSON.stringify(payload ?? null)}`);
  }
  await expect(page.getByTestId('artist-merch-submit-success')).toBeVisible({ timeout: 20000 });
  return { productId, payload };
};

export const expectArtistMerchReadonlyRow = async (
  page: Page,
  {
    merchName,
    skuLabelPattern,
  }: {
    merchName: string;
    skuLabelPattern: RegExp;
  }
) => {
  const row = artistRowByTitle(page, merchName);
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row.getByTestId('artist-product-status')).toContainText(/pending|inactive|active/i);
  await expect(row.getByTestId('artist-merch-readonly-name')).toContainText(merchName);
  await expect(row.getByTestId('artist-merch-readonly-story')).toBeVisible();
  await expect(row.getByTestId('artist-merch-readonly-design-image')).toContainText(/uploaded/i);
  await expect(row.getByTestId('artist-merch-readonly-skus')).toContainText(skuLabelPattern);
  await expect(row.locator('input, textarea, select')).toHaveCount(0);
  return row;
};

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
  const loadingCopy = page.getByText(/^loading\.\.\.$/i).first();

  const waitForAdminProductsScreen = async () => {
    await expect
      .poll(async () => {
        const isLoading = await loadingCopy.isVisible().catch(() => false);
        if (isLoading) return false;

        const pendingTabVisible = await pendingTabByTestId.isVisible().catch(() => false);
        if (pendingTabVisible) return true;

        return pendingTabByRole.isVisible().catch(() => false);
      }, {
        timeout: 30000,
        message: 'Admin products screen did not finish loading the pending merch controls.',
      })
      .toBe(true);
  };

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
      break;
    }

    return (await rowByTitle().count().catch(() => 0)) > 0;
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await waitForAdminProductsScreen();

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

export const rejectPendingMerchViaAdminUi = async (
  page: Page,
  input: { title: string; rejectionReason: string }
) => {
  await openPendingMerchModalByTitle(page, input.title);
  const review = pendingMerchReview(page);
  await expect(review.name).toContainText(input.title, { timeout: 15000 });
  await review.rejectReason.fill(input.rejectionReason);
  const rejectResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/admin\/products\/[^/]+\/onboarding\/reject(?:[/?#]|$)/i.test(response.url()) &&
      response.ok(),
    { timeout: 30000 }
  );
  await review.reject.click();
  await rejectResponse;
  await expect(page.getByTestId('admin-pending-merch-name')).toHaveCount(0);
};
