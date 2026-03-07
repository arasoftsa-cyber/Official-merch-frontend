import { test, expect, Locator, Page, APIResponse } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, LABEL_EMAIL, LABEL_PASSWORD } from './_env';
import { gotoApp, loginAdmin, loginLabel } from './helpers/auth';
import { getApiUrl } from './helpers/urls';
import path from 'path';

async function waitForSelectReady(page: Page, testId: string, timeout = 15000): Promise<Locator> {
  const select = page.getByTestId(testId);
  await expect(select).toBeVisible({ timeout });

  await expect
    .poll(
      async () => {
        const disabled = await select.isDisabled().catch(() => true);
        if (disabled) return false;

        const readiness = await select.evaluate((el) => {
          const s = el as HTMLSelectElement;
          const options = Array.from(s.options).map((o) => ({
            value: (o.value || '').trim(),
            text: (o.textContent || '').trim().toLowerCase(),
          }));
          const realOptions = options.filter((o) => {
            if (!o.value || o.value === '0') return false;
            if (/^(select|choose|loading)\b/.test(o.text)) return false;
            if (o.text.includes('select artist')) return false;
            return true;
          });
          return {
            count: options.length,
            realCount: realOptions.length,
          };
        });

        return readiness.count >= 2 || readiness.realCount >= 1;
      },
      { timeout }
    )
    .toBe(true);

  return select;
}

async function selectFirstRealOption(select: Locator) {
  await expect(select).toBeVisible();
  await expect(select).toBeEnabled();

  const options = await select.evaluate((el) => {
    const s = el as HTMLSelectElement;
    return Array.from(s.options).map((o) => ({
      value: o.value,
      text: (o.textContent || "").trim(),
    }));
  });

  const pick = options.find((o) => {
    const v = (o.value || "").trim();
    const t = (o.text || "").trim().toLowerCase();
    if (!v || v === "0") return false;
    if (/^(select|choose|loading)\b/.test(t)) return false;
    if (t.includes("select artist")) return false;
    return true;
  });

  if (!pick) throw new Error("No selectable Artist options found (only placeholder).");

  await select.selectOption({ value: pick.value });

  const selectedValue = await select.inputValue();
  if (!selectedValue || selectedValue === "0") {
    throw new Error(`Artist select did not change value (still '${selectedValue}')`);
  }
};

const fillIfEmpty = async (input: Locator, value: string) => {
  const current = (await input.inputValue().catch(() => '')).trim();
  if (!current) {
    await input.fill(value);
  }
};

const pickFirstVisible = async (
  candidates: Locator[],
  description: string
): Promise<Locator> => {
  for (const candidate of candidates) {
    if ((await candidate.count().catch(() => 0)) === 0) continue;
    if (!(await candidate.first().isVisible().catch(() => false))) continue;
    return candidate.first();
  }
  throw new Error(`Unable to find visible ${description}`);
};

const selectMerchTypeTshirt = async (page: Page) => {
  const merchType = await pickFirstVisible(
    [
      page.getByTestId('admin-product-merch-type'),
      page.getByLabel(/merch type/i),
    ],
    'merch type control'
  );
  await expect(merchType).toBeVisible({ timeout: 10000 });

  const merchTypeTag = await merchType
    .evaluate((el) => (el as HTMLElement).tagName.toLowerCase())
    .catch(() => '');

  if (merchTypeTag === 'select') {
    await merchType.selectOption({ value: 'tshirt' }).catch(() => null);
    const selectedAfterTshirt = (await merchType.inputValue().catch(() => '')).trim().toLowerCase();
    if (selectedAfterTshirt !== 'tshirt') {
      const fallback = await merchType.locator('option').evaluateAll((nodes) => {
        const options = nodes
          .map((node, index) => ({
            index,
            value: ((node as HTMLOptionElement).value || '').trim(),
            text: ((node.textContent || '').trim()).toLowerCase(),
          }))
          .filter((entry) => entry.value);
        const nonPlaceholder = options.find(
          (entry) => !/^(select|choose|loading)\b/.test(entry.text) && entry.value !== '0'
        );
        return nonPlaceholder || null;
      });
      if (fallback) {
        if (fallback.value) {
          await merchType.selectOption({ value: fallback.value });
        } else {
          await merchType.selectOption({ index: fallback.index });
        }
      }
    }
    await expect
      .poll(async () => (await merchType.inputValue().catch(() => '')).trim(), { timeout: 5000 })
      .not.toBe('');
    return;
  }

  await merchType.click();
  const tshirtOption = page.getByRole('option', { name: /t[\s_-]*shirt/i }).first();
  if ((await tshirtOption.count().catch(() => 0)) > 0) {
    await expect(tshirtOption).toBeVisible({ timeout: 5000 });
    await tshirtOption.click();
  } else {
    const tshirtTextOption = page.locator('[role="listbox"]').getByText(/t[\s_-]*shirt/i).first();
    await expect(tshirtTextOption).toBeVisible({ timeout: 5000 });
    await tshirtTextOption.click();
  }

  await expect
    .poll(
      async () => {
        const value = await merchType.inputValue().catch(() => '');
        const text = ((await merchType.textContent().catch(() => '')) || '').trim();
        return `${value} ${text}`;
      },
      { timeout: 5000 }
    )
    .toMatch(/t[\s_-]*shirt/i);
};

