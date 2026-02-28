import { test, expect, Page, APIRequestContext, request as playwrightRequest } from '@playwright/test';
import { spawnSync } from 'child_process';
import * as path from 'path';
import { ADMIN_EMAIL, ADMIN_PASSWORD, BUYER_EMAIL, BUYER_PASSWORD } from './_env';
import { gotoApp, loginBuyer, loginFanWithCredentials } from './helpers/auth';
import { getApiUrl } from './helpers/urls';

const PRODUCT_CARD_SELECTORS = ['article[role="button"]', '[data-testid*="product"]', '[data-testid*="card"]'];
const DEFAULT_SMOKE_DROP_HANDLE = 'seed-drop';
const FALLBACK_SMOKE_DROP_HANDLE = 'ui-smoke-featured-drop';
const DEV_SEED_ENDPOINTS = [
  '/api/dev/seed-ui-smoke',
  '/api/dev/seed-smoke-drop-quiz',
  '/api/dev/seed_smoke_drop_quiz',
  '/api/dev/seed-smoke',
];

const getHandleFromPayload = (payload: any): string | null => {
  const candidates = [
    payload?.drop?.handle,
    payload?.handle,
    payload?.updatedHandle,
    payload?.row?.handle,
    payload?.dropHandle,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
};

const ensureSmokeDropQuiz = async (request: APIRequestContext): Promise<string> => {
  let seededHandle: string | null = null;
  let hasDevSeedSuccess = false;

  for (const endpoint of DEV_SEED_ENDPOINTS) {
    const response = await request.post(getApiUrl(endpoint), { failOnStatusCode: false });
    const status = response.status();
    const bodyText = await response.text().catch(() => '');

    if (status >= 200 && status < 300) {
      hasDevSeedSuccess = true;
      try {
        const payload = bodyText ? JSON.parse(bodyText) : null;
        seededHandle = getHandleFromPayload(payload) || seededHandle;
      } catch {
        // Ignore non-JSON body from successful seed endpoint.
      }
      break;
    }

    if (status === 404) {
      continue;
    }

    throw new Error(
      `Smoke drop seed endpoint failed: POST ${endpoint} returned ${status}. body=${bodyText}`
    );
  }

  if (!hasDevSeedSuccess) {
    const backendDir = path.resolve(process.cwd(), '..', 'Official-merch-backend');
    const seedResult = spawnSync('node', ['scripts/seed_smoke_drop_quiz.js'], {
      cwd: backendDir,
      encoding: 'utf8',
    });
    const stdout = String(seedResult.stdout || '').trim();
    const stderr = String(seedResult.stderr || '').trim();

    if (seedResult.error) {
      throw new Error(
        `Failed to run seed_smoke_drop_quiz.js: ${seedResult.error.message}\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    if (seedResult.status !== 0) {
      throw new Error(
        `seed_smoke_drop_quiz.js exited with code ${seedResult.status}\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }

    const handleMatch = stdout.match(/"updatedHandle"\s*:\s*"([^"]+)"/i);
    if (handleMatch?.[1]) {
      seededHandle = handleMatch[1];
    }
  }

  const handleCandidates = Array.from(
    new Set(
      [seededHandle, DEFAULT_SMOKE_DROP_HANDLE, FALLBACK_SMOKE_DROP_HANDLE].filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0
      )
    )
  );
  let resolvedHandle: string | null = null;

  await expect
    .poll(
      async () => {
        for (const handle of handleCandidates) {
          const dropResponse = await request.get(getApiUrl(`/api/drops/${handle}`), {
            failOnStatusCode: false,
          });
          if (dropResponse.status() !== 200) {
            continue;
          }

          const payload = await dropResponse.json().catch(() => ({} as any));
          const drop = payload?.drop || payload || {};
          const quiz = drop?.quiz_json ?? drop?.quizJson ?? null;
          const hasQuizTitle = String(quiz?.title || '').trim() === 'Smoke Drop Quiz';
          const hasQuizJson = quiz != null;
          if (hasQuizTitle || hasQuizJson) {
            resolvedHandle = handle;
            return 'ready';
          }

          return `drop_found_without_quiz_${handle}`;
        }

        return `drop_not_ready_${handleCandidates.join('|')}`;
      },
      { timeout: 15000, intervals: [500, 1000, 1500] }
    )
    .toBe('ready');

  return resolvedHandle || seededHandle || DEFAULT_SMOKE_DROP_HANDLE;
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

const openVariantProductDetail = async (
  page: Page
): Promise<{ productName: string; productId: string }> => {
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
  const variantSelect = page.locator('select#variant-select').first();
  await expect(variantSelect).toBeVisible({ timeout: 10000 });
  return { productName: title, productId };
};


test.describe('Buyer smoke', () => {
  test('label alias endpoint includes deprecation headers', async () => {
    const apiContext: APIRequestContext = await playwrightRequest.newContext({
      extraHTTPHeaders: { Accept: 'application/json' },
    });
    try {
      const response = await apiContext.get(getApiUrl('/api/label/dashboard/summary'));
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

    await gotoApp(page, '/', { waitUntil: 'domcontentloaded' });

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
      await gotoApp(page, '/', { waitUntil: 'domcontentloaded' });
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
    await gotoApp(page, '/products');
    const productCard = getProductCards(page).first();
    await expect(productCard).toBeVisible({ timeout: 15000 });
  });

  test('buyer can open a product detail', async ({ page }) => {
    await gotoApp(page, '/products');
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

  test('public drop quiz lead submission works end-to-end', async ({ page, request }) => {
    const uniqueLeadEmail = `smoke.lead.${Date.now()}@example.invalid`;
    const dropHandle = await ensureSmokeDropQuiz(request);

    const dropDetailsResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /\/api\/drops\/[^/?#]+$/i.test(response.url()) &&
        !/\/api\/drops\/featured(?:[/?#]|$)/i.test(response.url()) &&
        [200, 304].includes(response.status()),
      { timeout: 15000 }
    );
    await gotoApp(page, `/drops/${dropHandle}`, { waitUntil: 'domcontentloaded' });
    await dropDetailsResponse;
    await expect(page).toHaveURL(new RegExp(`/drops/${dropHandle}(?:[/?#]|$)`), {
      timeout: 15000,
    });

    await expect
      .poll(
        async () => {
          const hasStartQuiz = await page
            .getByRole('button', { name: /start quiz/i })
            .first()
            .isVisible()
            .catch(() => false);
          const hasQuizFields = (await page.locator('input[type="radio"][name]').count()) > 0;
          const hasLeadFields = await page.getByLabel(/^name$/i).first().isVisible().catch(() => false);
          return hasStartQuiz || hasQuizFields || hasLeadFields;
        },
        { timeout: 15000 }
      )
      .toBe(true);

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
    const submitLeadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/leads(?:[/?#]|$)/i.test(response.url()) &&
        [200, 201].includes(response.status()),
      { timeout: 10000 }
    );
    await submitButton.click();
    await submitLeadResponse;

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

  test('fan portal rejects partner/admin credentials', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginFanWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).not.toHaveURL(/\/partner\/(admin|artist|label)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/fan\/login/, { timeout: 15000 });
    await expect(
      page
        .getByText(
          /partner\/admin account|partner\/admin|use.*partner portal|please log in via partner/i
        )
        .first()
    ).toBeVisible({ timeout: 15000 });

    await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
  });
});
