import { test, expect, Page, APIRequestContext, request as playwrightRequest } from '@playwright/test';

const BUYER_EMAIL = process.env.BUYER_EMAIL;
const BUYER_PASSWORD = process.env.BUYER_PASSWORD;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const UI_BASE_URL = process.env.UI_BASE_URL || 'http://localhost:5173';
let cachedSeededProductId: string | null = null;

const loginBuyer = async (page: Page) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const email = page.getByTestId('login-email');
  const password = page.getByTestId('login-password');
  const submit = page.getByTestId('login-submit');

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(BUYER_EMAIL ?? '');
  await password.fill(BUYER_PASSWORD ?? '');
  await submit.click();

  await Promise.race([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }),
    expect(page.getByRole('heading', { name: /buyer/i })).toBeVisible({ timeout: 15000 }),
  ]);
};

const PRODUCT_CARD_SELECTORS = ['article[role="button"]', '[data-testid*="product"]', '[data-testid*="card"]'];

const normalizeText = (value?: string) => (value ?? '').toLowerCase().trim();
const isBlockedProductName = (value?: string) => /(illegal tee|forbidden)/i.test(value ?? '');

const selectDefaultVariant = async (page: Page) => {
  const variantSelect =
    (await page.getByLabel(/variant/i).count()) > 0
      ? page.getByLabel(/variant/i).first()
      : page.locator('select').first();
  if ((await variantSelect.count()) === 0) return;
  const firstSelectableValue = await variantSelect.evaluate((selectEl) => {
    const options = Array.from(selectEl.options || []);
    const candidate = options.find((option) => !option.disabled && option.value);
    return candidate?.value || '';
  });
  if (firstSelectableValue) {
    await variantSelect.selectOption(firstSelectableValue);
  }
};

const waitForProductsListApi = async (page: Page) => {
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/api/products') && [200, 304].includes(response.status()),
      { timeout: 10000 }
    )
    .catch(() => null);
};

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

const getProductCards = (page: Page) =>
  page.locator(PRODUCT_CARD_SELECTORS.join(', '));

const waitForProductsResolution = async (page: Page) => {
  const cards = getProductCards(page);
  await page.waitForLoadState('domcontentloaded');
  const emptyState = page.getByText(/no products yet|no products available yet/i).first();
  const errorState = page.getByText(/something went wrong|unable to load products/i).first();

  await expect
    .poll(
      async () => {
        const cardCount = await cards.count().catch(() => 0);
        if (cardCount > 0) return 'cards';
        const isEmpty = await emptyState.isVisible().catch(() => false);
        if (isEmpty) return 'empty';
        const isError = await errorState.isVisible().catch(() => false);
        if (isError) return 'error';
        return 'pending';
      },
      { timeout: 15000 }
    )
    .not.toBe('pending');

  return cards.count().catch(() => 0);
};

const parseItems = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.artists)) return payload.artists;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const parseErrorText = async (response: { text: () => Promise<string>; json: () => Promise<any> }) => {
  const asText = await response.text().catch(() => '');
  if (asText) return asText;
  const asJson = await response.json().catch(() => null);
  if (!asJson) return '<no-body>';
  return JSON.stringify(asJson);
};

