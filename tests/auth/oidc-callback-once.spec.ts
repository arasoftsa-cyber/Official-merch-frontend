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

    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portal=fan&returnTo=%2Fstatus&code=once-only-code`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page).toHaveURL(/\/status$/, { timeout: 15000 });
    await expect.poll(() => exchangePostCount, { timeout: 5000 }).toBe(1);
  });

  test('successful callback uses canonical fallback when returnTo is invalid', async ({ page }) => {
    await page.route('**/api/auth/oidc/google/exchange', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: { id: 'user-2', email: 'artist@example.com', role: 'artist' },
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
          user: { id: 'user-2', email: 'artist@example.com', role: 'artist' },
        }),
      });
    });

    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portal=partner&returnTo=${encodeURIComponent(
        'https://evil.example'
      )}&code=partner-fallback-code`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page).toHaveURL(/\/partner\/artist$/, { timeout: 15000 });
  });

  test('duplicate callback code uses canonical replay contract when code is already handled', async ({
    page,
  }) => {
    let exchangePostCount = 0;
    const replayCode = 'already-used-code';

    await page.route('**/api/auth/oidc/google/exchange', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        exchangePostCount += 1;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'oidc_callback_replay_or_duplicate',
            message: 'OIDC callback code has already been consumed.',
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${UI_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((code) => {
      window.sessionStorage.setItem(`oidc:exchanged:${code}`, '1');
    }, replayCode);

    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portal=fan&returnTo=%2Fstatus&code=${encodeURIComponent(
        replayCode
      )}`,
      { waitUntil: 'domcontentloaded' }
    );

    await expect(page).toHaveURL(/\/status$/, { timeout: 15000 });
    await expect.poll(() => exchangePostCount, { timeout: 5000 }).toBe(0);
  });
});
