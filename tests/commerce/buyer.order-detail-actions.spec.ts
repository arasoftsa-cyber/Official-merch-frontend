import type { Page } from '@playwright/test';
import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/auth';

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

test.describe('Buyer order detail actions', () => {
  test('cancel action updates status and keeps UX readable', async ({ buyerPage }) => {
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
