import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/navigation';

const PRICE_TEXT_RE = /\b\S*[0-9]+(?:[.,][0-9]{2})?\b/;

test.describe('Artist status smoke', () => {
  test('artist dashboard recent order row drills into order detail', async ({ artistPage }) => {
    await gotoApp(artistPage, '/partner/artist', { waitUntil: 'domcontentloaded' });
    await artistPage.waitForLoadState('domcontentloaded');
    await expect(artistPage).toHaveURL(/\/partner\/artist/, { timeout: 15000 });
    await expect(artistPage.getByRole('heading', { name: /artist dashboard/i })).toBeVisible({
      timeout: 15000,
    });

    const recentOrdersSection = artistPage
      .locator('section:has(h2:has-text("Recent Orders"))')
      .first();
    await expect(recentOrdersSection).toBeVisible({ timeout: 15000 });

    await expect
      .poll(
        async () => {
          const rowCount = await recentOrdersSection.locator('table tbody tr').count();
          if (rowCount > 0) return 'rows';
          const emptyVisible = await recentOrdersSection
            .getByText(/no recent orders yet/i)
            .isVisible()
            .catch(() => false);
          return emptyVisible ? 'empty' : 'pending';
        },
        { timeout: 20000 }
      )
      .not.toBe('pending');

    const rowCount = await recentOrdersSection.locator('table tbody tr').count();
    if (rowCount === 0) {
      await expect(recentOrdersSection.getByText(/no recent orders yet/i)).toBeVisible();
      return;
    }

    const firstRow = recentOrdersSection.locator('table tbody tr').first();
    const firstOrderCell = firstRow.locator('td').first();
    await expect(firstOrderCell).toBeVisible({ timeout: 15000 });
    const orderId = ((await firstOrderCell.innerText()).trim() || '').replace(/\s+/g, ' ');
    expect(orderId.length).toBeGreaterThan(0);
    expect(orderId).toContain('-');

    if (await firstOrderCell.isVisible().catch(() => false)) {
      await firstOrderCell.click();
    } else {
      await firstRow.click();
    }

    await artistPage.waitForLoadState('domcontentloaded');
    await expect(artistPage).toHaveURL(/\/partner\/artist\/orders\//i, { timeout: 20000 });
    const heading = artistPage.getByRole('heading', { name: /artist order detail/i });
    await expect(heading).toBeVisible({ timeout: 15000 });
    await expect(artistPage.getByText(/order id/i)).toBeVisible({ timeout: 15000 });
    await expect(artistPage.getByText(orderId, { exact: true }).first()).toBeVisible({
      timeout: 15000,
    });

    const firstPrice = artistPage.getByText(PRICE_TEXT_RE).first();
    await expect(firstPrice).toBeVisible({ timeout: 15000 });

    await expect
      .poll(
        async () => {
          const handle = await firstPrice.elementHandle();
          if (!handle) return false;

          const rowText = await artistPage.evaluate((el) => {
            let cur = el;
            for (let i = 0; i < 6; i += 1) {
              if (!cur || !cur.parentElement) break;
              cur = cur.parentElement;

              const text = (cur.textContent || '').replace(/\s+/g, ' ').trim();
              if (text.length >= 10 && /\b\S*[0-9]+(?:[.,][0-9]{2})?\b/.test(text)) {
                return text;
              }
            }
            return (el.textContent || '').replace(/\s+/g, ' ').trim();
          }, handle);

          const cleaned = (rowText || '')
            .replace(/\b\S*[0-9]+(?:[.,][0-9]{2})?\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();

          return cleaned.length >= 5 && /[A-Za-z]/.test(cleaned);
        },
        { timeout: 15000 }
      )
      .toBe(true);
  });
});
