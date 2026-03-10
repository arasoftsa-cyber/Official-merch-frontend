import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/auth';

test.describe('Admin drops API contract', () => {
  test('admin drops page loads without raw HTML route errors', async ({ adminPage }) => {
    await gotoApp(adminPage, '/partner/admin/drops', { waitUntil: 'domcontentloaded' });

    await expect(adminPage).toHaveURL(/\/partner\/admin\/drops(?:[/?#]|$)/);
    await expect(adminPage.getByRole('heading', { name: /admin drops/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(adminPage.getByText(/cannot get \/api\/admin\/drops/i)).toHaveCount(0);

    const noDropsMessage = adminPage.getByText(/no drops found\./i).first();
    const anyDropRow = adminPage.locator('[data-testid^="admin-drop-menu-"]').first();
    await expect
      .poll(
        async () =>
          (await noDropsMessage.isVisible().catch(() => false)) ||
          (await anyDropRow.isVisible().catch(() => false)),
        { timeout: 15000 }
      )
      .toBe(true);
  });

  test('admin drops page sanitizes unexpected HTML error payloads', async ({ adminPage }) => {
    await adminPage.route(/\/api\/admin\/drops(?:[/?#]|$)/i, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'text/html; charset=utf-8',
        body: '<!doctype html><html><body><pre>Cannot GET /api/admin/drops</pre></body></html>',
      });
    });

    await gotoApp(adminPage, '/partner/admin/drops', {
      waitUntil: 'domcontentloaded',
      authRetry: false,
    });

    const alert = adminPage.getByRole('alert').first();
    await expect(alert).toBeVisible({ timeout: 15000 });
    await expect(alert).toContainText(/admin drops endpoint is unavailable|unexpected server response/i);
    await expect(alert).not.toContainText(/cannot get \/api\/admin\/drops/i);
  });
});
