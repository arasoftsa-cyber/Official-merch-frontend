import { test, expect } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

const PUBLIC_ROUTES_WITH_CHROME = [
  '/fan/login',
  '/fan/register',
  '/partner/login',
  '/forgot-password?portal=fan',
  '/reset-password?token=smoke-token',
  '/artists',
  '/products',
  '/drops',
];

test.describe('Public route chrome', () => {
  for (const routePath of PUBLIC_ROUTES_WITH_CHROME) {
    test(`${routePath} shows shared header and footer`, async ({ page }) => {
      await page.goto(`${UI_BASE_URL}${routePath}`, { waitUntil: 'domcontentloaded' });

      await expect(page.locator('header').first()).toBeVisible();
      await expect(page.locator('footer').first()).toBeVisible();
    });
  }

  test('/auth/oidc/callback does not show public footer', async ({ page }) => {
    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portalError=test&message=${encodeURIComponent('OIDC callback test')}`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page.locator('footer')).toHaveCount(0);
  });
});
