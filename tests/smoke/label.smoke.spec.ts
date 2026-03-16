import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/navigation';
import {
  expectRedirectToPortalLogin,
  partnerLogoutButton,
} from '../helpers/assertions';

test.describe('Label smoke', () => {
  test('label dashboard renders portfolio overview', async ({ labelPage }) => {
    await gotoApp(labelPage, '/partner/label');
    const shellHeading = labelPage.getByRole('heading', { name: /label dashboard|dashboard/i }).first();
    await expect(shellHeading).toBeVisible({ timeout: 15000 });

    await expect(
      labelPage.locator('main').getByRole('paragraph').filter({ hasText: /^artists$/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByTestId('label-metric-active-artists')).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByTestId('label-metric-inactive-artists')).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByTestId('label-metric-label-gross')).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByText(/artist performance/i)).toBeVisible({ timeout: 15000 });
    await expect(partnerLogoutButton(labelPage)).toBeVisible({ timeout: 15000 });

    await expect(labelPage.getByText(/^artist$/i)).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByText(/orders\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByText(/gross\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByText(/units\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(labelPage.getByText(/active\s*products/i)).toBeVisible({ timeout: 15000 });

    const artistPerformanceSection = labelPage
      .getByRole('heading', { name: /artist performance/i })
      .first()
      .locator('xpath=ancestor::section[1]');
    const rowLikeElements = artistPerformanceSection.locator('div.divide-y > button');
    await expect(rowLikeElements.first()).toBeVisible({ timeout: 15000 });
    expect(await rowLikeElements.count()).toBeGreaterThan(0);

    const logoutButton = partnerLogoutButton(labelPage);
    await expect(logoutButton).toBeVisible({ timeout: 15000 });
    await logoutButton.click();
    await expect(labelPage).toHaveURL(/\/($|\?)/, { timeout: 15000 });

    await gotoApp(labelPage, '/partner/label', { waitUntil: 'domcontentloaded' });
    await expectRedirectToPortalLogin(labelPage, '/partner/label');
  });
});
