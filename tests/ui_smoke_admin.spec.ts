import { test, expect, Locator, Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, LABEL_EMAIL, LABEL_PASSWORD } from './_env';
import { gotoApp, loginAdmin, loginLabel } from './helpers/auth';
import path from 'path';

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

const selectMerchTypeTshirt = async (page: Page) => {
  const merchType = page.getByTestId('admin-product-merch-type');
  await expect(merchType).toBeVisible({ timeout: 10000 });

  const merchTypeTag = await merchType
    .evaluate((el) => (el as HTMLElement).tagName.toLowerCase())
    .catch(() => '');

  if (merchTypeTag === 'select') {
    const optionMatch = await merchType.locator('option').evaluateAll((nodes) => {
      const normalized = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, '');
      const found = nodes
        .map((node, index) => ({
          index,
          value: (node as HTMLOptionElement).value?.trim() ?? '',
          text: (node.textContent ?? '').trim(),
        }))
        .find((entry) => /t[\s_-]*shirt/i.test(entry.text) || normalized(entry.value) === 'tshirt');
      return found || null;
    });
    if (optionMatch?.value) {
      await merchType.selectOption(optionMatch.value);
    } else {
      const fallbacks = ['tshirt', 't_shirt', 't-shirt'];
      let selected = false;
      for (const value of fallbacks) {
        try {
          await merchType.selectOption(value);
          selected = true;
          break;
        } catch (_err) {
          // try next fallback
        }
      }
      if (!selected) {
        await merchType.selectOption({ index: 0 });
      }
    }
    await expect
      .poll(async () => (await merchType.inputValue()).toLowerCase(), { timeout: 5000 })
      .toMatch(/t[\s_-]*shirt/i);
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
    const createButton = page.getByRole('button', { name: /create product/i });
    const createLink = page.getByRole('link', { name: /create product/i });
    const createAction =
      (await createButton.count().catch(() => 0)) > 0 ? createButton.first() : createLink.first();
    await expect(createAction).toBeVisible();

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
    return false;
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
  test('admin can create product and manage variants', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);

    await gotoApp(page, '/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/products/);

    const uniqueTitle = `Smoke Admin Product ${Date.now()}`;
    await page.getByRole('link', { name: /create product/i }).click();
    await expect(page).toHaveURL(/\/partner\/admin\/products\/new/);

    const artistSelect = page.getByTestId('admin-product-artist');
    await expect(artistSelect).toBeVisible();
    await expect(artistSelect).toBeEnabled();
    await selectFirstRealOption(artistSelect);

    await page.getByTestId('admin-product-merch-name').fill(uniqueTitle);
    await page.getByLabel(/^Merch Story$/i).fill('Created by admin smoke with listing photos');
    const vendorPayInput = page.getByTestId('admin-product-vendor-pay');
    const ourShareInput = page.getByTestId('admin-product-our-share');
    const royaltyInput = page.getByTestId('admin-product-royalty');
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

    await page.getByRole('button', { name: /^Create Product$/i }).click();
    await expect(page).toHaveURL(/\/partner\/admin\/products$/, { timeout: 15000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const createdRow = await findRowByTextWithRetry(page, uniqueTitle, {
      attempts: 6,
      delayMs: 500,
    });
    await createdRow.getByRole('button', { name: /variants/i }).click();
    await expect(page).toHaveURL(/\/partner\/admin\/products\/.+\/variants/);
    const productId = page.url().match(/\/partner\/admin\/products\/([^/]+)\/variants/)?.[1] ?? '';

    const sku = `ADM-${Date.now()}`;
    await page.getByRole('button', { name: /add variant/i }).click();

    const skuInput = page.getByPlaceholder('SKU').last();
    const sizeInput = page.getByPlaceholder('Size').last();
    const colorInput = page.getByPlaceholder('Color').last();
    const priceInput = page.getByPlaceholder('Price cents').last();
    const stockInput = page.getByPlaceholder('Stock').last();

    await skuInput.fill(sku);
    await sizeInput.fill('L');
    await colorInput.fill('Black');
    await priceInput.fill('2999');
    await stockInput.fill('20');

    await page.getByRole('button', { name: /save variants/i }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        async () => {
          // SKU is rendered as an <input value="...">, so getByText() will not work.
          const skuInput = page.locator(`input[value="${sku}"]`).first();
          if (await skuInput.count()) return await skuInput.isVisible();

          // Fallback: check any input currently contains sku substring (some UIs may trim/format)
          const anySkuLike = page.locator('input').filter({ hasText: '' }); // keep as inputs only
          const n = await anySkuLike.count();
          for (let i = 0; i < Math.min(n, 30); i++) {
            const v = await anySkuLike.nth(i).inputValue().catch(() => '');
            if (v && v.includes(sku)) return true;
          }
          return false;
        },
        { timeout: 15000 }
      )
      .toBe(true);
  });

});

test.describe('Label smoke', () => {
  test('label dashboard renders portfolio overview', async ({ page }) => {
    test.skip(!LABEL_EMAIL || !LABEL_PASSWORD, 'Missing label credentials');
    await loginLabel(page);
    await gotoApp(page, '/partner/label');
    const shellHeading = page.getByRole('heading', { name: /label dashboard/i }).first();
    await expect(shellHeading).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/^artists$/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/^active artists$/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/^inactive artists$/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/^label gross$/i)).toBeVisible({ timeout: 15000 });
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
    await expect(page).toHaveURL(/\/partner\/login/, { timeout: 15000 });

    await gotoApp(page, '/partner/label', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
    const redirectedUrl = new URL(page.url());
    if (redirectedUrl.pathname === '/fan/login') {
      expect(redirectedUrl.searchParams.get('returnUrl')).toBe('/partner/label');
    }
  });
});
