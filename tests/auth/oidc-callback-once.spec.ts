import { test, expect } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

test.describe('OIDC callback exchange', () => {
  test('executes code exchange exactly once', async ({ page }) => {
    let exchangePostCount = 0;

    await page.route('**/api/auth/oidc/google/exchange', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        exchangePostCount += 1;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: { id: 'user-1', email: 'fan@example.com', role: 'buyer' },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.route('**/api/auth/whoami', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user-1', email: 'fan@example.com', role: 'buyer' },
        }),
      });
    });

    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portal=fan&returnTo=%2Fstatus&code=once-only-code`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page).toHaveURL(/\/status$/, { timeout: 15000 });
    await expect.poll(() => exchangePostCount, { timeout: 5000 }).toBe(1);
  });
});
