import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { loginAdmin } from '../helpers/auth';
import { gotoApp } from '../helpers/navigation';

type AdminOrderState = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  buyerUserId: string;
  payment: {
    paymentId: string;
    status: string;
    provider: string;
  };
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string;
    quantity: number;
    priceCents: number;
  }>;
};

const setupAdminOrderDetailMocks = async (page: Page, orderId: string) => {
  const corsHeaders = (route: any) => {
    const requestHeaders = route.request().headers();
    const origin = requestHeaders?.origin || 'http://localhost:5173';
    const requestedHeaders =
      requestHeaders?.['access-control-request-headers'] ||
      'authorization,content-type,accept';
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': requestedHeaders,
      Vary: 'Origin',
    };
  };

  const fulfillJson = async (route: any, status: number, payload: unknown) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: corsHeaders(route),
      body: JSON.stringify(payload),
    });
  };

  const state: AdminOrderState = {
    id: orderId,
    status: 'paid',
    totalCents: 4999,
    createdAt: '2026-03-01T10:15:00.000Z',
    buyerUserId: 'buyer-1',
    payment: {
      paymentId: 'pay-1',
      status: 'captured',
      provider: 'stripe',
    },
    items: [
      {
        id: 'line-1',
        productId: 'product-1',
        productVariantId: 'variant-1',
        quantity: 1,
        priceCents: 4999,
      },
    ],
  };

  const calls = {
    detail: 0,
    fulfill: 0,
    refund: 0,
  };

  await page.route(
    new RegExp(`/api/admin/orders/${orderId}/fulfill(?:[/?#]|$)`, 'i'),
    async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: corsHeaders(route),
          body: '',
        });
        return;
      }
      if (method !== 'POST') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      calls.fulfill += 1;
      state.status = 'fulfilled';
      await fulfillJson(route, 200, { ok: true, status: state.status });
    }
  );

  await page.route(
    new RegExp(`/api/admin/orders/${orderId}/refund(?:[/?#]|$)`, 'i'),
    async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: corsHeaders(route),
          body: '',
        });
        return;
      }
      if (method !== 'POST') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      calls.refund += 1;
      state.status = 'refunded';
      state.payment.status = 'refunded';
      await fulfillJson(route, 200, { ok: true, status: state.status });
    }
  );

  await page.route(
    new RegExp(`/api/admin/orders/${orderId}(?:[?#]|$)`, 'i'),
    async (route) => {
      const method = route.request().method().toUpperCase();
      if (method === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: corsHeaders(route),
          body: '',
        });
        return;
      }
      if (method !== 'GET') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      calls.detail += 1;
      await fulfillJson(route, 200, state);
    }
  );

  return calls;
};

test.describe('Admin order detail actions', () => {
  test('fulfill and refund actions transition status in UI', async ({ page }) => {
    const orderId = 'order-ui-actions-1';
    const calls = await setupAdminOrderDetailMocks(page, orderId);

    await loginAdmin(page, { returnTo: `/partner/admin/orders/${orderId}` });
    await gotoApp(page, `/partner/admin/orders/${orderId}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /order detail/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId('admin-order-status')).toContainText(/paid/i);

    const fulfillResponse = page.waitForResponse(
      (response) =>
        new RegExp(`/api/admin/orders/${orderId}/fulfill(?:[/?#]|$)`, 'i').test(response.url()) &&
        response.request().method().toUpperCase() === 'POST' &&
        response.status() === 200,
      { timeout: 10000 }
    );
    await page.getByTestId('admin-order-fulfill').click();
    await fulfillResponse;
    await expect.poll(() => calls.fulfill, { timeout: 10000 }).toBe(1);
    await expect(
      page.getByText(/order fulfillment requested successfully/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('admin-order-status')).toContainText(/fulfilled/i);

    const refundResponse = page.waitForResponse(
      (response) =>
        new RegExp(`/api/admin/orders/${orderId}/refund(?:[/?#]|$)`, 'i').test(response.url()) &&
        response.request().method().toUpperCase() === 'POST' &&
        response.status() === 200,
      { timeout: 10000 }
    );
    await page.getByTestId('admin-order-refund').click();
    await refundResponse;
    await expect.poll(() => calls.refund, { timeout: 10000 }).toBe(1);
    await expect(page.getByText(/refund transaction initiated/i).first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('admin-order-status')).toContainText(/refunded/i);
    await expect(page.getByTestId('admin-order-refund')).toBeDisabled();
    await expect(calls.detail).toBeGreaterThanOrEqual(3);
  });
});
