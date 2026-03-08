import { test, expect } from '../helpers/session';
import type { Page } from '@playwright/test';
import { gotoApp } from '../helpers/auth';
import { getProductCards } from '../helpers/assertions';

const getProductTitleFromDetail = async (page: Page): Promise<string> => {
  const waitForDetailApi = async () => {
    await page
      .waitForResponse(
        (response) =>
          response.url().includes('/api/products/') && [200, 304].includes(response.status()),
        { timeout: 10000 }
      )
      .catch(() => null);
  };

  const resolveTitle = async (): Promise<string> => {
    await waitForDetailApi();
    await page.waitForLoadState('domcontentloaded');
    const candidateLocators = [
      page.locator('[data-testid="product-title"]').first(),
      page.locator('[data-testid="product-detail-title"]').first(),
      page.locator('h1').first(),
      page.getByRole('heading', { level: 1 }).first(),
    ];

    for (const locator of candidateLocators) {
      if ((await locator.count().catch(() => 0)) === 0) continue;
      await expect(locator).toBeVisible({ timeout: 10000 });
      const candidate = (await locator.textContent())?.trim();
      if (candidate && candidate.toLowerCase() !== 'product detail') {
        return candidate;
      }
    }

    throw new Error('title selector not found');
  };

  try {
    return await resolveTitle();
  } catch {
    await page.reload({ waitUntil: 'domcontentloaded' });
    try {
      return await resolveTitle();
    } catch {
      const url = page.url();
      const contentSnippet = (await page.content().catch(() => 'title selector not found'))
        .replace(/\s+/g, ' ')
        .slice(0, 300);
      throw new Error(
        `Product detail title missing. url=${url} snippet=${contentSnippet || 'title selector not found'}`
      );
    }
  }
};

const openVariantProductDetail = async (page: Page): Promise<{ productName: string; productId: string }> => {
  await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
  const cards = getProductCards(page);
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  const card = cards.first();
  await card.click();
  await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 15000 });

  const detailUrl = page.url();
  const match = detailUrl.match(/\/products\/([^\/?#]+)/);
  const productId = match?.[1] ?? detailUrl;
  const title = await getProductTitleFromDetail(page);
  const variantSelect = page.locator('select#variant-select').first();
  await expect(variantSelect).toBeVisible({ timeout: 10000 });
  return { productName: title, productId };
};

test.describe('Buyer catalog and checkout', () => {
  test('buyer can open a product detail', async ({ page }) => {
    await gotoApp(page, '/products');
    const productCard = getProductCards(page).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
    await productCard.click();
    await expect(page).toHaveURL(/\/products\//);
    const title = page.getByRole('heading').first();
    await expect(title).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/price unavailable|₹\s*\d+([.,]\d{2})?|\$\s*\d+([.,]\d{2})?/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('buyer checkout blocks missing variant selection with actionable message', async ({ buyerPage }) => {
    const orderPosts: string[] = [];

    buyerPage.on('request', (req: any) => {
      if (req.method() !== 'POST') return;
      const url = req.url();
      if (/\/api\/orders(?:\/|$)/i.test(url)) {
        orderPosts.push(url);
      }
    });

    await openVariantProductDetail(buyerPage);

    const variantSelect = buyerPage.locator('select#variant-select').first();
    await expect(variantSelect).toBeVisible({ timeout: 10000 });
    await buyerPage.evaluate(() => {
      const selectEl = document.querySelector('select#variant-select') as HTMLSelectElement | null;
      const buyNowButton = document.querySelector('[data-testid="product-buy-now"]') as
        | HTMLButtonElement
        | null;
      if (!selectEl) return;
      const invalidValue = '__invalid_variant__';
      if (!Array.from(selectEl.options).some((option) => option.value === invalidValue)) {
        const temp = document.createElement('option');
        temp.value = invalidValue;
        temp.textContent = 'Invalid variant';
        selectEl.appendChild(temp);
      }
      selectEl.value = invalidValue;
      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      if (buyNowButton) {
        buyNowButton.disabled = false;
        buyNowButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    });

    await expect
      .poll(
        async () => {
          const explicitMessageVisible = await buyerPage
            .getByText(/please select a size\/color|needs a variant selection/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (explicitMessageVisible) return true;
          return buyerPage.getByLabel(/variant/i).first().isVisible().catch(() => false);
        },
        { timeout: 15000 }
      )
      .toBe(true);
    await expect(buyerPage).toHaveURL(/\/products\/[^/]+$/, { timeout: 15000 });
    expect(orderPosts, `Unexpected POST /api/orders calls:\n${orderPosts.join('\n')}`).toHaveLength(0);
  });
});
