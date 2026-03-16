import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/navigation';

const cardForLabel = (page: Page, label: string) =>
  page
    .locator('div.rounded-2xl.border')
    .filter({ has: page.getByText(new RegExp(`^${label}$`, 'i')) })
    .first();

const cardValueForLabel = (page: Page, label: string) =>
  cardForLabel(page, label).locator('p.mt-2').first();

test.describe('Admin dashboard KPI values', () => {
  test('renders numeric metrics or safe fallback values without mojibake', async ({ adminPage }) => {
    await gotoApp(adminPage, '/partner/admin', { waitUntil: 'domcontentloaded' });
    await expect(adminPage).toHaveURL(/\/partner\/admin/);

    const ordersValue = cardValueForLabel(adminPage, 'ORDERS');
    await expect(ordersValue).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => (await ordersValue.textContent())?.trim() ?? '', { timeout: 15000 })
      .not.toBe('...');

    const staticFallbackLabels = [
      'LEADS',
      'ARTISTS',
      'PRODUCTS',
      'SKU MASTER',
      'DROPS',
      'HOMEPAGE',
      'PROVISIONING',
    ];

    for (const label of staticFallbackLabels) {
      const value = cardValueForLabel(adminPage, label);
      await expect(value).toHaveText('-', { timeout: 10000 });
    }

    const kpiValues = adminPage.locator('div.rounded-2xl.border p.mt-2');
    const valueTexts = (await kpiValues.allTextContents()).map((text) => text.trim());
    for (const text of valueTexts) {
      expect(text).not.toMatch(/[\u00C3\u00C2\u00E2]/);
    }
  });
});