const findRowByTextWithRetry = async (
  page: Page,
  text: string,
  { attempts = 6, delayMs = 500 }: { attempts?: number; delayMs?: number } = {}
) => {
  for (let i = 0; i < attempts; i += 1) {
    await applySearchIfPresent(page, text);

    const row = page.locator('table tbody tr').filter({ hasText: text }).first();
    if ((await row.count()) > 0) {
      await expect(row).toBeVisible({ timeout: 10000 });
      return row;
    }
    if (i < attempts - 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(delayMs);
    }
  }

  throw new Error(`Row not found after ${attempts} attempts for text: ${text}`);
};

const applySearchIfPresent = async (page: Page, text: string) => {
  if (/\/partner\/admin\/products(?:\/|$)/i.test(page.url())) {
    const createButton = page.getByRole('button', { name: /create product|launch product/i });
    const createLink = page.getByRole('link', { name: /create product|launch product/i });
    const createAction =
      (await createButton.count().catch(() => 0)) > 0 ? createButton.first() : createLink.first();
    const hasCreateAction = await createAction.isVisible().catch(() => false);
    if (hasCreateAction) {
      const filterBar = createAction.first().locator('..').locator('..');
      const preferredInBar = [
        filterBar.getByPlaceholder(/title/i).first(),
        filterBar.getByPlaceholder(/search/i).first(),
        filterBar.getByRole('textbox', { name: /title|search/i }).first(),
      ];

      let titleFilterInput: Locator | null = null;
      for (const candidate of preferredInBar) {
        if ((await candidate.count().catch(() => 0)) === 0) continue;
        if (!(await candidate.isVisible().catch(() => false))) continue;
        titleFilterInput = candidate;
        break;
      }

      if (!titleFilterInput) {
        const textboxes = filterBar.getByRole('textbox');
        const textboxCount = await textboxes.count().catch(() => 0);
        for (let i = 0; i < textboxCount; i += 1) {
          const candidate = textboxes.nth(i);
          if (!(await candidate.isVisible().catch(() => false))) continue;
          titleFilterInput = candidate;
          break;
        }
      }

      if (titleFilterInput) {
        await titleFilterInput.fill('');
        await titleFilterInput.fill(text);
        await titleFilterInput.press('Enter').catch(() => null);
        await page.waitForTimeout(300);
        return true;
      }
    }
  }

  const candidates = [
    page.getByPlaceholder(/search/i).first(),
    page.getByRole('textbox', { name: /search/i }).first(),
    page
      .locator('input[type="search"], input[type="text"][name*="search" i], input[type="text"][id*="search" i]')
      .first(),
  ];
  for (const input of candidates) {
    if ((await input.count().catch(() => 0)) === 0) continue;
    if (!(await input.isVisible().catch(() => false))) continue;
    await input.fill(text);
    await input.press('Enter').catch(() => null);
    await page.waitForTimeout(300);
    return true;
  }
  return false;
};

const SMOKE_PRODUCT_TITLE = 'UI Smoke Purchasable Product';

const getListingPhotoFixtures = () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures');
  return [
    path.join(fixturesDir, 'listing-photo-1.png'),
    path.join(fixturesDir, 'listing-photo-2.png'),
    path.join(fixturesDir, 'listing-photo-3.png'),
    path.join(fixturesDir, 'listing-photo-4.png'),
  ];
};

const readResponseSnippet = async (response: APIResponse) =>
  (await response.text().catch(() => '<response unavailable>')).replace(/\s+/g, ' ').trim().slice(0, 500);

const parseProductId = (payload: any): string => {
  const candidate =
    payload?.productId ||
    payload?.product?.id ||
    payload?.id ||
    null;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : '';
};

