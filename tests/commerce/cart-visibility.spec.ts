import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/auth';
import { cartLinkInHeader, myAccountLinkInHeader } from '../helpers/assertions';

async function gotoStorefront(page: Parameters<typeof cartLinkInHeader>[0]) {
  await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/products(?:[/?#]|$)/i, { timeout: 15000 });
}

async function expectStorefrontShopperHeader(page: Parameters<typeof cartLinkInHeader>[0]) {
  await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
  await expect(myAccountLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
}

test.describe('Header cart visibility by role', () => {
  test('public storefront still shows cart', async ({ page }) => {
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
  });

  test('buyer still sees cart', async ({ buyerPage }) => {
    await gotoStorefront(buyerPage);
    await expectStorefrontShopperHeader(buyerPage);
  });

  test('artist sees cart + my account on storefront', async ({ artistPage }) => {
    await gotoStorefront(artistPage);
    await expectStorefrontShopperHeader(artistPage);
  });

  test('label sees cart + my account on storefront', async ({ labelPage }) => {
    await gotoStorefront(labelPage);
    await expectStorefrontShopperHeader(labelPage);
  });

  test('admin sees cart + my account on storefront', async ({ adminPage }) => {
    await gotoStorefront(adminPage);
    await expectStorefrontShopperHeader(adminPage);
  });

  test('artist does not see cart in partner area', async ({ artistPage }) => {
    await gotoApp(artistPage, '/partner/artist', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(artistPage)).toHaveCount(0);
    await expect(myAccountLinkInHeader(artistPage)).toHaveCount(0);
  });

  test('label does not see cart in partner area', async ({ labelPage }) => {
    await gotoApp(labelPage, '/partner/label', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(labelPage)).toHaveCount(0);
    await expect(myAccountLinkInHeader(labelPage)).toHaveCount(0);
  });

  test('admin does not see cart in partner area', async ({ adminPage }) => {
    await gotoApp(adminPage, '/partner/admin', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(adminPage)).toHaveCount(0);
    await expect(myAccountLinkInHeader(adminPage)).toHaveCount(0);
  });

  test('partner roles can access buyer-style account alias routes', async ({
    artistPage,
    labelPage,
    adminPage,
  }) => {
    await gotoApp(artistPage, '/buyer/orders', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(artistPage).toHaveURL(/\/fan\/orders/i, { timeout: 15000 });
    await expect(artistPage.getByRole('heading', { name: /my orders/i })).toBeVisible({ timeout: 15000 });

    await gotoApp(labelPage, '/buyer/orders', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(labelPage).toHaveURL(/\/fan\/orders/i, { timeout: 15000 });
    await expect(labelPage.getByRole('heading', { name: /my orders/i })).toBeVisible({ timeout: 15000 });

    await gotoApp(adminPage, '/buyer/orders', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(adminPage).toHaveURL(/\/fan\/orders/i, { timeout: 15000 });
    await expect(adminPage.getByRole('heading', { name: /my orders/i })).toBeVisible({ timeout: 15000 });
  });

  test('artist can add a public product to cart', async ({ artistPage }) => {
    await gotoApp(artistPage, '/products', { waitUntil: 'domcontentloaded' });
    await expect(artistPage).toHaveURL(/\/products(?:[/?#]|$)/i, { timeout: 15000 });

    const catalogCards = artistPage.getByTestId('product-catalog-card');
    await expect(catalogCards.first()).toBeVisible({ timeout: 15000 });
    await catalogCards.first().click();
    await expect(artistPage).toHaveURL(/\/products\/[^/]+$/i, { timeout: 15000 });

    await artistPage.getByRole('button', { name: /^add to cart$/i }).click();
    await expect(cartLinkInHeader(artistPage).first()).toContainText('1', { timeout: 10000 });
  });
});
