import { test, expect, type Page } from '@playwright/test';
import { ARTIST_EMAIL, ARTIST_PASSWORD, BUYER_EMAIL, BUYER_PASSWORD, LABEL_EMAIL, LABEL_PASSWORD } from './_env';
import { gotoApp, loginArtist, loginBuyer, loginLabel } from './helpers/auth';

const cartLinkInHeader = (page: Page) => page.locator('header a[href="/cart"]');

test.describe('Header cart visibility by role', () => {
  test('public storefront still shows cart', async ({ page }) => {
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
  });

  test('buyer still sees cart', async ({ page }) => {
    test.skip(!BUYER_EMAIL || !BUYER_PASSWORD, 'Missing buyer credentials');
    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
  });

  test('artist does not see cart in partner area', async ({ page }) => {
    test.skip(!ARTIST_EMAIL || !ARTIST_PASSWORD, 'Missing artist credentials');
    await loginArtist(page);
    await gotoApp(page, '/partner/artist', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(page)).toHaveCount(0);
  });

  test('label does not see cart in partner area', async ({ page }) => {
    test.skip(!LABEL_EMAIL || !LABEL_PASSWORD, 'Missing label credentials');
    await loginLabel(page);
    await gotoApp(page, '/partner/label', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(page)).toHaveCount(0);
  });
});
