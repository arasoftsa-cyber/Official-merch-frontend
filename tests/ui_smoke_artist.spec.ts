import { test, expect, type Page, type Request } from '@playwright/test';
import { ARTIST_EMAIL, ARTIST_PASSWORD } from './_env';
import { gotoApp, loginArtist } from './helpers/auth';

type LegacyDropsCall = {
  method: string;
  resourceType: string;
  url: string;
  pageUrl: string;
};

const createArtistDropsGuard = (page: Page) => {
  const legacyDropsCalls: LegacyDropsCall[] = [];
  const handler = (req: Request) => {
    const url = req.url();
    if (url.includes('/api/drops') && !url.includes('/api/artist/drops')) {
      legacyDropsCalls.push({
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        pageUrl: page.url(),
      });
    }
  };
  page.on('request', handler);

  return () => {
    page.off('request', handler);
    const uniqueCalls = Array.from(
      new Map(
        legacyDropsCalls.map((call) => [
          `${call.method}|${call.resourceType}|${call.pageUrl}|${call.url}`,
          call,
        ])
      ).values()
    );
    const details =
      uniqueCalls.length === 0
        ? '<none>'
        : uniqueCalls
            .map(
              (call) =>
                `[${call.method}] (${call.resourceType}) page=${call.pageUrl}\n${call.url}`
            )
            .join('\n\n');
    expect(
      uniqueCalls,
      `Legacy artist drops calls detected. Artist flow must use /api/artist/drops.\n${details}`
    ).toHaveLength(0);
  };
};

test.describe('Artist status smoke', () => {
  test('artist dashboard recent order row drills into order detail', async ({ page }) => {
    test.skip(!ARTIST_EMAIL || !ARTIST_PASSWORD, 'Missing artist credentials');
    const assertNoLegacyDropsCalls = createArtistDropsGuard(page);

    try {
      await loginArtist(page);
      await gotoApp(page, '/partner/artist', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/partner\/artist(?:\/)?$/, { timeout: 15000 });
      await expect(page.getByRole('heading', { name: /artist dashboard/i })).toBeVisible({
        timeout: 15000,
      });

      const recentOrdersSection = page.locator('section:has(h2:has-text("Recent Orders"))').first();
      await expect(recentOrdersSection).toBeVisible({ timeout: 15000 });

      await expect
        .poll(async () => await recentOrdersSection.locator('table tbody tr').count(), {
          timeout: 20000,
        })
        .toBeGreaterThan(0);

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

      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/\/partner\/artist\/orders\//i, { timeout: 20000 });
      const heading = page.getByRole('heading', { name: /artist order detail/i });
      await expect(heading).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(/order id/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByText(orderId, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });

      const firstPrice = page.locator('text=/\\$\\d+(?:\\.\\d{2})?/').first();
      await expect(firstPrice).toBeVisible({ timeout: 15000 });

      await expect
        .poll(
          async () => {
            const handle = await firstPrice.elementHandle();
            if (!handle) return false;

            const rowText = await page.evaluate((el) => {
              // climb up a few levels to capture the full row-ish container
              let cur = el;
              for (let i = 0; i < 6; i++) {
                if (!cur || !cur.parentElement) break;
                cur = cur.parentElement;

                const t = (cur.textContent || '').replace(/\s+/g, ' ').trim();
                // Heuristic: row-ish container should contain multiple fields (not just "$19.99")
                if (t.length >= 10 && /\$/.test(t)) return t;
              }
              // fallback to the price node textContent (worst case)
              return (el.textContent || '').replace(/\s+/g, ' ').trim();
            }, handle);

            const cleaned = (rowText || '')
              .replace(/\$\d+(?:\.\d{2})?/g, '') // remove prices
              .replace(/\s+/g, ' ')
              .trim();

            // Need some meaningful text remaining (product name / variant etc.)
            // Use a conservative threshold: at least 5 chars and at least 1 letter.
            return cleaned.length >= 5 && /[A-Za-z]/.test(cleaned);
          },
          { timeout: 15000 }
        )
        .toBe(true);
    } finally {
      assertNoLegacyDropsCalls();
    }
  });

});
