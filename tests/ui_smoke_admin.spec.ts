import { test, expect, Locator, Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, LABEL_EMAIL, LABEL_PASSWORD } from './_env';
import { gotoApp, loginAdmin, loginLabel } from './helpers/auth';

const selectFirstArtistOption = async (selectLocator: Locator) => {
  await expect
    .poll(async () => selectLocator.locator('option').count(), { timeout: 8000 })
    .toBeGreaterThan(1);

  const options = await selectLocator.locator('option').evaluateAll((nodes) =>
    nodes.map((node, index) => ({
      index,
      value: (node as HTMLOptionElement).value?.trim() ?? '',
      text: (node.textContent ?? '').trim(),
    }))
  );
  const firstSelectable = options.find(
    (option) =>
      option.index > 0 &&
      option.value.length > 0 &&
      !/select|choose|loading/i.test(option.text)
  );
  if (!firstSelectable) {
    const dump = options
      .map((option) => `[index=${option.index} value="${option.value}" text="${option.text}"]`)
      .join(', ');
    throw new Error(
      `No artists available in dropdown. Observed options: ${dump || '<none>'}`
    );
  }
  await selectLocator.selectOption(firstSelectable.value);
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
    const createBtn = page.getByRole('button', { name: /create product/i });
    await expect(createBtn).toBeVisible();

    const filterBar = createBtn.locator('..').locator('..');
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
    const productArtistSelect = page.getByTestId('admin-product-artist-select');
    await expect(productArtistSelect).toBeVisible({ timeout: 10000 });
    await selectFirstArtistOption(productArtistSelect);

    await page.getByPlaceholder('Title').fill(uniqueTitle);
    await page.getByPlaceholder('Description').fill('Created by admin smoke');
    await page.getByPlaceholder('Price').fill('29.99');
    await page.getByPlaceholder('Stock').fill('12');

    await page.getByRole('button', { name: /create product/i }).click();
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
