import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { mapLabelSummaryDto } from '../../src/features/label/api/labelDashboardDtos';
import {
  mapOrderDetailDto,
  mapOrderEventsPayload,
} from '../../src/shared/api/orderDtos';
import { resolveFrontendPathFromTest } from '../helpers/repoPaths';

test.describe('workflow API contracts', () => {
  test('order mapper normalizes alternate status, payment, and event fields into canonical DTOs', () => {
    const detail = mapOrderDetailDto({
      orderId: 'ord-123',
      state: 'PENDING_PAYMENT',
      amount: 12.5,
      created_at: '2026-03-12T10:30:00.000Z',
      buyer_user_id: 'buyer-9',
      payment_attempt_id: 'att-5',
      paymentStatus: 'PROCESSING',
      orderItems: [
        {
          id: 'item-1',
          product_id: 'prod-1',
          variantId: 'var-1',
          quantity: '2',
          price: 4.5,
          variantSize: 'L',
          variantColor: 'Black',
          variantSku: 'SKU-1',
        },
      ],
    });

    expect(detail).toEqual({
      id: 'ord-123',
      status: 'placed',
      totalCents: 1250,
      createdAt: '2026-03-12T10:30:00.000Z',
      buyerUserId: 'buyer-9',
      payment: {
        paymentId: '',
        status: 'processing',
        provider: '',
        attemptId: 'att-5',
      },
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productVariantId: 'var-1',
          quantity: 2,
          priceCents: 450,
          size: 'L',
          color: 'Black',
          sku: 'SKU-1',
        },
      ],
      events: [],
    });

    expect(
      mapOrderEventsPayload({
        items: [
          { event: 'ORDER_CREATED', timestamp: '2026-03-12T10:30:00.000Z' },
          { action: 'PAYMENT_CAPTURED', created_at: '2026-03-12T10:31:00.000Z', message: 'Paid' },
        ],
      })
    ).toEqual([
      {
        type: 'placed',
        at: '2026-03-12T10:30:00.000Z',
        reason: '',
        note: '',
      },
      {
        type: 'paid',
        at: '2026-03-12T10:31:00.000Z',
        reason: '',
        note: 'Paid',
      },
    ]);
  });

  test('label dashboard mapper returns a canonical DTO', () => {
    expect(
      mapLabelSummaryDto({
        grossAllTimeCents: '4500',
        activeArtists30d: '2',
        artists: [{ id: 'artist-1', handle: 'artist-one', orders30d: '3' }],
      })
    ).toEqual({
      totalArtists: 1,
      activeArtists30d: 2,
      inactiveArtists: 0,
      totalGross: 4500,
      artists: [
        {
          artistId: 'artist-1',
          artistName: 'artist-one',
          orders30d: 3,
          gross30d: 0,
          units30d: 0,
          activeProductsCount: 0,
        },
      ],
    });
  });

  test('contract boundary files keep canonical DTO and endpoint rules obvious in source', () => {
    const artistRequestTypesPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'features',
      'admin',
      'artistRequests',
      'types.ts'
    );
    const artistRequestDtosPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'features',
      'admin',
      'artistRequests',
      'adminArtistRequestDtos.ts'
    );
    const adminProductsApiPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'features',
      'admin',
      'products',
      'adminProductsApi.ts'
    );
    const adminProductsDtosPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'features',
      'admin',
      'products',
      'adminProductsDtos.ts'
    );
    const ordersApiPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'shared',
      'api',
      'ordersApi.ts'
    );
    const paymentsApiPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'shared',
      'api',
      'paymentsApi.ts'
    );
    const paymentsFlowApiPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'shared',
      'api',
      'paymentsFlowApi.ts'
    );
    const adminOrdersApiPath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'shared',
      'api',
      'adminOrdersApi.ts'
    );

    const artistRequestTypesSource = readFileSync(artistRequestTypesPath, 'utf8');
    const artistRequestDtosSource = readFileSync(artistRequestDtosPath, 'utf8');
    const adminProductsApiSource = readFileSync(adminProductsApiPath, 'utf8');
    const adminProductsDtosSource = readFileSync(adminProductsDtosPath, 'utf8');
    const ordersSource = readFileSync(ordersApiPath, 'utf8');
    const paymentsSource = readFileSync(paymentsApiPath, 'utf8');
    const paymentsFlowSource = readFileSync(paymentsFlowApiPath, 'utf8');
    const adminOrdersSource = readFileSync(adminOrdersApiPath, 'utf8');

    expect(artistRequestTypesSource.includes("PLAN_TYPES = ['basic', 'advanced', 'premium'] as const")).toBe(true);
    expect(artistRequestDtosSource.includes('normalizeArtistRequestStatus')).toBe(true);
    expect(artistRequestDtosSource.includes("return 'basic';")).toBe(true);
    expect(adminProductsApiSource.includes('mapAdminProductDto')).toBe(true);
    expect(adminProductsApiSource.includes('normalizeProductItem')).toBe(false);
    expect(adminProductsApiSource.includes('normalizePendingRequestItem')).toBe(false);
    expect(adminProductsDtosSource.includes("status: 'pending' | 'rejected' | 'approved' | 'unknown'")).toBe(true);
    expect(ordersSource.includes('/actions/cancel')).toBe(false);
    expect(ordersSource.includes("method: 'PATCH'")).toBe(false);
    expect(paymentsSource.includes('/payments/order/')).toBe(false);
    expect(paymentsSource.includes('/payments/summary/order/')).toBe(false);
    expect(paymentsFlowSource.includes('/payments/start')).toBe(false);
    expect(paymentsFlowSource.includes('/payments/confirm')).toBe(false);
    expect(paymentsFlowSource.includes('/orders/${orderId}/pay')).toBe(true);
    expect(adminOrdersSource.includes('/actions/fulfill')).toBe(false);
    expect(adminOrdersSource.includes('/actions/refund')).toBe(false);
    expect(adminOrdersSource.includes("method: 'PATCH'")).toBe(false);
  });
});
