import { test, expect, type Page } from '@playwright/test';
import {
  BUYER_EMAIL,
  BUYER_PASSWORD,
  ARTIST_EMAIL,
  ARTIST_PASSWORD,
} from '../_env';
import { createAdminProductWithStatus, ensureArtistIdentityForAdmin, makeStamp } from '../helpers/onboarding-flow';
import { DESIGN_IMAGE_PATH, ensureOnboardingFixtures } from '../helpers/onboarding';

const canonicalFanLogin = async (page: Page, returnTo: string) => {
  const currentUrl = page.url();
  if (!/\/fan\/login(?:[/?#]|$)/i.test(currentUrl)) {
    await page.goto(returnTo, { waitUntil: 'domcontentloaded' });
  }
  await expect(page).toHaveURL(/\/fan\/login(?:[/?#]|$)/i, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^fan login$/i })).toBeVisible({ timeout: 10000 });
  await page.getByTestId('fan-login-email').fill(BUYER_EMAIL);
  await page.getByTestId('fan-login-password').fill(BUYER_PASSWORD);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/fan\/login(?:[/?#]|$)/i.test(response.url()),
    { timeout: 20000 }
  );
  await page.getByTestId('fan-login-submit').click();
  const response = await loginResponse;
  expect(response.ok()).toBe(true);
};

const canonicalPartnerLogin = async (
  page: Page,
  returnTo: string
) => {
  await page.goto(returnTo, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/partner\/login(?:[/?#]|$)/i, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: /^partner login$/i })).toBeVisible({
    timeout: 10000,
  });
  await page.getByLabel(/^email$/i).fill(ARTIST_EMAIL);
  await page.getByLabel(/^password$/i).fill(ARTIST_PASSWORD);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/partner\/login(?:[/?#]|$)/i.test(response.url()),
    { timeout: 20000 }
  );
  await page.getByRole('button', { name: /^login$/i }).click();
  const response = await loginResponse;
  expect(response.ok()).toBe(true);
};

const openCatalogCardByTitle = async (page: Page, title: string) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('public-catalog-toolbar')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('public-catalog-search').fill(title);
    const card = page.getByTestId('product-catalog-card').filter({ hasText: title }).first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      return;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Catalog card not visible for seeded product: ${title}`);
};

test.describe('Runtime contract smoke', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    ensureOnboardingFixtures();
  });

  test('fan auth returns to canonical orders page', async ({ page }) => {
    await canonicalFanLogin(page, '/fan/orders');
    await expect(page).toHaveURL(/\/fan\/orders(?:[/?#]|$)/i, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: /my orders/i })).toBeVisible({
      timeout: 15000,
    });
  });

  test('artist merch submission uploads design media through the canonical UI flow', async ({
    page,
  }) => {
    const merchName = makeStamp('pw-contract-media');
    const merchStory = `Contract smoke media story for ${merchName}.`;

    await canonicalPartnerLogin(page, '/partner/artist/products');
    await expect(page).toHaveURL(/\/partner\/artist\/products(?:[/?#]|$)/i, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: /artist products/i })).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId('artist-new-merch-button').click();
    await expect(page.getByTestId('artist-new-merch-form')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('artist-merch-name').fill(merchName);
    await page.getByTestId('artist-merch-story').fill(merchStory);
    await page.getByTestId('artist-sku-regular-tshirt').check();
    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);

    const submitResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/artist\/products\/onboarding(?:[/?#]|$)/i.test(response.url()) &&
        response.ok(),
      { timeout: 30000 }
    );
    await page.getByTestId('artist-request-merch-submit').click();
    await submitResponse;

    await expect(page.getByTestId('artist-merch-submit-success')).toBeVisible({ timeout: 20000 });
    const row = page.getByTestId('artist-product-row').filter({ hasText: merchName }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i);
    await expect(row.getByTestId('artist-merch-readonly-design-image')).toContainText(/uploaded/i);
  });

  test('buyer checkout creates a real order from a seeded active product', async ({ page }) => {
    const productTitle = makeStamp('pw-contract-order');

    const { artistId } = await ensureArtistIdentityForAdmin(page);
    const { productId } = await createAdminProductWithStatus(page, {
      artistId,
      title: productTitle,
      status: 'active',
    });
    expect(productId).toBeTruthy();

    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/products(?:[/?#]|$)/i, { timeout: 15000 });
    await expect(page.getByTestId('public-catalog-toolbar')).toBeVisible({ timeout: 15000 });
    await openCatalogCardByTitle(page, productTitle);

    await expect(page).toHaveURL(/\/products\/[^/?#]+(?:[/?#]|$)/i, { timeout: 15000 });
    await expect(page.getByTestId('product-title')).toContainText(productTitle, { timeout: 15000 });
    await expect(page.getByRole('button', { name: /^add to cart$/i })).toBeEnabled({
      timeout: 15000,
    });
    await page.getByRole('button', { name: /^add to cart$/i }).click();
    await page.locator('header a[href="/cart"]').click();

    await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/i, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /^cart$/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(new RegExp(productTitle, 'i')).first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByRole('button', { name: /login to checkout/i }).click();
    await canonicalFanLogin(page, '/cart');
    await expect(page).toHaveURL(/\/cart(?:[/?#]|$)/i, { timeout: 20000 });
    await expect(page.getByRole('heading', { name: /^cart$/i })).toBeVisible({ timeout: 15000 });

    const createOrderResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/orders(?:[/?#]|$)/i.test(response.url()) &&
        response.ok(),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /^checkout$/i }).click();
    const response = await createOrderResponse;
    const payload = await response.json().catch(() => null);
    const orderId = String(payload?.orderId || payload?.id || payload?.order?.id || '').trim();
    expect(orderId).toBeTruthy();

    await expect(page).toHaveURL(new RegExp(`/fan/orders/${orderId}(?:[/?#]|$)`, 'i'), {
      timeout: 30000,
    });
    await expect(page.getByTestId('order-status')).toBeVisible({ timeout: 15000 });
  });
});
