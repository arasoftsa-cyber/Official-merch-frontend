import { expect, test } from '@playwright/test';
import { gotoApp, loginAdmin, loginArtist, loginBuyer, loginLabel } from '../helpers/auth';
import { cartLinkInHeader, myAccountLinkInHeader } from '../helpers/assertions';

const loginByRole = {
  buyer: loginBuyer,
  artist: loginArtist,
  label: loginLabel,
  admin: loginAdmin,
} as const;

async function gotoStorefront(page: Parameters<typeof cartLinkInHeader>[0]) {
  await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
  if (!/\/products(?:[/?#]|$)/i.test(page.url())) {
    await gotoApp(page, '/products', {
      waitUntil: 'domcontentloaded',
      authRetry: false,
    });
  }
  await expect(page).toHaveURL(/\/products(?:[/?#]|$)/i, { timeout: 15000 });
}

test.describe('Storefront header and route access contracts', () => {
  test('storefront header matrix matches role contract', async ({ page }) => {
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
    await expect(myAccountLinkInHeader(page)).toHaveCount(0);

    const storefrontRoleCases = [
      { role: 'buyer', expectCart: true, expectMyAccount: true },
      { role: 'artist', expectCart: true, expectMyAccount: true },
      { role: 'label', expectCart: true, expectMyAccount: true },
      { role: 'admin', expectCart: true, expectMyAccount: true },
    ] as const;

    for (const scenario of storefrontRoleCases) {
      await test.step(`${scenario.role} on storefront`, async () => {
        await loginByRole[scenario.role](page);
        await gotoStorefront(page);

        const cartLink = cartLinkInHeader(page);
        const accountLink = myAccountLinkInHeader(page);
        if (scenario.expectCart) {
          await expect(cartLink.first()).toBeVisible({ timeout: 15000 });
        } else {
          await expect(cartLink).toHaveCount(0);
        }

        if (scenario.expectMyAccount) {
          await expect(accountLink.first()).toBeVisible({ timeout: 15000 });
        } else {
          await expect(accountLink).toHaveCount(0);
        }
      });
    }
  });

  test('partner area header matrix hides shopper actions for partner roles', async ({ page }) => {
    const partnerAreaCases = [
      { role: 'artist', path: '/partner/artist', heading: /artist dashboard/i },
      { role: 'label', path: '/partner/label', heading: /label dashboard/i },
      { role: 'admin', path: '/partner/admin', heading: /admin dashboard/i },
    ] as const;

    for (const scenario of partnerAreaCases) {
      await test.step(`${scenario.role} partner area`, async () => {
        await loginByRole[scenario.role](page, { returnTo: scenario.path });
        await gotoApp(page, scenario.path, { waitUntil: 'domcontentloaded', authRetry: false });
        await expect(page).toHaveURL(new RegExp(`${scenario.path.replace(/\//g, '\\/')}(?:[/?#]|$)`, 'i'), {
          timeout: 15000,
        });
        await expect(page.getByRole('heading', { name: scenario.heading })).toBeVisible({
          timeout: 15000,
        });
        await expect(cartLinkInHeader(page)).toHaveCount(0);
        await expect(myAccountLinkInHeader(page)).toHaveCount(0);
      });
    }
  });

  test('partner roles can access buyer alias routes through canonical fan account pages', async ({
    page,
  }) => {
    const aliasCases = [
      { role: 'artist', expectedHeading: /my orders/i },
      { role: 'label', expectedHeading: /my orders/i },
      { role: 'admin', expectedHeading: /my orders/i },
    ] as const;

    for (const scenario of aliasCases) {
      await test.step(`${scenario.role} buyer alias redirect`, async () => {
        await loginByRole[scenario.role](page);
        await gotoApp(page, '/buyer/orders', { waitUntil: 'domcontentloaded', authRetry: false });
        await expect(page).toHaveURL(/\/fan\/orders(?:[/?#]|$)/i, { timeout: 15000 });
        await expect(page.getByRole('heading', { name: scenario.expectedHeading })).toBeVisible({
          timeout: 15000,
        });
      });
    }
  });

  test('authenticated storefront cart badge increments after add to cart', async ({ page }) => {
    await loginArtist(page, { returnTo: '/products' });
    await gotoStorefront(page);

    const catalogCards = page.getByTestId('product-catalog-card');
    await expect(catalogCards.first()).toBeVisible({ timeout: 15000 });
    await catalogCards.first().click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/i, { timeout: 15000 });

    await page.getByRole('button', { name: /^add to cart$/i }).click();
    await expect(cartLinkInHeader(page).first()).toContainText('1', { timeout: 10000 });
  });
});