const readAdminProducts = async (page: Page): Promise<any[]> => {
  const response = await page.request.get(getApiUrl('/api/admin/products'), {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok()) return [];
  const payload = await response.json().catch(() => null);
  const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
  return items;
};

const findSmokeProductIdInList = (items: any[]): string => {
  const matching = items.find(
    (item) =>
      String(item?.title || '').trim().toLowerCase() === SMOKE_PRODUCT_TITLE.toLowerCase()
  );
  const productId = String(matching?.productId || matching?.id || '').trim();
  return productId;
};

const ensureSmokeProductForAdminEdit = async (page: Page): Promise<string> => {
  const setupErrors: string[] = [];

  const existingProducts = await readAdminProducts(page);
  const existingProductId = findSmokeProductIdInList(existingProducts);
  if (existingProductId) {
    await page.request.patch(getApiUrl(`/api/admin/products/${existingProductId}`), {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      data: { isActive: true },
    }).catch(() => null);
    return existingProductId;
  }

  const devSeedResponse = await page.request.post(getApiUrl('/api/dev/seed-ui-smoke-product'), {
    headers: { Accept: 'application/json' },
  });
  if (devSeedResponse.ok()) {
    const payload = await devSeedResponse.json().catch(() => null);
    const seededProductId = parseProductId(payload);
    if (seededProductId) return seededProductId;
    setupErrors.push(`Dev seed returned ok but no productId: ${JSON.stringify(payload ?? null)}`);
  } else {
    const snippet = await readResponseSnippet(devSeedResponse);
    setupErrors.push(
      `/api/dev/seed-ui-smoke-product unavailable (${devSeedResponse.status()}): ${snippet}`
    );
  }

  let artistsResponse = await page.request.get(getApiUrl('/api/artists'), {
    headers: { Accept: 'application/json' },
  });
  let artistsPayload = artistsResponse.ok() ? await artistsResponse.json().catch(() => null) : null;
  let artists = Array.isArray(artistsPayload?.artists)
    ? artistsPayload.artists
    : Array.isArray(artistsPayload)
      ? artistsPayload
      : [];

  if (artists.length === 0) {
    const seedOrdersResponse = await page.request.post(getApiUrl('/api/admin/test/seed-orders'), {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      data: { placedCount: 1, paidCount: 0 },
    });
    if (!seedOrdersResponse.ok()) {
      const snippet = await readResponseSnippet(seedOrdersResponse);
      setupErrors.push(`/api/admin/test/seed-orders failed (${seedOrdersResponse.status()}): ${snippet}`);
    }

    artistsResponse = await page.request.get(getApiUrl('/api/artists'), {
      headers: { Accept: 'application/json' },
    });
    artistsPayload = artistsResponse.ok() ? await artistsResponse.json().catch(() => null) : null;
    artists = Array.isArray(artistsPayload?.artists)
      ? artistsPayload.artists
      : Array.isArray(artistsPayload)
        ? artistsPayload
        : [];
  }

  const artistId = String(artists[0]?.id || '').trim();
  if (!artistId) {
    setupErrors.push('No artist available to create a smoke product.');
  } else {
    const createResponse = await page.request.post(getApiUrl('/api/admin/products'), {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      data: {
        artistId,
        title: SMOKE_PRODUCT_TITLE,
        description: 'Stable seeded product for UI smoke',
        priceCents: 1999,
        stock: 12,
        size: 'M',
        color: 'Black',
        sku: `UI-SMOKE-SKU-${Date.now()}`,
      },
    });

    if (createResponse.ok()) {
      const payload = await createResponse.json().catch(() => null);
      const createdProductId = parseProductId(payload);
      if (createdProductId) return createdProductId;
      setupErrors.push(`Create product returned ok but no productId: ${JSON.stringify(payload ?? null)}`);
    } else {
      const snippet = await readResponseSnippet(createResponse);
      setupErrors.push(`/api/admin/products create failed (${createResponse.status()}): ${snippet}`);
    }
  }

  const finalProducts = await readAdminProducts(page);
  const finalProductId = findSmokeProductIdInList(finalProducts);
  if (finalProductId) return finalProductId;

  throw new Error(`Unable to seed a smoke product for admin edit flows. ${setupErrors.join(' | ')}`);
};

const openAnyEditableProductInModal = async (
  page: Page,
  preferredProductId?: string
): Promise<string | null> => {
  await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });

  if (preferredProductId) {
    const preferredRowById = page
      .locator(`[data-testid="admin-product-row"][data-product-id="${preferredProductId}"]`)
      .first();
    if ((await preferredRowById.count().catch(() => 0)) > 0) {
      await expect(preferredRowById).toBeVisible({ timeout: 10000 });
      const editButton = preferredRowById.getByTestId('admin-product-row-edit').first();
      if ((await editButton.count().catch(() => 0)) > 0) {
        await editButton.click();
      } else {
        await preferredRowById.getByRole('button', { name: /edit/i }).first().click();
      }
      return preferredProductId;
    }
  }

  const preferredRow = page.locator('table tbody tr').filter({ hasText: SMOKE_PRODUCT_TITLE }).first();
  if ((await preferredRow.count().catch(() => 0)) > 0) {
    await expect(preferredRow).toBeVisible({ timeout: 10000 });
    const editButton = preferredRow.getByTestId('admin-product-row-edit').first();
    if ((await editButton.count().catch(() => 0)) > 0) {
      await editButton.click();
    } else {
      await preferredRow.getByRole('button', { name: /edit/i }).first().click();
    }
    const rowProductId = (await preferredRow.getAttribute('data-product-id').catch(() => '')) || '';
    return rowProductId.trim() || preferredProductId || null;
  }

  const firstRow = page.locator('table tbody tr').first();
  if ((await firstRow.count().catch(() => 0)) === 0) {
    return null;
  }
  await expect(firstRow).toBeVisible({ timeout: 10000 });
  const editButton = firstRow.getByTestId('admin-product-row-edit').first();
  if ((await editButton.count().catch(() => 0)) > 0) {
    await editButton.click();
  } else {
    await firstRow.getByRole('button', { name: /edit/i }).first().click();
  }
  const rowProductId = (await firstRow.getAttribute('data-product-id').catch(() => '')) || '';
  return rowProductId.trim() || null;
};

