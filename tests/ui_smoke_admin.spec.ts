import { test, expect, Locator, Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, LABEL_EMAIL, LABEL_PASSWORD } from './_env';
import { gotoApp, loginAdmin, loginLabel } from './helpers/auth';
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

test.describe('Admin smoke', () => {
  test('admin can create product and manage variants', async ({ page }, testInfo) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);

    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/products/);

    const createProduct = page
      .getByRole('link', { name: /create product|launch product/i })
      .or(page.getByRole('button', { name: /create product|launch product/i }))
      .or(page.getByText(/create product|launch product/i));
    await expect(createProduct.first()).toBeVisible({ timeout: 15000 });
    await createProduct.first().click();
    await expect(page).toHaveURL(/\/partner\/admin\/products\/new/);

    const artistSelect = await waitForSelectReady(page, 'admin-product-artist');
    await selectFirstRealOption(artistSelect);

    const merchNameInput = await pickFirstVisible(
      [
        page.getByTestId('admin-product-merch-name'),
        page.getByLabel(/merch name/i),
        page.getByPlaceholder(/vintage rock tee|merch name/i),
      ],
      'merch name input'
    );
    await fillIfEmpty(merchNameInput, 'Smoke Tee');
    await page.getByLabel(/^Merch Story$/i).fill('Created by admin smoke with listing photos');
    const vendorPayInput = await pickFirstVisible(
      [
        page.getByTestId('admin-product-vendor-pay'),
        page.getByLabel(/vendor pay/i),
        page.getByPlaceholder(/vendor pay/i),
      ],
      'vendor pay input'
    );
    const ourShareInput = await pickFirstVisible(
      [
        page.getByTestId('admin-product-our-share'),
        page.getByLabel(/our share/i),
        page.getByPlaceholder(/our share/i),
      ],
      'our share input'
    );
    const royaltyInput = await pickFirstVisible(
      [
        page.getByTestId('admin-product-royalty'),
        page.getByLabel(/royalty/i),
        page.getByPlaceholder(/royalty/i),
      ],
      'royalty input'
    );
    await fillIfEmpty(vendorPayInput, '1');
    await fillIfEmpty(ourShareInput, '1');
    await fillIfEmpty(royaltyInput, '1');
    await selectMerchTypeTshirt(page);

    const fixturesDir = path.resolve(__dirname, 'fixtures');
    const photoFiles = [
      path.join(fixturesDir, 'listing-photo-1.png'),
      path.join(fixturesDir, 'listing-photo-2.png'),
      path.join(fixturesDir, 'listing-photo-3.png'),
      path.join(fixturesDir, 'listing-photo-4.png'),
    ];
    await page
      .locator('input[type="file"]')
      .setInputFiles(photoFiles);

    const createProductResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/admin\/products(?:[/?#]|$)/i.test(response.url()),
      { timeout: 30000 }
    );
    const launchBtn = page.getByRole('button', { name: /^launch product$/i });
    await expect(launchBtn).toBeVisible({ timeout: 15000 });
    await launchBtn.click();
    const createProductResponse = await createProductResponsePromise.catch(() => null);
    if (!createProductResponse) {
      await page.screenshot({
        path: testInfo.outputPath('create-product-post-never-fired.png'),
        fullPage: true,
      });
      throw new Error(
        'Create product POST /api/admin/products never fired; likely form validation prevented submit'
      );
    }
    if (![200, 201].includes(createProductResponse.status())) {
      const body = await createProductResponse.text().catch(() => '<unavailable>');
      throw new Error(`Create product failed (${createProductResponse.status()}): ${body}`);
    }
    const createPayload = createProductResponse
      ? await createProductResponse.json().catch(() => null)
      : null;
    const createdProductId =
      createPayload?.id ||
      createPayload?.product?.id ||
      createPayload?.data?.id ||
      null;
    await expect(page).toHaveURL(/\/partner\/admin\/products$/, { timeout: 15000 });
    if (createdProductId) {
      await gotoApp(page, `/partner/admin/products/${createdProductId}/variants`, {
        waitUntil: 'domcontentloaded',
      });
    } else {
      const variantsAction = page
        .getByRole('button', { name: /variants/i })
        .or(page.getByRole('link', { name: /variants/i }))
        .or(page.getByText(/variants/i));
      await expect(variantsAction.first()).toBeVisible({ timeout: 20000 });
      await variantsAction.first().click();
    }
    await expect(page).toHaveURL(/\/partner\/admin\/products\/.+\/variants/);
    await expect(page.getByRole('heading', { name: /product variants/i })).toBeVisible({ timeout: 15000 });
    const productId = page.url().match(/\/partner\/admin\/products\/([^/]+)\/variants/)?.[1] ?? '';
    expect(productId, `Missing productId in variants URL: ${page.url()}`).toBeTruthy();

    const sku = `SKU-ADM-${Date.now()}`;
    const addBtn = page.getByRole('button', { name: /add new config/i });
    await expect(addBtn).toBeVisible({ timeout: 15000 });
    await addBtn.click();

    let lastRow = page.locator('table tr').last();
    if ((await lastRow.locator('input').count().catch(() => 0)) < 5) {
      lastRow = page
        .locator('[data-testid="variant-row"], .variant-row, [role="row"], div.group:has(input)')
        .last();
    }

    let skuInput = lastRow.locator('input').nth(0);
    let sizeInput = lastRow.locator('input').nth(1);
    let colorInput = lastRow.locator('input').nth(2);
    let priceInput = lastRow.locator('input').nth(3);
    let stockInput = lastRow.locator('input').nth(4);

    if ((await lastRow.locator('input').count().catch(() => 0)) < 5) {
      const allInputs = page.locator('input');
      const totalInputs = await allInputs.count();
      if (totalInputs < 5) {
        throw new Error('Variant grid inputs not found after clicking Add New Config.');
      }
      skuInput = allInputs.nth(totalInputs - 5);
      sizeInput = allInputs.nth(totalInputs - 4);
      colorInput = allInputs.nth(totalInputs - 3);
      priceInput = allInputs.nth(totalInputs - 2);
      stockInput = allInputs.nth(totalInputs - 1);
    }

    await skuInput.fill(sku);
    await sizeInput.fill('M');
    await colorInput.fill('black');
    await priceInput.fill('2199');
    await stockInput.fill('10');

    const deployVariantsResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/api\/admin\/products\/[^/]+\/variants(?:[/?#]|$)/i.test(response.url()) &&
        response.status() < 400,
      { timeout: 30000 }
    );
    const deployBtn = page.getByRole('button', { name: /deploy changes/i });
    await expect(deployBtn).toBeVisible({ timeout: 15000 });
    await deployBtn.click();
    const deployVariantsResponse = await deployVariantsResponsePromise;
    if (!deployVariantsResponse.ok()) {
      const body = await deployVariantsResponse.text().catch(() => '<unavailable>');
      throw new Error(`Deploy variants failed (${deployVariantsResponse.status()}): ${body}`);
    }
    await expect
      .poll(
        async () => {
          let persistedLastRow = page.locator('table tr').last();
          if ((await persistedLastRow.locator('input').count().catch(() => 0)) < 5) {
            persistedLastRow = page
              .locator('[data-testid="variant-row"], .variant-row, [role="row"], div.group:has(input)')
              .last();
          }
          const inputs = persistedLastRow.locator('input');
          if ((await inputs.count().catch(() => 0)) < 5) return false;
          const skuValue = (await inputs.nth(0).inputValue().catch(() => '')).trim();
          const sizeValue = (await inputs.nth(1).inputValue().catch(() => '')).trim();
          const colorValue = (await inputs.nth(2).inputValue().catch(() => '')).trim().toLowerCase();
          const priceValue = (await inputs.nth(3).inputValue().catch(() => '')).trim();
          const stockValue = (await inputs.nth(4).inputValue().catch(() => '')).trim();
          return (
            skuValue.length > 0 &&
            sizeValue === 'M' &&
            colorValue === 'black' &&
            priceValue === '2199' &&
            stockValue === '10'
          );
        },
        { timeout: 20000 }
      )
      .toBe(true);

    const persistedInputs = page.locator('input');
    await expect(persistedInputs.first()).toBeVisible({ timeout: 10000 });
    await expect(persistedInputs.first()).toBeEnabled({ timeout: 10000 });
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
