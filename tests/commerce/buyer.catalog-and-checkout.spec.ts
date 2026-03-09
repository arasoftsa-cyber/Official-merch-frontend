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

const openProductDetail = async (page: Page): Promise<{ productName: string; productId: string }> => {
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
  return { productName: title, productId };
};

test.describe('Buyer catalog and checkout', () => {
  test('buyer can open a product detail with polished shopper CTA set', async ({ page }) => {
    await gotoApp(page, '/products');
    const productCard = getProductCards(page).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
    await productCard.click();
    await expect(page).toHaveURL(/\/products\//);
    const title = page.getByRole('heading').first();
    await expect(title).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/price unavailable|₹\s*\d+([.,]\d{2})?/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('select#variant-select')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create order/i })).toHaveCount(0);
  });

  test('buyer selects only size/color while variant resolves internally', async ({ buyerPage }) => {
    const productId = '00000000-0000-4000-8000-000000009999';
    const selectedVariantId = '00000000-0000-4000-8000-000000000013';

    await buyerPage.route(/\/api\/products\/[0-9a-f-]+(?:[/?#].*)?$/i, async (route) => {
      const url = route.request().url();
      if (!url.includes(`/api/products/${productId}`)) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          product: {
            id: productId,
            title: 'Mock Shopper Tee',
            description: 'Mock product for size/color variant resolution',
            price_cents: 4200,
          },
          variants: [
            {
              id: '00000000-0000-4000-8000-000000000011',
              sku: 'MOCK-M-BLK',
              size: 'M',
              color: 'Black',
              stock: 8,
              price_cents: 4200,
              effective_sellable: true,
            },
            {
              id: '00000000-0000-4000-8000-000000000012',
              sku: 'MOCK-L-BLK',
              size: 'L',
              color: 'Black',
              stock: 0,
              price_cents: 4200,
              effective_sellable: false,
            },
            {
              id: selectedVariantId,
              sku: 'MOCK-M-WHT',
              size: 'M',
              color: 'White',
              stock: 6,
              price_cents: 4300,
              effective_sellable: true,
            },
          ],
        }),
      });
    });

    await buyerPage.evaluate(() => localStorage.removeItem('om_cart_v1'));
    await gotoApp(buyerPage, `/products/${productId}`, {
      waitUntil: 'domcontentloaded',
      authRetry: false,
    });

    await expect(buyerPage.locator('select#variant-select')).toHaveCount(0);
    await expect(buyerPage.getByRole('button', { name: /create order/i })).toHaveCount(0);
    await expect(buyerPage.locator('select#variant-size-select')).toBeVisible({ timeout: 15000 });
    await expect(buyerPage.locator('select#variant-color-select')).toBeVisible({ timeout: 15000 });

    await buyerPage.selectOption('select#variant-size-select', 'L');
    await buyerPage.selectOption('select#variant-color-select', 'Black');
    await expect(buyerPage.getByTestId('pdp-stock-status')).toContainText(/out of stock/i);
    await expect(buyerPage.getByTestId('product-buy-now')).toBeDisabled();

    await buyerPage.selectOption('select#variant-size-select', 'M');
    await buyerPage.selectOption('select#variant-color-select', 'White');
    await expect(buyerPage.getByTestId('pdp-stock-status')).toContainText(/in stock/i);
    await expect(buyerPage.getByTestId('product-buy-now')).toBeEnabled();

    await buyerPage.getByRole('button', { name: /^add to cart$/i }).click();
    const cart = await buyerPage.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('om_cart_v1') || '[]');
      } catch {
        return [];
      }
    });
    const createdLine = Array.isArray(cart)
      ? cart.find((item: any) => item?.productId === productId)
      : null;
    expect(createdLine).toBeTruthy();
    expect(createdLine?.variantId).toBe(selectedVariantId);
  });

  test('buyer can still navigate from catalog to product detail', async ({ page }) => {
    const detail = await openProductDetail(page);
    expect(detail.productName.length).toBeGreaterThan(0);
  });
});