test.describe('Admin smoke', () => {
  test('admin product edit modal validates image type with readable message', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);
    const productId = await ensureSmokeProductForAdminEdit(page);
    const opened = await openAnyEditableProductInModal(page, productId);
    test.skip(!opened, 'No editable products available for product edit modal validation test.');
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible({ timeout: 15000 });

    await page.getByTestId('admin-edit-product-photo-input').setInputFiles({
      name: 'invalid-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not-an-image'),
    });

    await expect(page.getByText(/only png, jpg, and webp images are allowed/i)).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId('admin-edit-product-save')).toBeDisabled();
  });

  test('admin product edit modal supports text-only save and hides legacy economics fields', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);
    const productId = await ensureSmokeProductForAdminEdit(page);
    const openedProductId = await openAnyEditableProductInModal(page, productId);
    const targetProductId = openedProductId || productId;
    test.skip(!targetProductId, 'No editable products available for text-only product edit smoke test.');
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/vendor pay/i)).toHaveCount(0);
    await expect(page.getByText(/internal\s*\/\s*our share/i)).toHaveCount(0);
    await expect(page.getByText(/royalty/i)).toHaveCount(0);
    await expect(page.getByText(/color options/i)).toHaveCount(0);

    const saveButton = page.getByTestId('admin-edit-product-save');
    await expect(saveButton).toBeDisabled();

    const nextTitle = `${SMOKE_PRODUCT_TITLE} Text ${Date.now()}`;
    await page.getByTestId('admin-edit-product-merch-name').fill(nextTitle);
    await page
      .getByTestId('admin-edit-product-story')
      .fill(`Smoke text-only update ${Date.now()} with enough detail for validation.`);
    await expect(saveButton).toBeEnabled();

    let patchRequests = 0;
    let photoRequests = 0;
    const requestListener = (req: any) => {
      const url = req.url();
      const method = req.method();
      if (method === 'PATCH' && /\/api\/admin\/products\/[^/]+(?:[/?#]|$)/i.test(url)) {
        patchRequests += 1;
      }
      if (method === 'PUT' && /\/api\/admin\/products\/[^/]+\/photos(?:[/?#]|$)/i.test(url)) {
        photoRequests += 1;
      }
    };
    page.on('request', requestListener);

    try {
      const patchSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          /\/api\/admin\/products\/[^/]+(?:[/?#]|$)/i.test(response.url()) &&
          [200, 201].includes(response.status()),
        { timeout: 30000 }
      );
      await saveButton.click();
      await patchSaveResponse;

      await expect(saveButton).toHaveCount(0);
      await expect(page.getByText(/NO_FIELDS/i)).toHaveCount(0);
      expect(photoRequests).toBe(0);
      expect(patchRequests).toBeGreaterThan(0);

      const refreshedRow = page
        .locator(`[data-testid="admin-product-row"][data-product-id="${targetProductId}"]`)
        .first();
      await expect(refreshedRow).toBeVisible({ timeout: 15000 });
      await expect(refreshedRow).toContainText(nextTitle);
    } finally {
      page.off('request', requestListener);
    }
  });

  test('admin product edit modal supports image-only photo replacement', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);
    const productId = await ensureSmokeProductForAdminEdit(page);
    const openedProductId = await openAnyEditableProductInModal(page, productId);
    const targetProductId = openedProductId || productId;
    test.skip(!targetProductId, 'No editable products available for image-only replacement smoke test.');
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible({ timeout: 15000 });

    const saveButton = page.getByTestId('admin-edit-product-save');
    await expect(saveButton).toBeDisabled();

    let patchRequests = 0;
    let photoRequests = 0;
    const requestListener = (req: any) => {
      const url = req.url();
      const method = req.method();
      if (method === 'PATCH' && /\/api\/admin\/products\/[^/]+(?:[/?#]|$)/i.test(url)) {
        patchRequests += 1;
      }
      if (method === 'PUT' && /\/api\/admin\/products\/[^/]+\/photos(?:[/?#]|$)/i.test(url)) {
        photoRequests += 1;
      }
    };
    page.on('request', requestListener);

    try {
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
      await page.getByTestId('admin-edit-product-photo-trigger').click();
      const fileChooser = await fileChooserPromise;
      await fileChooser.setFiles(getListingPhotoFixtures());

      await expect(page.getByTestId('admin-edit-product-photo-preview')).toHaveCount(4, {
        timeout: 10000,
      });
      await expect(saveButton).toBeEnabled();

      const photoSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          /\/api\/admin\/products\/[^/]+\/photos(?:[/?#]|$)/i.test(response.url()) &&
          [200, 201].includes(response.status()),
        { timeout: 30000 }
      );
      await saveButton.click();
      await photoSaveResponse;

      await expect(saveButton).toHaveCount(0);
      await expect(page.getByText(/NO_FIELDS/i)).toHaveCount(0);
      expect(patchRequests).toBe(0);
      expect(photoRequests).toBeGreaterThan(0);

      const refreshedRow = page
        .locator(`[data-testid="admin-product-row"][data-product-id="${targetProductId}"]`)
        .first();
      await expect(refreshedRow).toBeVisible({ timeout: 15000 });
      await expect(refreshedRow.getByTestId('admin-product-row-thumbnail').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(refreshedRow.getByTestId('admin-product-row-thumbnail-empty')).toHaveCount(0);
    } finally {
      page.off('request', requestListener);
    }
  });

  test('admin product edit modal supports mixed text + photo save', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);
    const productId = await ensureSmokeProductForAdminEdit(page);
    const openedProductId = await openAnyEditableProductInModal(page, productId);
    const targetProductId = openedProductId || productId;
    test.skip(!targetProductId, 'No editable products available for mixed product edit smoke test.');
    await expect(page.getByRole('heading', { name: /edit product/i })).toBeVisible({ timeout: 15000 });

    const saveButton = page.getByTestId('admin-edit-product-save');
    await expect(saveButton).toBeDisabled();

    const nextTitle = `${SMOKE_PRODUCT_TITLE} Mixed ${Date.now()}`;
    await page.getByTestId('admin-edit-product-merch-name').fill(nextTitle);
    await page
      .getByTestId('admin-edit-product-story')
      .fill(`Smoke mixed update ${Date.now()} with enough detail for validation.`);

    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
    await page.getByTestId('admin-edit-product-photo-trigger').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(getListingPhotoFixtures());
    await expect(page.getByTestId('admin-edit-product-photo-preview')).toHaveCount(4, {
      timeout: 10000,
    });
    await expect(saveButton).toBeEnabled();

    let patchRequests = 0;
    let photoRequests = 0;
    const requestListener = (req: any) => {
      const url = req.url();
      const method = req.method();
      if (method === 'PATCH' && /\/api\/admin\/products\/[^/]+(?:[/?#]|$)/i.test(url)) {
        patchRequests += 1;
      }
      if (method === 'PUT' && /\/api\/admin\/products\/[^/]+\/photos(?:[/?#]|$)/i.test(url)) {
        photoRequests += 1;
      }
    };
    page.on('request', requestListener);

    try {
      const patchSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          /\/api\/admin\/products\/[^/]+(?:[/?#]|$)/i.test(response.url()) &&
          [200, 201].includes(response.status()),
        { timeout: 30000 }
      );
      const photoSaveResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PUT' &&
          /\/api\/admin\/products\/[^/]+\/photos(?:[/?#]|$)/i.test(response.url()) &&
          [200, 201].includes(response.status()),
        { timeout: 30000 }
      );
      await saveButton.click();
      await Promise.all([patchSaveResponse, photoSaveResponse]);

      await expect(saveButton).toHaveCount(0);
      await expect(page.getByText(/NO_FIELDS/i)).toHaveCount(0);
      expect(patchRequests).toBeGreaterThan(0);
      expect(photoRequests).toBeGreaterThan(0);

      const refreshedRow = page
        .locator(`[data-testid="admin-product-row"][data-product-id="${targetProductId}"]`)
        .first();
      await expect(refreshedRow).toBeVisible({ timeout: 15000 });
      await expect(refreshedRow).toContainText(nextTitle);
      await expect(refreshedRow.getByTestId('admin-product-row-thumbnail').first()).toBeVisible({
        timeout: 15000,
      });
      await expect(refreshedRow.getByTestId('admin-product-row-thumbnail-empty')).toHaveCount(0);
    } finally {
      page.off('request', requestListener);
    }
  });

  test('admin can manage SKU master and product-to-SKU mapping', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);

    const productId = await ensureSmokeProductForAdminEdit(page);

    const uniqueSuffix = Date.now();
    const supplierSku = `UI-SKU-${uniqueSuffix}`;
    let createdInventorySkuId = '';

    await gotoApp(page, '/partner/admin/inventory-skus', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /sku master/i })).toBeVisible({ timeout: 20000 });

    await page.getByTestId('admin-sku-master-create').click();
    await expect(page.getByRole('heading', { name: /create sku/i })).toBeVisible({ timeout: 10000 });
    await page.getByTestId('admin-sku-form-supplier-sku').fill(supplierSku);
    await page.getByTestId('admin-sku-form-merch-type').fill('tshirt');
    await page.getByTestId('admin-sku-form-color').fill('black');
    await page.getByTestId('admin-sku-form-size').fill('M');
    await page.getByTestId('admin-sku-form-stock').fill('12');

    const createSkuResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/admin\/inventory-skus(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('admin-sku-form-save').click();
    const createSkuResponse = await createSkuResponsePromise;
    if (!createSkuResponse.ok()) {
      const body = await createSkuResponse.text().catch(() => '<unavailable>');
      throw new Error(`Create SKU failed (${createSkuResponse.status()}): ${body}`);
    }
    const createSkuPayload = await createSkuResponse.json().catch(() => null);
    createdInventorySkuId = String(createSkuPayload?.item?.id || '').trim();
    expect(createdInventorySkuId).toBeTruthy();

    const skuRow = () => page.locator('tr').filter({ hasText: supplierSku }).first();
    await expect(skuRow()).toBeVisible({ timeout: 20000 });

    await skuRow().getByTestId('admin-sku-master-edit').click();
    await expect(page.getByRole('heading', { name: /edit sku/i })).toBeVisible({ timeout: 10000 });
    await page.getByLabel(/quality tier/i).fill('premium');
    const editSkuResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('admin-sku-form-save').click();
    const editSkuResponse = await editSkuResponsePromise;
    if (!editSkuResponse.ok()) {
      const body = await editSkuResponse.text().catch(() => '<unavailable>');
      throw new Error(`Edit SKU failed (${editSkuResponse.status()}): ${body}`);
    }
    await expect(skuRow()).toContainText(/premium/i, { timeout: 10000 });

    const deactivateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await skuRow().getByTestId('admin-sku-master-toggle').click();
    const deactivateResponse = await deactivateResponsePromise;
    if (!deactivateResponse.ok()) {
      const body = await deactivateResponse.text().catch(() => '<unavailable>');
      throw new Error(`Deactivate SKU failed (${deactivateResponse.status()}): ${body}`);
    }
    await expect(skuRow()).toContainText(/inactive/i, { timeout: 10000 });

    const activateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await skuRow().getByTestId('admin-sku-master-toggle').click();
    const activateResponse = await activateResponsePromise;
    if (!activateResponse.ok()) {
      const body = await activateResponse.text().catch(() => '<unavailable>');
      throw new Error(`Activate SKU failed (${activateResponse.status()}): ${body}`);
    }
    await expect(skuRow()).toContainText(/active/i, { timeout: 10000 });
    const ensurePositiveStockResponse = await page.request.patch(
      getApiUrl(`/api/admin/inventory-skus/${createdInventorySkuId}`),
      {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        data: { stock: 12, is_active: true },
      }
    );
    if (!ensurePositiveStockResponse.ok()) {
      const body = await ensurePositiveStockResponse.text().catch(() => '<unavailable>');
      throw new Error(
        `Ensure positive SKU stock failed (${ensurePositiveStockResponse.status()}): ${body}`
      );
    }

    await gotoApp(page, `/partner/admin/products/${productId}/variants`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByRole('heading', { name: /product variants/i })).toBeVisible({ timeout: 20000 });

    if ((await page.getByTestId('admin-variant-row').count()) === 0) {
      await page.getByRole('button', { name: /add variant/i }).click();
    }

    const firstSkuSelect = page.getByTestId('admin-variant-sku-select-0');
    await expect(firstSkuSelect).toBeVisible({ timeout: 15000 });
    await firstSkuSelect.selectOption({ value: createdInventorySkuId });
    await page.getByTestId('admin-variant-selling-price-0').fill('2199');

    const saveVariantsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/api\/admin\/products\/[^/]+\/variants(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await page.getByTestId('admin-variant-save').click();
    const saveVariantsResponse = await saveVariantsResponsePromise;
    if (!saveVariantsResponse.ok()) {
      const body = await saveVariantsResponse.text().catch(() => '<unavailable>');
      throw new Error(`Save variants failed (${saveVariantsResponse.status()}): ${body}`);
    }
    let sellableReady = false;
    let lastVariantSnapshot: any = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const enforceSellableStockResponse = await page.request.patch(
        getApiUrl(`/api/admin/inventory-skus/${createdInventorySkuId}`),
        {
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          data: { stock: 12, is_active: true },
        }
      );
      if (!enforceSellableStockResponse.ok()) {
        const body = await enforceSellableStockResponse.text().catch(() => '<unavailable>');
        throw new Error(
          `Unable to enforce positive stock for mapped SKU (${enforceSellableStockResponse.status()}): ${body}`
        );
      }

      const variantsReadResponse = await page.request.get(
        getApiUrl(`/api/admin/products/${productId}/variants`),
        { headers: { Accept: 'application/json' } }
      );
      if (!variantsReadResponse.ok()) {
        const body = await variantsReadResponse.text().catch(() => '<unavailable>');
        throw new Error(
          `Unable to read variants after stock update (${variantsReadResponse.status()}): ${body}`
        );
      }
      const variantsReadPayload = await variantsReadResponse.json().catch(() => null);
      const variants = Array.isArray(variantsReadPayload?.variants)
        ? variantsReadPayload.variants
        : Array.isArray(variantsReadPayload?.items)
          ? variantsReadPayload.items
          : [];
      const mappedVariant = variants.find(
        (variant: any) =>
          String(variant?.inventory_sku_id || variant?.inventorySkuId || '').trim() ===
          createdInventorySkuId
      );
      lastVariantSnapshot = mappedVariant || null;
      const stockValue = Number(mappedVariant?.stock ?? 0);
      const effectiveSellableRaw =
        mappedVariant?.effective_sellable ?? mappedVariant?.effectiveSellable;
      const effectiveSellableValue =
        effectiveSellableRaw === true ||
        effectiveSellableRaw === 'true' ||
        effectiveSellableRaw === 1 ||
        effectiveSellableRaw === '1';
      if (stockValue > 0 && effectiveSellableValue) {
        sellableReady = true;
        break;
      }
      await page.waitForTimeout(250);
    }

    if (!sellableReady) {
      throw new Error(
        `Mapped variant did not become sellable after stock setup: ${JSON.stringify(
          lastVariantSnapshot
        )}`
      );
    }

    await gotoApp(page, `/partner/admin/products/${productId}/variants`, {
      waitUntil: 'domcontentloaded',
    });

    const resolveMappedRowIndex = async () => {
      const rowCount = await page.getByTestId('admin-variant-row').count();
      for (let i = 0; i < rowCount; i += 1) {
        const select = page.getByTestId(`admin-variant-sku-select-${i}`);
        if ((await select.count().catch(() => 0)) === 0) continue;
        const value = (await select.inputValue().catch(() => '')).trim();
        if (value === createdInventorySkuId) return i;
      }
      return -1;
    };

    await expect.poll(resolveMappedRowIndex, { timeout: 10000 }).toBeGreaterThanOrEqual(0);
    const mappedRowIndex = await resolveMappedRowIndex();
    if (mappedRowIndex < 0) {
      throw new Error(`Unable to find mapped variant row for inventory SKU ${createdInventorySkuId}`);
    }
    const mappedVariantRow = page.getByTestId('admin-variant-row').nth(mappedRowIndex);

    await expect(page.getByTestId(`admin-variant-sku-select-${mappedRowIndex}`)).toHaveValue(
      createdInventorySkuId,
      { timeout: 10000 }
    );
    await expect(mappedVariantRow).toBeVisible({ timeout: 10000 });
    await expect(mappedVariantRow.getByTestId('admin-variant-listed-select')).toHaveValue('true');
    await expect(mappedVariantRow.getByTestId('admin-variant-sku-active')).toHaveText(/yes/i);
    await expect
      .poll(
        async () => {
          const text = ((await mappedVariantRow.getByTestId('admin-variant-stock').textContent()) || '0').trim();
          return Number(text);
        },
        { timeout: 10000 }
      )
      .toBeGreaterThan(0);
    await expect(mappedVariantRow.getByTestId('admin-variant-effective-sellable')).toHaveText(/yes/i, {
      timeout: 10000,
    });

    await page.getByRole('button', { name: /add variant/i }).click();
    const variantRowCount = await page.getByTestId('admin-variant-row').count();
    const duplicateRowIndex = Math.max(variantRowCount - 1, 0);
    const duplicateSelect = page.getByTestId(`admin-variant-sku-select-${duplicateRowIndex}`);
    await duplicateSelect.selectOption({ value: createdInventorySkuId });
    const duplicatePriceInput = page.getByTestId(`admin-variant-selling-price-${duplicateRowIndex}`);
    await duplicatePriceInput.fill('2299');
    await page.getByTestId('admin-variant-save').click();
    await expect(page.getByText(/this sku is already linked to the product/i)).toBeVisible({
      timeout: 10000,
    });

    await gotoApp(page, '/partner/admin/inventory-skus', { waitUntil: 'domcontentloaded' });
    await expect(skuRow()).toBeVisible({ timeout: 20000 });
    const deactivateForStatusResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await skuRow().getByTestId('admin-sku-master-toggle').click();
    const deactivateForStatusResponse = await deactivateForStatusResponsePromise;
    if (!deactivateForStatusResponse.ok()) {
      const body = await deactivateForStatusResponse.text().catch(() => '<unavailable>');
      throw new Error(`Deactivate SKU for status check failed (${deactivateForStatusResponse.status()}): ${body}`);
    }

    await gotoApp(page, `/partner/admin/products/${productId}/variants`, {
      waitUntil: 'domcontentloaded',
    });
    await expect.poll(resolveMappedRowIndex, { timeout: 10000 }).toBeGreaterThanOrEqual(0);
    const mappedRowIndexAfterDeactivate = await resolveMappedRowIndex();
    if (mappedRowIndexAfterDeactivate < 0) {
      throw new Error(`Unable to find mapped variant row after SKU deactivate for ${createdInventorySkuId}`);
    }
    const mappedVariantRowAfterDeactivate = page
      .getByTestId('admin-variant-row')
      .nth(mappedRowIndexAfterDeactivate);
    await expect(mappedVariantRowAfterDeactivate).toBeVisible({ timeout: 10000 });
    await expect(mappedVariantRowAfterDeactivate.getByTestId('admin-variant-effective-sellable')).toHaveText(/no/i, {
      timeout: 10000,
    });
    await expect(mappedVariantRowAfterDeactivate.getByTestId('admin-variant-status-reasons')).toContainText(/sku inactive/i, {
      timeout: 10000,
    });

    await gotoApp(page, '/partner/admin/inventory-skus', { waitUntil: 'domcontentloaded' });
    await expect(skuRow()).toBeVisible({ timeout: 20000 });
    const reactivateResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await skuRow().getByTestId('admin-sku-master-toggle').click();
    const reactivateResponse = await reactivateResponsePromise;
    if (!reactivateResponse.ok()) {
      const body = await reactivateResponse.text().catch(() => '<unavailable>');
      throw new Error(`Reactivate SKU failed (${reactivateResponse.status()}): ${body}`);
    }

    await skuRow().getByTestId('admin-sku-master-stock-input').fill('0');
    const saveStockResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        /\/api\/admin\/inventory-skus\/[^/]+(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    await skuRow().getByTestId('admin-sku-master-stock-save').click();
    const saveStockResponse = await saveStockResponsePromise;
    if (!saveStockResponse.ok()) {
      const body = await saveStockResponse.text().catch(() => '<unavailable>');
      throw new Error(`Save stock failed (${saveStockResponse.status()}): ${body}`);
    }

    await gotoApp(page, `/partner/admin/products/${productId}/variants`, {
      waitUntil: 'domcontentloaded',
    });
    await expect.poll(resolveMappedRowIndex, { timeout: 10000 }).toBeGreaterThanOrEqual(0);
    const mappedRowIndexAfterStockZero = await resolveMappedRowIndex();
    if (mappedRowIndexAfterStockZero < 0) {
      throw new Error(`Unable to find mapped variant row after stock update for ${createdInventorySkuId}`);
    }
    const mappedVariantRowAfterStockZero = page
      .getByTestId('admin-variant-row')
      .nth(mappedRowIndexAfterStockZero);
    await expect(mappedVariantRowAfterStockZero).toBeVisible({ timeout: 10000 });
    await expect(mappedVariantRowAfterStockZero.getByTestId('admin-variant-effective-sellable')).toHaveText(/no/i, {
      timeout: 10000,
    });
    await expect(mappedVariantRowAfterStockZero.getByTestId('admin-variant-status-reasons')).toContainText(/out of stock/i, {
      timeout: 10000,
    });
  });

  test('admin artists page shows featured column and toggle', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);

    await gotoApp(page, '/partner/admin/artists', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/artists/);

    await expect(page.getByTestId('admin-artist-featured-header')).toBeVisible({ timeout: 15000 });

    const featuredToggleByTestId = page.locator('[data-testid^="admin-artist-featured-toggle-"]').first();
    const featuredToggle =
      (await featuredToggleByTestId.count()) > 0
        ? featuredToggleByTestId
        : page.locator('table tbody input[type="checkbox"]').first();

    await expect(featuredToggle).toBeVisible({ timeout: 15000 });
    await expect(featuredToggle).toBeEnabled({ timeout: 15000 });
  });

  test('onboarding request flow supports required plan + admin approval payload fields', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    const stamp = Date.now();
    const artistName = `Smoke Plan Artist ${stamp}`;
    const handle = `smoke-plan-${stamp}`;
    const handleWithAt = `@${handle}`;
    const email = `smoke.plan.${stamp}@example.invalid`;
    const phone = `9999${(stamp % 1000000).toString().padStart(6, '0')}`;

    await gotoApp(page, '/apply/artist', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/apply\/artist/, { timeout: 20000 });
    await page.getByLabel(/artist name/i).fill(artistName);
    await page.getByLabel(/handle/i).fill(handleWithAt);
    await page.getByLabel(/^email/i).fill(email);
    await page.getByLabel(/^phone/i).fill(phone);

    const basicPlanCard = page
      .locator('section,div,article')
      .filter({ hasText: /basic/i })
      .filter({ hasText: /free/i })
      .first();
    const fallbackPlanCard = page
      .locator('section,div,article')
      .filter({ has: page.getByRole('button', { name: /enroll/i }) })
      .first();
    const cardWithEnroll = (await basicPlanCard.isVisible().catch(() => false))
      ? basicPlanCard
      : fallbackPlanCard;
    await expect(cardWithEnroll).toBeVisible({ timeout: 20000 });
    await cardWithEnroll.getByRole('button', { name: /enroll/i }).first().click();

    await page.getByRole('button', { name: /request onboarding/i }).click();
    await expect(page.getByText(/request submitted|submitted|request received|thank you/i)).toBeVisible({ timeout: 20000 });

    await loginAdmin(page);
    await gotoApp(page, '/partner/admin/artist-requests', { waitUntil: 'domcontentloaded' });

    const pendingFilter = page.getByLabel(/filter status/i);
    if ((await pendingFilter.count().catch(() => 0)) > 0) {
      await pendingFilter.selectOption('pending').catch(() => null);
    }

    const escapedHandle = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const requestCard = page
      .locator('div.rounded-2xl.border')
      .filter({ hasText: new RegExp(`@?${escapedHandle}`, 'i') })
      .first();
    await expect(requestCard).toBeVisible({ timeout: 30000 });

    const requestedPlanBlock = requestCard.locator('div').filter({ hasText: /requested plan/i }).first();
    await expect(requestedPlanBlock).toBeVisible({ timeout: 15000 });
    const planPillExact = requestCard.getByText(/^basic$/i);
    if (await planPillExact.count().then(c => c > 0).catch(() => false)) {
      await expect(planPillExact.first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(requestedPlanBlock).toContainText(/basic/i, { timeout: 15000 });
    }

    await requestCard.getByRole('button', { name: /review application|review/i }).click();

    await expect(page.getByRole('heading', { name: /review application/i })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/processing entry/i)).toBeVisible({ timeout: 20000 });

    const requestedPlanLabel = page.getByText(/requested plan type|requested plan/i).first();
    await expect(requestedPlanLabel).toBeVisible({ timeout: 15000 });

    const requestedPlanRow = requestedPlanLabel.locator('xpath=ancestor::div[1]');
    await expect(requestedPlanRow).toBeVisible({ timeout: 15000 });
    await expect(requestedPlanRow).toContainText(/basic/i, { timeout: 15000 });

    const basicPill = page.getByText(/^basic$/i);
    if (await basicPill.count().then(c => c > 0).catch(() => false)) {
      await expect(basicPill.first()).toBeVisible({ timeout: 15000 });
    } else {
      await expect(requestedPlanRow).toContainText(/basic/i, { timeout: 15000 });
    }

    try {
      await page.getByLabel(/final approved plan type/i).selectOption('advanced');
    } catch {
      await page.getByLabel(/final approved plan type/i).click();
      await page.getByText(/^advanced$/i).click();
    }

    try {
      await page.getByLabel(/payment mode/i).selectOption('online');
    } catch {
      await page.getByLabel(/payment mode/i).click();
      await page.getByText(/online/i).click();
    }

    await page.getByLabel(/transaction id/i).fill(`TX-${Date.now()}`);

    const approveWithoutPasswordResponsePromise = page
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          /\/api\/admin\/artist-access-requests\/[^/]+\/approve/i.test(r.url()),
        { timeout: 1200 }
      )
      .then(() => true)
      .catch(() => false);
    await page.getByRole('button', { name: /approve application/i }).click();
    const approveWithoutPasswordResponse = await approveWithoutPasswordResponsePromise;
    expect(approveWithoutPasswordResponse).toBe(false);
    await expect(page.getByText(/artist login password is required|password is required/i)).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId('admin-artist-approval-password').fill(`AdminSet-${Date.now()}!`);

    const approveRespPromise = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/admin\/artist-access-requests\/[^/]+\/approve/i.test(r.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /approve application/i }).click();
    const resp = await approveRespPromise;
    if (!resp.ok()) {
      const body = await resp.text().catch(() => '<unavailable>');
      console.error('[approve] response body', body);
      throw new Error(`Approve failed: ${resp.status()} ${body}`);
    }

    await expect(page.getByText(/approved|application approved|success/i)).toBeVisible({ timeout: 20000 });
  });

});

test.describe('Label smoke', () => {
  test('label dashboard renders portfolio overview', async ({ page }) => {
    test.skip(!LABEL_EMAIL || !LABEL_PASSWORD, 'Missing label credentials');
    await loginLabel(page);
    await gotoApp(page, '/partner/label');
    const shellHeading = page.getByRole('heading', { name: /label dashboard|dashboard/i }).first();
    await expect(shellHeading).toBeVisible({ timeout: 15000 });

    await expect(
      page.locator("main").getByRole("paragraph").filter({ hasText: /^artists$/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("label-metric-active-artists")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("label-metric-inactive-artists")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("label-metric-label-gross")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/artist performance/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/^artist$/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/orders\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/gross\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/units\s*30d/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/active\s*products/i)).toBeVisible({ timeout: 15000 });

    const artistPerformanceSection = page
      .getByRole('heading', { name: /artist performance/i })
      .first()
      .locator('xpath=ancestor::section[1]');
    const rowLikeElements = artistPerformanceSection.locator('div.divide-y > button');
    await expect(rowLikeElements.first()).toBeVisible({ timeout: 15000 });
    expect(await rowLikeElements.count()).toBeGreaterThan(0);

    const logoutButton = page.getByRole('button', { name: /logout/i });
    await expect(logoutButton).toBeVisible({ timeout: 15000 });
    await logoutButton.click();
    await expect(page).toHaveURL(/\/($|\?)/, { timeout: 15000 });

    await gotoApp(page, '/partner/label', { waitUntil: 'domcontentloaded', authRetry: false });
    await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
    const redirectedUrl = new URL(page.url());
    if (/^\/(fan|partner)\/login$/i.test(redirectedUrl.pathname)) {
      expect(
        redirectedUrl.searchParams.get('returnTo') ||
          redirectedUrl.searchParams.get('returnUrl')
      ).toBe('/partner/label');
    }
  });
});
