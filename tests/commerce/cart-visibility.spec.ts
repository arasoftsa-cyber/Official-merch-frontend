import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/auth';
import { cartLinkInHeader } from '../helpers/assertions';

test.describe('Header cart visibility by role', () => {
  test('public storefront still shows cart', async ({ page }) => {
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(cartLinkInHeader(page).first()).toBeVisible({ timeout: 15000 });
  });

  test('buyer still sees cart', async ({ buyerPage }) => {
    await gotoApp(buyerPage, '/products', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(buyerPage).first()).toBeVisible({ timeout: 15000 });
  });

  test('artist does not see cart in partner area', async ({ artistPage }) => {
    await gotoApp(artistPage, '/partner/artist', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(artistPage)).toHaveCount(0);
  });

  test('label does not see cart in partner area', async ({ labelPage }) => {
    await gotoApp(labelPage, '/partner/label', { waitUntil: 'domcontentloaded' });
    await expect(cartLinkInHeader(labelPage)).toHaveCount(0);
  });
});
