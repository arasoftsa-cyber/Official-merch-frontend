import { expect, test } from '@playwright/test';
import { PLAN_TYPES } from '../../src/features/admin/artistRequests/types';
import {
  isPremiumEnabledFromConfig,
  normalizeArtistRequestStatus,
  normalizePlan,
  parseAdminArtistRequestsResponse,
} from '../../src/features/admin/artistRequests/adminArtistRequestDtos';
import {
  mapAdminProductDto,
  parseAdminProductDetailPayload,
  parseAdminProductPhotoUpdateResponse,
  parseAdminProducts,
  parsePendingMerchRequests,
} from '../../src/features/admin/products/adminProductsDtos';
import {
  mapOrderDetailDto,
  mapOrderEventsPayload,
} from '../../src/shared/api/orderDtos';
import { getArtistInitials, resolveMediaUrl } from '../../src/shared/utils/media';
import {
  createApiContractError,
  readArrayEnvelope,
} from '../../src/shared/api/contract';
import { parseStartPaymentResponse } from '../../src/shared/api/paymentsFlowDtos';
import { normalizePayload } from '../../src/features/catalog/product-detail/ProductDetail.model';
import { parseDropPayload, parseDropProductsPayload } from '../../src/pages/DropPage.model';
import {
  parseAdminDropHeroUploadResponse,
  parseAdminDropItems,
} from '../../src/features/admin/drops/adminDropsDtos';
import { mapLabelSummaryDto } from '../../src/features/label/api/labelDashboardDtos';
import {
  buildCancelOrderRequest,
  buildConfirmPaymentRequest,
  buildFulfillAdminOrderRequest,
  buildGetAdminOrderPath,
  buildGetOrderEventsPath,
  buildGetOrderPath,
  buildGetOrderPaymentPath,
  buildRefundAdminOrderRequest,
  buildStartPaymentRequest,
} from '../../src/shared/api/workflowRequestBuilders';

const endsWithPath = (value: string | null | undefined, suffix: string) =>
  String(value || '').endsWith(suffix);

