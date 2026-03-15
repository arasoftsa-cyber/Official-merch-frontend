import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolveFrontendPathFromTest } from '../helpers/repoPaths';

const readSource = (testFile: string, ...segments: string[]) =>
  readFileSync(resolveFrontendPathFromTest(testFile, ...segments), 'utf8');

test.describe('shared transport contracts', () => {
  test('ApplyArtistPage uses canonical shared transport helpers only', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'onboarding',
      'pages',
      'ApplyArtistPage.tsx'
    );

    expect(source.includes('apiFetchForm(')).toBe(true);
    expect(source.includes("apiFetch('/artist-access-requests'")).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });

  test('ArtistProductsPage status toggles use shared transport and no inline fetch', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'artist',
      'pages',
      'ArtistProductsPage.tsx'
    );

    expect(source.includes("apiFetch(`/products/${productId}/status`")).toBe(true);
    expect(source.includes("apiFetch(`/products/${productId}`")).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });

  test('BuyerOrderDetailPage keeps canonical shared transport usage', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'buyer',
      'pages',
      'BuyerOrderDetailPage.tsx'
    );

    expect(source.includes('getOrder(orderId)')).toBe(true);
    expect(source.includes('getOrderEvents(orderId)')).toBe(true);
    expect(source.includes('cancelOrderRequest(id)')).toBe(true);
    expect(source.includes('startPayment(id)')).toBe(true);
    expect(source.includes('apiFetch(`/api/payments/mock/confirm/${attemptId}`')).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });

  test('ArtistProductVariantsPage uses shared transport for load, save, and delete flows', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'artist',
      'pages',
      'ArtistProductVariantsPage.tsx'
    );

    expect(source.includes("apiFetch(`/products/${id}`")).toBe(true);
    expect(source.includes("apiFetch(`/products/${id}/variants`")).toBe(true);
    expect(source.includes("apiFetch(`/product-variants/${variantId}`")).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });

  test('BuyerOrdersPage uses shared transport for authenticated order listing', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'buyer',
      'pages',
      'BuyerOrdersPage.tsx'
    );

    expect(source.includes('apiFetch("/orders/my")')).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });

  test('AdminLeadsPage uses shared transport for list and mutation flows', () => {
    const source = readSource(
      test.info().file,
      'src',
      'features',
      'admin',
      'pages',
      'AdminLeadsPage.tsx'
    );

    expect(source.includes("apiFetch('/admin/leads'")).toBe(true);
    expect(source.includes('apiFetch(`/admin/leads/${selectedRow.id}`')).toBe(true);
    expect(source.includes("apiFetch('/artist-access-requests'")).toBe(true);
    expect(source.includes('await fetch(')).toBe(false);
  });
});
