import { test, expect } from '../helpers/session';
import type { Page } from '@playwright/test';
import { gotoApp } from '../helpers/auth';
import { cartLinkInHeader, getProductCards } from '../helpers/assertions';

const PRICE_OR_UNAVAILABLE_RE = /price unavailable|\b\S*[0-9]+(?:[.,][0-9]{2})?\b/i;

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

const setupBuyerOrderDetailMocks = async (page: Page, orderId: string) => {
  const state = {
    id: orderId,
    status: 'placed',
    totalCents: 2999,
    payment: { status: 'paid' },
    items: [],
    createdAt: '2026-03-01T08:00:00.000Z',
  };

  const calls = {
    detail: 0,
    events: 0,
    cancel: 0,
  };

  await page.route(/\/api\/orders\/[^?#]+(?:[?#].*)?$/i, async (route) => {
    const method = route.request().method().toUpperCase();
    const url = new URL(route.request().url());
    const path = url.pathname.toLowerCase();
    const base = `/api/orders/${orderId}`.toLowerCase();

    if (path === `${base}/events`) {
      if (method !== 'GET') {
        await route.fulfill({
          status: 405,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'method_not_allowed' }),
        });
        return;
      }
      calls.events += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (path === `${base}/cancel`) {
      if (method !== 'POST') {
        await route.fulfill({
          status: 405,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'method_not_allowed' }),
        });
        return;
      }
      calls.cancel += 1;
      state.status = 'cancelled';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, status: 'cancelled' }),
      });
      return;
    }

    if (path === base && method === 'GET') {
      calls.detail += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state),
      });
      return;
    }

    await route.fallback();
  });

  return calls;
};

test.describe('Buyer catalog and checkout', () => {
  test('buyer can browse the storefront, open a product, add it to cart, and reach the cart summary', async ({
    buyerPage,
  }) => {
    const { productName } = await openProductDetail(buyerPage);

    await expect(buyerPage.getByText(PRICE_OR_UNAVAILABLE_RE).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(buyerPage.locator('select#variant-select')).toHaveCount(0);
    await expect(buyerPage.getByRole('button', { name: /create order/i })).toHaveCount(0);

    await buyerPage.getByRole('button', { name: /^add to cart$/i }).click();
    await expect(cartLinkInHeader(buyerPage).first()).toContainText('1', { timeout: 10000 });
    await cartLinkInHeader(buyerPage).first().click();

    await expect(buyerPage).toHaveURL(/\/cart(?:[/?#]|$)/i, { timeout: 15000 });
    await expect(buyerPage.getByRole('heading', { name: /^cart$/i })).toBeVisible({ timeout: 15000 });
    const escapedProductName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(buyerPage.getByText(new RegExp(escapedProductName, 'i')).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(buyerPage.getByRole('button', { name: /^checkout$/i })).toBeVisible({
      timeout: 15000,
    });
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

  test('buyer can cancel an order from order detail and see the updated state', async ({
    buyerPage,
  }) => {
    const orderId = 'order-buyer-actions-1';
    const calls = await setupBuyerOrderDetailMocks(buyerPage, orderId);

    await gotoApp(buyerPage, `/fan/orders/${orderId}`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(buyerPage.getByTestId('order-status')).toContainText(/placed/i, {
      timeout: 15000,
    });

    await buyerPage.getByTestId('order-cancel').click();

    const confirmButton = buyerPage.getByRole('button', { name: /^confirm$/i }).first();
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    await expect.poll(() => calls.cancel, { timeout: 10000 }).toBe(1);
    await expect(buyerPage.getByText(/order cancelled/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(buyerPage.getByTestId('order-status')).toContainText(/cancelled/i);
    await expect(calls.detail).toBeGreaterThanOrEqual(2);
  });
});