test.describe('workflow API contracts', () => {
  test('order mapper normalizes canonical and narrowly supported legacy fields into canonical DTOs', () => {
    const detail = mapOrderDetailDto({
      id: 'ord-123',
      state: 'PENDING_PAYMENT',
      totalCents: 1250,
      createdAt: '2026-03-12T10:30:00.000Z',
      buyerUserId: 'buyer-9',
      paymentStatus: 'PROCESSING',
      orderItems: [
        {
          id: 'item-1',
          productId: 'prod-1',
          productVariantId: 'var-1',
          quantity: '2',
          priceCents: 450,
          size: 'L',
          color: 'Black',
          sku: 'SKU-1',
        },
      ],
      paymentAttemptId: 'att-5',
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
          { event: 'ORDER_CREATED', created_at: '2026-03-12T10:30:00.000Z' },
          { type: 'PAYMENT_CAPTURED', created_at: '2026-03-12T10:31:00.000Z', message: 'Paid' },
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

  test('contract drift beyond the allowed envelopes fails with controlled errors', () => {
    expect(() => mapOrderDetailDto({ data: { id: 'ord-123' } })).toThrow(/canonical id|missing/i);
    expect(() => mapOrderEventsPayload({ rows: [] })).toThrow(/items/i);
    expect(() => parseStartPaymentResponse({ id: 'att-1', status: 'pending' })).toThrow(/attemptId/i);
  });

  test('payments keep canonical DTO outputs', () => {
    expect(
      parseStartPaymentResponse({
        attemptId: 'att-7',
        status: 'pending',
        provider: 'mock',
      })
    ).toEqual({
      attemptId: 'att-7',
      raw: {
        attemptId: 'att-7',
        status: 'pending',
        provider: 'mock',
      },
    });
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

  test('artist request contracts normalize status, plans, socials, and items envelopes', () => {
    expect(PLAN_TYPES).toEqual(['basic', 'advanced', 'premium']);
    expect(normalizeArtistRequestStatus('APPROVED')).toBe('approved');
    expect(normalizeArtistRequestStatus('weird')).toBe('pending');
    expect(normalizePlan('PREMIUM')).toBe('premium');
    expect(normalizePlan('vip')).toBe('basic');
    expect(
      parseAdminArtistRequestsResponse(
        {
          items: [
            {
              id: 'req-1',
              created_at: '2026-03-16T10:00:00.000Z',
              status: 'APPROVED',
              artist_name: 'Artist One',
              handle: 'artist-one',
              email: 'artist@example.com',
              phone: '123456789',
              socials: { instagram: 'https://instagram.com/artist-one' },
              requested_plan_type: 'vip',
            },
          ],
          total: 1,
          page: 2,
        },
        1
      )
    ).toEqual({
      items: [
        {
          id: 'req-1',
          createdAt: '2026-03-16T10:00:00.000Z',
          status: 'approved',
          source: 'artist_access_request',
          artistName: 'Artist One',
          handle: 'artist-one',
          email: 'artist@example.com',
          phone: '123456789',
          socials: [
            {
              platform: 'instagram',
              profileLink: 'https://instagram.com/artist-one',
            },
          ],
          aboutMe: '',
          profilePhotoUrl: '',
          messageForFans: '',
          requestedPlanType: 'basic',
          rejectionComment: '',
        },
      ],
      total: 1,
      page: 2,
    });
    expect(isPremiumEnabledFromConfig({ enabled_plan_types: ['basic', 'PREMIUM'] })).toBe(true);
    expect(() => parseAdminArtistRequestsResponse({ rows: [] }, 1)).toThrow(/items/i);
  });

  test('admin product contracts keep canonical photo and pending-merch normalization behavior', () => {
    const canonicalMapped = mapAdminProductDto({
      id: 'prod-1',
      product_id: 'prod-1',
      title: 'Launch Tee',
      listingPhotoUrls: ['/catalog/a.png'],
      listing_photo_urls: ['/catalog/ignored.png'],
      primaryPhotoUrl: '/catalog/primary.png',
      status: 'pending',
      sku_types: ['hoodie'],
      design_image_url: '/design.png',
    });

    const legacyMapped = mapAdminProductDto({
      id: 'prod-legacy',
      title: 'Legacy Tee',
      listing_photos: ['/catalog/legacy.png'],
      primaryPhotoUrl: '/catalog/primary.png',
    });

    expect(canonicalMapped?.listingPhotoUrls.some((entry) => endsWithPath(entry, '/catalog/a.png'))).toBe(
      true
    );
    expect(canonicalMapped?.listingPhotoUrls.some((entry) => endsWithPath(entry, '/catalog/primary.png'))).toBe(
      true
    );
    expect(
      canonicalMapped?.listingPhotoUrls.some((entry) => endsWithPath(entry, '/catalog/ignored.png'))
    ).toBe(false);
    expect(canonicalMapped?.skuTypes).toEqual(['hoodie']);
    expect(endsWithPath(canonicalMapped?.designImageUrl, '/design.png')).toBe(true);
    expect(legacyMapped?.listingPhotoUrls.some((entry) => endsWithPath(entry, '/catalog/legacy.png'))).toBe(
      true
    );

    expect(
      parsePendingMerchRequests({
        items: [{ id: 'prod-2', title: 'Mystery Tee', status: 'unexpected-status' }],
      })[0]?.status
    ).toBe('unknown');

    expect(
      parseAdminProducts({
        items: [{ id: 'prod-3', title: 'Approved Tee', listingPhotoUrls: ['/catalog/live.png'] }],
      })[0]?.id
    ).toBe('prod-3');

    expect(
      parseAdminProductDetailPayload({ product: { id: 'prod-4', title: 'Detail Tee' } })
    ).toMatchObject({
      id: 'prod-4',
      title: 'Detail Tee',
    });

    const photoUrls = parseAdminProductPhotoUpdateResponse({
      listingPhotoUrls: ['/catalog/one.png', 'https://cdn.example.com/two.png'],
    });
    expect(photoUrls.some((entry) => endsWithPath(entry, '/catalog/one.png'))).toBe(true);
    expect(photoUrls).toContain('https://cdn.example.com/two.png');
    expect(() => parseAdminProductPhotoUpdateResponse({ photos: [] })).toThrow(/listingPhotoUrls/i);
  });

  test('product detail, drop, and media contracts prefer canonical payloads and reject dangerous inputs', () => {
    expect(
      normalizePayload(
        {
          product: {
            id: 'prod-10',
            title: 'Poster',
            listing_photos: ['/catalog/listing.png'],
            photoUrls: ['/catalog/ignored-photo-urls.png'],
            photos: ['/catalog/ignored-photos.png'],
            variants: [
              {
                id: 'var-1',
                size: 'M',
                color: 'Black',
                price_cents: 1999,
                stock: 7,
              },
            ],
          },
        },
        'fallback-id'
      )
    ).toEqual({
      product: {
        id: 'prod-10',
        title: 'Poster',
        description: undefined,
        priceCents: undefined,
        listingPhotoUrls: [expect.stringMatching(/\/catalog\/listing\.png$/)],
      },
      variants: [
        {
          id: 'var-1',
          sku: undefined,
          size: 'M',
          color: 'Black',
          priceCents: 1999,
          stock: 7,
          effectiveSellable: undefined,
          effectiveIsActive: undefined,
          skuIsActive: undefined,
          variantIsListed: undefined,
        },
      ],
    });

    expect(
      parseDropPayload({
        drop: {
          id: 'drop-1',
          handle: 'summer-drop',
          title: 'Summer Drop',
          coverUrl: '/drops/summer.png',
        },
      })
    ).toMatchObject({
      id: 'drop-1',
      handle: 'summer-drop',
      title: 'Summer Drop',
      heroImageUrl: expect.stringMatching(/\/drops\/summer\.png$/),
    });

    expect(() => parseDropPayload({ drop: { id: 'drop-1', title: 'Broken Drop' } })).toThrow(
      /canonical id, handle, or title/i
    );

    expect(
      parseDropProductsPayload({
        items: [{ id: 'prod-1', title: 'Drop Product' }, { id: '', title: 'Broken' }],
      })
    ).toEqual([{ id: 'prod-1', title: 'Drop Product' }]);

    expect(resolveMediaUrl('data:text/plain,hello')).toBeNull();
    expect(resolveMediaUrl('blob:abc')).toBeNull();
    expect(resolveMediaUrl('javascript:alert(1)')).toBeNull();
    expect(resolveMediaUrl('/uploads/artist.png')).toEqual(expect.stringMatching(/\/uploads\/artist\.png$/));
    expect(getArtistInitials('artist one')).toBe('AO');
  });

  test('admin drops and contract helpers enforce canonical envelopes and error metadata', () => {
    expect(
      parseAdminDropItems({
        items: [
          {
            id: 'drop-1',
            title: 'Drop One',
            handle: 'drop-one',
            hero_image_url: '/drops/ignored.png',
          },
        ],
      })[0]
    ).toMatchObject({
      id: 'drop-1',
      title: 'Drop One',
      handle: 'drop-one',
      heroImageUrl: null,
    });

    expect(
      parseAdminDropHeroUploadResponse({
        heroImageUrl: '/drops/uploaded.png',
      })
    ).toEqual(expect.stringMatching(/\/drops\/uploaded\.png$/));
    expect(() => parseAdminDropHeroUploadResponse({ hero_image_url: '/drops/ignored.png' })).toThrow(
      /heroImageUrl/i
    );
    expect(() => readArrayEnvelope({ rows: [] }, 'items', 'demo.domain')).toThrow(/items/i);

    const error = createApiContractError('payments.start', 'Broken payload');
    expect(error.name).toBe('ApiContractError');
    expect(error.code).toBe('api_contract_error');
    expect(error.domain).toBe('payments.start');
    expect(error.message).toBe('Broken payload');
  });

  test('order and payment API request builders keep canonical routes and verbs', () => {
    expect(buildGetOrderPath('ord-1')).toBe('/orders/ord-1');
    expect(buildGetOrderEventsPath('ord-1')).toBe('/orders/ord-1/events');
    expect(buildCancelOrderRequest('ord-1')).toEqual({
      path: '/orders/ord-1/cancel',
      method: 'POST',
    });

    expect(buildGetOrderPaymentPath('ord-1')).toBe('/orders/ord-1/payment');

    expect(buildStartPaymentRequest('ord-1')).toEqual({
      path: '/orders/ord-1/pay',
      method: 'POST',
    });
    expect(buildConfirmPaymentRequest('ord-1')).toEqual({
      path: '/orders/ord-1/pay/confirm',
      method: 'POST',
    });
    expect(buildConfirmPaymentRequest('ord-1', 'att-1')).toEqual({
      path: '/payments/attempts/att-1/confirm',
      method: 'POST',
    });

    expect(buildGetAdminOrderPath('ord-1')).toBe('/admin/orders/ord-1');
    expect(buildFulfillAdminOrderRequest('ord-1')).toEqual({
      path: '/admin/orders/ord-1/fulfill',
      method: 'POST',
    });
    expect(buildRefundAdminOrderRequest('ord-1')).toEqual({
      path: '/admin/orders/ord-1/refund',
      method: 'POST',
    });
  });
});