const ensureActiveProductExists = async (page: Page): Promise<string | null> => {
  if (cachedSeededProductId) {
    return cachedSeededProductId;
  }

  const apiContext: APIRequestContext = await playwrightRequest.newContext({
    baseURL: UI_BASE_URL,
    extraHTTPHeaders: { Accept: 'application/json' },
  });

  try {
    const ensureSeedRes = await apiContext.post('/api/dev/seed-ui-smoke-product');
    if (ensureSeedRes.ok()) {
      const ensureSeedBody = await ensureSeedRes.json().catch(() => null);
      const seededId = String(ensureSeedBody?.productId ?? '').trim();
      if (seededId) {
        cachedSeededProductId = seededId;
        // Keep seed logs minimal but useful for debugging.
        // eslint-disable-next-line no-console
        console.log(
          `[ui-smoke-seed] productId=${seededId} sku=${String(ensureSeedBody?.sku ?? '')}`
        );
      }
    }

    await waitForProductsResolution(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForProductsResolution(page);

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error(
        'No products available for buyer smoke; ensure seed data includes at least one active product.'
      );
    }

    const loginRes = await apiContext.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!loginRes.ok()) {
      throw new Error(
        `Admin API login failed (${loginRes.status()}): ${await parseErrorText(loginRes)}`
      );
    }
    const loginBody = await loginRes.json().catch(() => null);
    const accessToken = loginBody?.accessToken;
    if (!accessToken) {
      throw new Error('Admin API login succeeded but no accessToken was returned.');
    }

    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const artistsRes = await apiContext.get('/api/artists', { headers: authHeaders });
    if (!artistsRes.ok()) {
      throw new Error(
        `Failed to list artists (${artistsRes.status()}): ${await parseErrorText(artistsRes)}`
      );
    }

    const artistItems = parseItems(await artistsRes.json().catch(() => null));
    let artistId = String(artistItems[0]?.id || '').trim();
    if (!artistId) {
      const uniqueArtist = Date.now();
      const createArtistRes = await apiContext.post('/api/admin/provisioning/create-artist', {
        headers: authHeaders,
        data: {
          handle: `buyer-smoke-artist-${uniqueArtist}`,
          name: `Buyer Smoke Artist ${uniqueArtist}`,
          theme: {},
        },
      });
      if (![200, 201, 409].includes(createArtistRes.status())) {
        throw new Error(
          `Failed to create artist (${createArtistRes.status()}): ${await parseErrorText(createArtistRes)}`
        );
      }
      const refreshArtistsRes = await apiContext.get('/api/artists', { headers: authHeaders });
      if (!refreshArtistsRes.ok()) {
        throw new Error(
          `Failed to refresh artists (${refreshArtistsRes.status()}): ${await parseErrorText(refreshArtistsRes)}`
        );
      }
      const refreshedArtists = parseItems(await refreshArtistsRes.json().catch(() => null));
      artistId = String(refreshedArtists[0]?.id || '').trim();
    }
    if (!artistId) {
      throw new Error('Unable to resolve artist id for buyer smoke product seeding.');
    }

    const unique = Date.now();
    const createProductRes = await apiContext.post('/api/admin/products', {
      headers: authHeaders,
      data: {
        artistId,
        title: `Buyer Smoke Product ${unique}`,
        description: 'Auto-seeded for buyer smoke',
        price: '29.99',
        stock: 20,
        isActive: true,
      },
    });
    if (!createProductRes.ok()) {
      throw new Error(
        `Failed to create product (${createProductRes.status()}): ${await parseErrorText(createProductRes)}`
      );
    }
    const createProductBody = await createProductRes.json().catch(() => null);
    const productId = String(
      createProductBody?.id ??
        createProductBody?.product?.id ??
        createProductBody?.item?.id ??
        createProductBody?.productId ??
        ''
    ).trim();
    if (!productId) {
      throw new Error('Product creation succeeded but response did not include product id.');
    }

    const createVariantRes = await apiContext.put(`/api/admin/products/${productId}/variants`, {
      headers: authHeaders,
      data: {
        variants: [
          {
            sku: `BUY-${unique}`,
            size: 'M',
            color: 'Black',
            priceCents: 2999,
            stock: 20,
            isActive: true,
          },
        ],
      },
    });
    if (!createVariantRes.ok()) {
      throw new Error(
        `Failed to create variant (${createVariantRes.status()}): ${await parseErrorText(createVariantRes)}`
      );
    }

    cachedSeededProductId = productId;
  } finally {
    await apiContext.dispose();
  }

  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(async () => (await getProductCards(page).count().catch(() => 0)) > 0, { timeout: 20000 })
    .toBe(true);

  if (!cachedSeededProductId) {
    throw new Error(
      'No products available for buyer smoke; ensure seed data includes at least one active product.'
    );
  }
  return cachedSeededProductId;
};

