import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from '../helpers/navigation';
import { loginAdmin } from '../helpers/auth';

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+tmk8AAAAASUVORK5CYII=';

const mockArtists = [
  { id: 'artist-1', name: 'Artist One' },
  { id: 'artist-2', name: 'Artist Two' },
];

const mockSkus = [
  {
    id: 'sku-1',
    supplier_sku: 'CATALOG-TEE-BLK-M',
    merch_type: 'Round Neck',
    quality_tier: 'Premium',
    color: 'Black',
    size: 'M',
    stock: 12,
    is_active: true,
    mrp_cents: 1999,
  },
  {
    id: 'sku-2',
    supplier_sku: 'CATALOG-TEE-WHT-L',
    merch_type: 'Round Neck',
    quality_tier: null,
    color: 'White',
    size: 'L',
    stock: 7,
    is_active: true,
    mrp_cents: 2499,
  },
];

const registerBaseRoutes = async (page: Page, skus: any[] = mockSkus) => {
  await page.route('**/api/artists**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ artists: mockArtists }),
    });
  });

  await page.route('**/api/admin/inventory-skus**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: skus }),
    });
  });
};

const uploadFourListingPhotos = async (page: Page) => {
  const buffer = Buffer.from(TINY_PNG_BASE64, 'base64');
  await page.getByTestId('admin-product-listing-photos').setInputFiles([
    { name: 'listing-1.png', mimeType: 'image/png', buffer },
    { name: 'listing-2.png', mimeType: 'image/png', buffer },
    { name: 'listing-3.png', mimeType: 'image/png', buffer },
    { name: 'listing-4.png', mimeType: 'image/png', buffer },
  ]);
};

const fillBasicForm = async (page: Page) => {
  await page.getByTestId('admin-product-merch-name').fill('SKU Linked Tee');
  await page.getByTestId('admin-product-merch-story').fill(
    'Product story long enough for validation.'
  );
  await uploadFourListingPhotos(page);
};

test.describe('Admin create product SKU flow', () => {
  test('removes legacy color/economics fields and renders SKU selector', async ({ page }) => {
    await registerBaseRoutes(page);
    await loginAdmin(page, { returnTo: '/partner/admin/products/new' });
    await gotoApp(page, '/partner/admin/products/new', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('admin-product-vendor-pay')).toHaveCount(0);
    await expect(page.getByTestId('admin-product-our-share')).toHaveCount(0);
    await expect(page.getByTestId('admin-product-royalty')).toHaveCount(0);
    await expect(page.getByText('Available Colors')).toHaveCount(0);

    await expect(page.getByTestId('admin-product-sku-search')).toBeVisible();
    await expect(page.getByTestId('admin-product-sku-select')).toBeVisible();
    await expect(page.getByTestId('admin-product-sku-add')).toBeVisible();
  });

  test('requires at least one SKU before submit', async ({ page }) => {
    let createCalls = 0;
    await registerBaseRoutes(page);
    await loginAdmin(page, { returnTo: '/partner/admin/products/new' });

    await page.route('**/api/admin/products', async (route) => {
      if (route.request().method() === 'POST') createCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await gotoApp(page, '/partner/admin/products/new', { waitUntil: 'domcontentloaded' });
    await fillBasicForm(page);

    await page.getByTestId('admin-product-submit').click();

    await expect(page.getByText('Select at least one SKU.')).toBeVisible();
    expect(createCalls).toBe(0);
  });

  test('selecting SKUs updates state and submit links selected SKUs', async ({ page }) => {
    let createPayload: any = null;
    let linkPayload: any = null;
    let photoUploadCalled = 0;

    await registerBaseRoutes(page);
    await loginAdmin(page, { returnTo: '/partner/admin/products/new' });

    await page.route('**/api/admin/products', async (route) => {
      if (route.request().method() === 'POST') {
        createPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            productId: 'product-1',
            product: { id: 'product-1' },
            defaultVariant: { id: 'variant-default-1' },
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/admin/products/*/variants', async (route) => {
      if (route.request().method() === 'PUT') {
        linkPayload = route.request().postDataJSON();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ variants: [] }),
      });
    });

    await page.route('**/api/admin/products/*/photos', async (route) => {
      photoUploadCalled += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          listingPhotoUrls: [
            '/uploads/products/a.png',
            '/uploads/products/b.png',
            '/uploads/products/c.png',
            '/uploads/products/d.png',
          ],
        }),
      });
    });

    await gotoApp(page, '/partner/admin/products/new', { waitUntil: 'domcontentloaded' });
    await fillBasicForm(page);

    await page.getByTestId('admin-product-sku-select').selectOption('sku-1');
    await page.getByTestId('admin-product-sku-add').click();
    await page.getByTestId('admin-product-sku-select').selectOption('sku-2');
    await page.getByTestId('admin-product-sku-add').click();

    await expect(page.getByTestId('admin-product-selected-sku')).toHaveCount(2);
    await expect(page.getByTestId('admin-product-selected-sku').first()).toContainText(
      'CATALOG-TEE-BLK-M'
    );

    await page.getByTestId('admin-product-submit').click();

    await expect
      .poll(() => (createPayload ? 1 : 0), { timeout: 5000 })
      .toBe(1);
    await expect
      .poll(() => (linkPayload ? 1 : 0), { timeout: 5000 })
      .toBe(1);
    await expect
      .poll(() => photoUploadCalled, { timeout: 5000 })
      .toBe(1);

    expect(createPayload.vendor_pay).toBeUndefined();
    expect(createPayload.our_share).toBeUndefined();
    expect(createPayload.royalty).toBeUndefined();
    expect(createPayload.colors).toBeUndefined();

    expect(Array.isArray(linkPayload.variants)).toBe(true);
    expect(linkPayload.variants).toHaveLength(2);
    expect(linkPayload.variants[0].id).toBe('variant-default-1');
    expect(linkPayload.variants[0].inventory_sku_id).toBe('sku-1');
    expect(linkPayload.variants[1].inventory_sku_id).toBe('sku-2');
  });

  test('shows readable empty state when no SKUs are available', async ({ page }) => {
    await registerBaseRoutes(page, []);
    await loginAdmin(page, { returnTo: '/partner/admin/products/new' });
    await gotoApp(page, '/partner/admin/products/new', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('admin-product-sku-empty-state')).toBeVisible();
    await expect(page.getByTestId('admin-product-sku-empty-state')).toContainText(
      'No supplier SKUs available yet. Create SKUs first in the SKU manager.'
    );
  });
});
