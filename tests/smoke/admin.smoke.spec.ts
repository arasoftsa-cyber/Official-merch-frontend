import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/navigation';

test.describe('Admin smoke', () => {
  test('admin artists page shows featured column and toggle', async ({ adminPage }) => {
    await gotoApp(adminPage, '/partner/admin/artists', { waitUntil: 'domcontentloaded' });
    await expect(adminPage).toHaveURL(/\/partner\/admin\/artists/);

    await expect(adminPage.getByTestId('admin-artist-featured-header')).toBeVisible({ timeout: 15000 });

    const featuredToggleByTestId = adminPage.locator('[data-testid^="admin-artist-featured-toggle-"]').first();
    const featuredToggle =
      (await featuredToggleByTestId.count()) > 0
        ? featuredToggleByTestId
        : adminPage.locator('table tbody input[type="checkbox"]').first();

    await expect(featuredToggle).toBeVisible({ timeout: 15000 });
    await expect(featuredToggle).toBeEnabled({ timeout: 15000 });
  });
});