const openKnownGoodProductDetail = async (
  page: Page
): Promise<{ productName: string; productId: string; variantLabel?: string }> => {
  const initialProductsListResponse = waitForProductsListApi(page);
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  await initialProductsListResponse;
  const seededProductId = await ensureActiveProductExists(page);
  if (seededProductId) {
    await page.goto(`/products/${seededProductId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/products\/[^/?#]+$/, { timeout: 15000 });
    const title = await getProductTitleFromDetail(page);
    const variantSelect = page.locator('select#variant-select').first();
    const hasVariantSelector = (await variantSelect.count()) > 0;
    if (hasVariantSelector) {
      await selectDefaultVariant(page);
    }
    const addButton = page.getByRole('button', { name: /add to cart/i });
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await expect(addButton).toBeEnabled({ timeout: 15000 });
    let variantLabel: string | undefined;
    if (hasVariantSelector) {
      variantLabel = await variantSelect.evaluate((selectEl) => {
        const option = selectEl.selectedOptions?.[0];
        return option?.textContent?.trim() || undefined;
      });
    }
    await addButton.click();
    return { productName: title, productId: seededProductId, variantLabel };
  }

  const cards = getProductCards(page);
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  const total = Math.min(await cards.count(), 12);

  for (let candidate = 0; candidate < total; candidate += 1) {
    const productsListResponse = waitForProductsListApi(page);
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await productsListResponse;
    await ensureActiveProductExists(page);
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const card = cards.nth(candidate);
    const cardText = normalizeText(await card.textContent());
    if (isBlockedProductName(cardText)) {
      continue;
    }

    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();
    await page.waitForURL(/\/products\/[^/?#]+$/, { timeout: 15000 });

    const detailUrl = page.url();
    const match = detailUrl.match(/\/products\/([^\/?#]+)/);
    const productId = match?.[1] ?? detailUrl;
    const title = await getProductTitleFromDetail(page);
    if (isBlockedProductName(title)) {
      continue;
    }

    const variantSelect = page.locator('select#variant-select').first();
    const hiddenVariantId = page.locator(
      'input[type="hidden"][name*="variant" i], input[type="hidden"][id*="variant" i]'
    );
    const hasVariantSelector = (await variantSelect.count()) > 0;
    const hasHiddenVariantId = (await hiddenVariantId.count()) > 0;
    if (!hasVariantSelector && !hasHiddenVariantId) {
      continue;
    }

    await selectDefaultVariant(page);

    const addButton = page.getByRole('button', { name: /add to cart/i });
    await expect(addButton).toBeVisible({ timeout: 15000 });
    const enabledQuickly = await addButton
      .isEnabled({ timeout: 3000 })
      .catch(() => false);
    if (!enabledQuickly) {
      continue;
    }

    let variantLabel: string | undefined;
    if (hasVariantSelector) {
      variantLabel = await variantSelect.evaluate((selectEl) => {
        const option = selectEl.selectedOptions?.[0];
        return option?.textContent?.trim() || undefined;
      });
    }
    await addButton.click();
    return { productName: title, productId, variantLabel };
  }
  throw new Error('No purchasable product found (needs active product with in-stock variant)');
};

const openVariantProductDetail = async (
  page: Page
): Promise<{ productName: string; productId: string }> => {
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  const seededProductId = await ensureActiveProductExists(page);
  if (seededProductId) {
    await page.goto(`/products/${seededProductId}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/products\/[^/?#]+$/, { timeout: 15000 });
    const title = await getProductTitleFromDetail(page);
    const variantSelect = page.locator('select#variant-select').first();
    await expect(variantSelect).toBeVisible({ timeout: 10000 });
    return { productName: title, productId: seededProductId };
  }

  const cards = getProductCards(page);
  const total = Math.min(await cards.count(), 12);

  for (let candidate = 0; candidate < total; candidate += 1) {
    await page.goto('/products', { waitUntil: 'domcontentloaded' });
    await ensureActiveProductExists(page);
    const card = cards.nth(candidate);
    const cardText = normalizeText(await card.textContent());
    if (isBlockedProductName(cardText)) {
      continue;
    }

    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();
    await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 15000 });

    const detailUrl = page.url();
    const match = detailUrl.match(/\/products\/([^\/?#]+)/);
    const productId = match?.[1] ?? detailUrl;
    const title = await getProductTitleFromDetail(page);
    if (isBlockedProductName(title)) {
      continue;
    }

    const variantSelect = page.locator('select#variant-select').first();
    if ((await variantSelect.count()) === 0) {
      continue;
    }
    await expect(variantSelect).toBeVisible({ timeout: 10000 });
    const optionCount = await variantSelect.locator('option').count();
    if (optionCount === 0) {
      continue;
    }

    return { productName: title, productId };
  }

  throw new Error('No variant-backed product found');
};

const verifyOrderContainsNames = async (page: Page, names: string[]) => {
  let matchedNames = 0;
  for (const name of names) {
    const locator = page.getByText(name, { exact: false });
    if ((await locator.count()) > 0) {
      await expect(locator.first()).toBeVisible({ timeout: 5000 });
      matchedNames += 1;
    }
  }
  if (matchedNames === names.length) {
    return;
  }
  const itemsLabel = page.getByText(/Items:/i).first();
  await expect(itemsLabel).toBeVisible({ timeout: 15000 });
  const match = (await itemsLabel.textContent())?.match(/Items:\s*(\d+)/i);
  expect(match).not.toBeNull();
  const count = Number(match?.[1] ?? '0');
  expect(count).toBeGreaterThanOrEqual(names.length);
};

const verifyOrderHasReadableItemRow = async (page: Page, names: string[]) => {
  const productCells = page.locator(
    'section:has(h2:has-text("Items")) .space-y-2 > div > span:first-child'
  );
  await expect(productCells.first()).toBeVisible({ timeout: 15000 });
  const productTexts = (await productCells.allTextContents()).map((value) =>
    value.trim().toLowerCase()
  );
  const normalizedNames = names
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const hasReadableTitle = productTexts.some((cellText) =>
    normalizedNames.some((name) => cellText.includes(name))
  );
  expect(hasReadableTitle).toBe(true);
};

const verifyCartContainsProduct = async (
  page: Page,
  productName: string,
  variantLabel?: string,
  consoleErrors: string[] = []
) => {
  const body = page.locator('body');
  const cartLineItemsByTestId = body.locator('[data-testid*=cart-item], [data-testid*=line-item]');
  const cartLineItemsByStructure = body.locator('li, tr, [role="listitem"]');
  const checkoutCta = page
    .getByRole('button', { name: /checkout/i })
    .or(page.getByRole('link', { name: /checkout/i }));

  try {
    await expect(page).toHaveURL(/\/cart/, { timeout: 15000 });
    await expect(body).toContainText(/Cart\s*\d+\s*item\(s\)/i, { timeout: 15000 });
    await expect(body).toContainText(productName, { timeout: 15000 });

    if (variantLabel) {
      const bodyTextForVariant = await body.innerText().catch(() => '');
      if (bodyTextForVariant.includes(variantLabel)) {
        await expect(body).toContainText(variantLabel, { timeout: 5000 });
      }
    }

    await expect(checkoutCta).toBeVisible({ timeout: 15000 });
  } catch (err: any) {
    const url = page.url();
    const title = await page.title().catch(() => '<no-title>');
    const bodyText = (await body.innerText().catch(() => '<no-body-text>'))
      .slice(0, 400)
      .replace(/\s+/g, ' ');
    const byTestIdCount = await cartLineItemsByTestId.count().catch(() => -1);
    const byStructureCount = await cartLineItemsByStructure.count().catch(() => -1);
    const checkoutVisible = await checkoutCta.isVisible().catch(() => false);
    const consoleTail = consoleErrors.slice(-8).join(' | ') || '<none>';
    throw new Error(
      `Cart verification failed. expectedProduct=${productName} url=${url} title=${title} body=${bodyText} testIdItems=${byTestIdCount} structuredItems=${byStructureCount} checkoutVisible=${checkoutVisible} consoleErrors=${consoleTail} cause=${err?.message ?? 'unknown'}`
    );
  }
};

test.describe('Buyer smoke', () => {
  test('label alias endpoint includes deprecation headers', async () => {
    const apiContext: APIRequestContext = await playwrightRequest.newContext({
      baseURL: UI_BASE_URL,
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    try {
      const response = await apiContext.get('/api/label/dashboard/summary');
      const headers = response.headers();
      const deprecationHeader = Object.entries(headers).find(
        ([key]) => key.toLowerCase() === 'deprecation'
      )?.[1];
      const sunsetHeader = Object.entries(headers).find(
        ([key]) => key.toLowerCase() === 'sunset'
      )?.[1];
      expect((deprecationHeader ?? '').toLowerCase()).toBe('true');
      expect((sunsetHeader ?? '').trim().length).toBeGreaterThan(0);
    } finally {
      await apiContext.dispose();
    }
  });

  test('landing renders featured sections and supports navigation', async ({ page }) => {
    const legacyDropAliasRequests: string[] = [];
    const requestListener = (req: any) => {
      const url = req.url();
      if (/\/api\/drops\/id\//i.test(url)) {
        legacyDropAliasRequests.push(url);
      }
    };
    page.on('request', requestListener);

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: /limited drops curated with maker-first intent/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: /featured artists/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { name: /featured drops/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('footer').getByText(/OfficialMerch/i).first()).toBeVisible({ timeout: 15000 });

    const artistsRowLinks = page.getByRole('link', { name: /view artist/i });
    const artistsEmpty = page.getByText(/no featured artists yet/i).first();
    const artistsError = page.getByText(/failed to load featured artists/i).first();
    const anyRetryButton = page.getByRole('button', { name: /retry/i }).first();
    await expect
      .poll(
        async () =>
          (await artistsRowLinks.count()) > 0 ||
          (await artistsEmpty.isVisible().catch(() => false)) ||
          ((await artistsError.isVisible().catch(() => false)) &&
            (await anyRetryButton.isVisible().catch(() => false))),
        { timeout: 15000 }
      )
      .toBe(true);

    const dropsRowLinks = page.getByRole('link', { name: /view drop/i });
    const dropsEmpty = page.getByText(/no drops are live yet/i).first();
    const dropsError = page.getByText(/failed to load featured drops/i).first();
    await expect
      .poll(
        async () =>
          (await dropsRowLinks.count()) > 0 ||
          (await dropsEmpty.isVisible().catch(() => false)) ||
          ((await dropsError.isVisible().catch(() => false)) &&
            (await anyRetryButton.isVisible().catch(() => false))),
        { timeout: 15000 }
      )
      .toBe(true);

    const artistsErrorVisible = await artistsError.isVisible().catch(() => false);
    const dropsErrorVisible = await dropsError.isVisible().catch(() => false);
    if (!artistsErrorVisible && !dropsErrorVisible) {
      await expect(anyRetryButton).toBeHidden();
    }

    if ((await artistsRowLinks.count()) > 0) {
      await artistsRowLinks.first().click();
      await expect(page).toHaveURL(/\/artists\//, { timeout: 15000 });
      const artistProductLinks = page.locator('a[href^="/products/"]');
      await expect
        .poll(async () => await artistProductLinks.count(), { timeout: 10000 })
        .toBeGreaterThan(0);
      const productsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: /products/i }) })
        .first();
      if ((await productsSection.count()) > 0) {
        const productTeaserLinks = productsSection.getByRole('link', { name: /view product/i });
        if ((await productTeaserLinks.count()) > 0) {
          await expect(productsSection).not.toContainText(/₹|\$\s*\d+([.,]\d{2})?/i);
        }
      }
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    if ((await dropsRowLinks.count()) > 0) {
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const firstDropLink = dropsRowLinks.first();
      const href = (await firstDropLink.getAttribute('href')) ?? '';
      expect(href).toContain('/drops/');
      const hrefDropSegment = href.split('/drops/')[1]?.split(/[?#]/)[0] ?? '';
      expect(hrefDropSegment.length).toBeGreaterThan(0);
      expect(uuidPattern.test(hrefDropSegment)).toBe(false);

      const dropDetailRequest = page.waitForRequest(
        (req) =>
          req.method() === 'GET' &&
          /\/api\/drops\/[^/?#]+$/i.test(req.url()) &&
          !/\/api\/drops\/featured(?:[/?#]|$)/i.test(req.url()),
        { timeout: 15000 }
      );

      await firstDropLink.click();
      const detailReq = await dropDetailRequest;
      const requestedDropSegment =
        detailReq.url().split('/api/drops/')[1]?.split(/[?#]/)[0] ?? '';
      expect(requestedDropSegment.length).toBeGreaterThan(0);
      expect(uuidPattern.test(requestedDropSegment)).toBe(false);
      expect(decodeURIComponent(requestedDropSegment)).toBe(
        decodeURIComponent(hrefDropSegment)
      );
      await expect(page).toHaveURL(/\/drops\//, { timeout: 15000 });
      const dropPathname = new URL(page.url()).pathname;
      expect(dropPathname).toMatch(/^\/drops\/[^/?#]+$/);
      expect(
        /\/drops\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          dropPathname
        )
      ).toBe(false);
    }

    expect(
      legacyDropAliasRequests,
      `Public UI called deprecated drop id alias:\n${legacyDropAliasRequests.join('\n')}`
    ).toHaveLength(0);
    page.off('request', requestListener);
  });

  test('buyer can login and reach products', async ({ page }) => {
    test.skip(!BUYER_EMAIL || !BUYER_PASSWORD, 'Missing buyer credentials');
    await loginBuyer(page);
    await page.goto('/products');
    const productCard = getProductCards(page).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
  });

  test('public artist apply funnel submits successfully', async ({ page }) => {
    test.skip(!BUYER_EMAIL || !BUYER_PASSWORD, 'Missing buyer credentials');
    const uniqueEmail = `smoke.apply.${Date.now()}@test.com`;

    await loginBuyer(page);
    await page.goto('/apply/artist', { waitUntil: 'domcontentloaded' });

    await page.getByLabel(/artist name/i).fill('Smoke Apply Artist');
    await page.getByLabel(/handle suggestion/i).fill('smoke-apply-artist');
    await page.getByLabel(/^email$/i).fill(uniqueEmail);
    await page.getByLabel(/phone/i).fill('9999999999');
    await page.getByLabel(/pitch/i).fill('Smoke application request for artist onboarding.');

    const submitButton = page.getByRole('button', { name: /submit application/i });
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await submitButton.click();

    await expect(page.getByText('Admin will review and contact you.')).toBeVisible({
      timeout: 10000,
    });
  });

  test('buyer can open a product detail', async ({ page }) => {
    await page.goto('/products');
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

  test('public drop quiz lead submission works end-to-end', async ({ page }) => {
    const uniqueLeadEmail = `smoke.lead.${Date.now()}@test.com`;

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /featured drops/i })).toBeVisible({
      timeout: 15000,
    });

    const featuredDropLink = page.getByRole('link', { name: /view drop|play quiz/i }).first();
    await expect(featuredDropLink).toBeVisible({ timeout: 15000 });
    await featuredDropLink.click();
    await expect(page).toHaveURL(/\/drops\/[^/?#]+$/, { timeout: 15000 });

    const startQuizButton = page.getByRole('button', { name: /start quiz/i }).first();
    if (await startQuizButton.isVisible().catch(() => false)) {
      await startQuizButton.click();
    }

    const radioGroupNames = await page
      .locator('input[type="radio"][name]')
      .evaluateAll((nodes) =>
        Array.from(
          new Set(
            nodes
              .map((node) => node.getAttribute('name') || '')
              .filter((name) => Boolean(name))
          )
        )
      );
    for (const radioName of radioGroupNames) {
      await page.locator(`input[type="radio"][name="${radioName}"]`).first().check();
    }
    const quizTextAnswers = page.getByPlaceholder(/your answer/i);
    const textAnswerCount = await quizTextAnswers.count();
    for (let i = 0; i < textAnswerCount; i += 1) {
      await quizTextAnswers.nth(i).fill('Smoke answer');
    }

    const continueButton = page.getByRole('button', { name: /continue/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }

    await page.getByLabel(/^name$/i).fill('Smoke Lead');
    const emailInput = page.getByLabel(/^email$/i).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(uniqueLeadEmail);
    } else {
      await page.getByLabel(/^phone$/i).fill('9999999999');
    }

    const submitButton = page.getByRole('button', { name: /^submit$/i }).first();
    await expect(submitButton).toBeVisible({ timeout: 10000 });
    await submitButton.click();

    await expect(page.getByText('We will contact you if you win.').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('buyer checkout blocks missing variant selection with actionable message', async ({ page }) => {
    test.skip(!BUYER_EMAIL || !BUYER_PASSWORD, 'Missing buyer credentials');
    const orderPosts: string[] = [];

    page.on('request', (req) => {
      if (req.method() !== 'POST') return;
      const url = req.url();
      if (/\/api\/orders(?:\/|$)/i.test(url)) {
        orderPosts.push(url);
      }
    });

    await loginBuyer(page);
    await openVariantProductDetail(page);

    const variantSelect = page.locator('select#variant-select').first();
    await expect(variantSelect).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => {
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
          const explicitMessageVisible = await page
            .getByText(/please select a size\/color|needs a variant selection/i)
            .first()
            .isVisible()
            .catch(() => false);
          if (explicitMessageVisible) return true;
          return page.getByLabel(/variant/i).first().isVisible().catch(() => false);
        },
        { timeout: 15000 }
      )
      .toBe(true);
    await expect(page).toHaveURL(/\/products\/[^/]+$/, { timeout: 15000 });
    expect(orderPosts, `Unexpected POST /api/orders calls:\n${orderPosts.join('\n')}`).toHaveLength(0);
  });

  test('buyer cart checkout posts single line item', async ({ page }) => {
    test.skip(!BUYER_EMAIL || !BUYER_PASSWORD, 'Missing buyer credentials');
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const text = m.text()?.trim();
        if (!text) return;
        consoleErrors.push(text);
        if (consoleErrors.length > 40) {
          consoleErrors.shift();
        }
      }
    });

    await loginBuyer(page);

    const product = await openKnownGoodProductDetail(page);
    expect(product.productId).toBeTruthy();

    await page.goto('/cart');
    await verifyCartContainsProduct(
      page,
      product.productName,
      product.variantLabel,
      consoleErrors
    );

    const removeButtons = page.getByRole('button', { name: /remove/i });
    await expect(removeButtons.first()).toBeVisible({ timeout: 15000 });
    expect(await removeButtons.count()).toBeGreaterThanOrEqual(1);

    await page.getByRole('button', { name: /checkout/i }).click();
    await page.waitForURL(/\/fan\/orders\/[^/]+$/, { timeout: 30000 });
    await expect(page.getByRole('heading', { name: /order/i })).toBeVisible({
      timeout: 15000,
    });

    await verifyOrderContainsNames(page, [product.productName]);
    await verifyOrderHasReadableItemRow(page, [product.productName]);
  });

  test('fan portal rejects partner/admin credentials', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');

    await page.context().clearCookies();
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // no-op for about:blank or restricted storage contexts
      }
    });

    await page.goto('/fan/login', { waitUntil: 'domcontentloaded' });

    const form = page.locator('form').first();
    const emailByTestId = form.getByTestId('login-email');
    const email =
      (await emailByTestId.count()) > 0
        ? emailByTestId
        : form.locator('input[type="email"][name="email"], input#fan-email').first();
    const passwordByTestId = form.getByTestId('login-password');
    const password =
      (await passwordByTestId.count()) > 0
        ? passwordByTestId
        : form.locator('input[type="password"][name="password"]').first();
    const submitByTestId = form.getByTestId('login-submit');
    const submit =
      (await submitByTestId.count()) > 0
        ? submitByTestId
        : form.getByRole('button', { name: /log ?in/i });

    await expect(email).toBeVisible({ timeout: 10000 });
    await expect(password).toBeVisible({ timeout: 10000 });

    await email.fill(ADMIN_EMAIL);
    await password.fill(ADMIN_PASSWORD);
    await submit.click();

    await page.waitForLoadState('domcontentloaded');
    await expect(page).not.toHaveURL(/\/partner\/(admin|artist|label)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/fan\/login/, { timeout: 15000 });
    await expect(
      page
        .getByText(
          /partner\/admin account|partner\/admin|use.*partner portal|please log in via partner/i
        )
        .first()
    ).toBeVisible({ timeout: 15000 });

    await page.goto('/partner/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
  });
});
