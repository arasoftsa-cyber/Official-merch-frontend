import { test, expect, type Locator, type Page, type Request } from '@playwright/test';

const ARTIST_EMAIL = process.env.ARTIST_EMAIL;
const ARTIST_PASSWORD = process.env.ARTIST_PASSWORD;
const BASE_URL = 'http://localhost:5173';

const assertNoPortalError = (page: Page) => {
  const url = page.url();
  if (url.includes('portalError=')) {
    throw new Error(`Portal error: ${url}`);
  }
};

const resetAuth = async (page: Page) => {
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
};

const loginArtist = async (page: Page) => {
  await resetAuth(page);
  await page.goto(`${BASE_URL}/partner/login`, { waitUntil: 'domcontentloaded' });
  assertNoPortalError(page);
  const form = page.locator('form').first();
  const emailByTestId = form.getByTestId('login-email');
  const email =
    (await emailByTestId.count()) > 0
      ? emailByTestId
      : form.locator('input[type="email"][name="email"], input#partner-email').first();
  const passwordByTestId = form.getByTestId('login-password');
  const password =
    (await passwordByTestId.count()) > 0
      ? passwordByTestId
      : form.locator('input[type="password"][name="password"]').first();
  const submit = form.getByRole('button', { name: /^login$/i });

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(ARTIST_EMAIL ?? '');
  await password.fill(ARTIST_PASSWORD ?? '');
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  assertNoPortalError(page);
  await Promise.race([
    page.waitForURL(/\/partner\/artist(\/|$)/, { timeout: 15000 }),
    expect(page.getByRole('heading', { name: /artist/i })).toBeVisible({ timeout: 15000 }),
  ]);
  assertNoPortalError(page);
};

const findProductRow = async (page: Page): Promise<Locator> => {
  const rows = page.locator('table tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  return rows.first();
};

const getRowTitle = async (row: Locator) => {
  const value = (await row.locator('td').first().innerText()).trim();
  if (!value) throw new Error('Product row title missing');
  return value;
};

const getRowStatus = async (row: Locator) =>
  ((await row.locator('td').nth(1).innerText()) || '').trim().toLowerCase();

const getToggleControl = async (
  row: Locator
): Promise<{ kind: 'checkbox' | 'button'; locator: Locator }> => {
  const checkbox = row.getByRole('checkbox').first();
  if ((await checkbox.count()) > 0) {
    return { kind: 'checkbox', locator: checkbox };
  }

  const actionButton = row
    .getByRole('button', { name: /set active|set inactive|activate|deactivate/i })
    .first();
  if ((await actionButton.count()) > 0) {
    return { kind: 'button', locator: actionButton };
  }

  throw new Error('No toggle control found in artist product row');
};

type LegacyDropsCall = {
  method: string;
  resourceType: string;
  url: string;
  pageUrl: string;
};

const createArtistDropsGuard = (page: Page) => {
  const legacyDropsCalls: LegacyDropsCall[] = [];
  const handler = (req: Request) => {
    const url = req.url();
    if (url.includes('/api/drops') && !url.includes('/api/artist/drops')) {
      legacyDropsCalls.push({
        method: req.method(),
        resourceType: req.resourceType(),
        url,
        pageUrl: page.url(),
      });
    }
  };
  page.on('request', handler);

  return () => {
    page.off('request', handler);
    const uniqueCalls = Array.from(
      new Map(
        legacyDropsCalls.map((call) => [
          `${call.method}|${call.resourceType}|${call.pageUrl}|${call.url}`,
          call,
        ])
      ).values()
    );
    const details =
      uniqueCalls.length === 0
        ? '<none>'
        : uniqueCalls
            .map(
              (call) =>
                `[${call.method}] (${call.resourceType}) page=${call.pageUrl}\n${call.url}`
            )
            .join('\n\n');
    expect(
      uniqueCalls,
      `Legacy artist drops calls detected. Artist flow must use /api/artist/drops.\n${details}`
    ).toHaveLength(0);
  };
};

test.describe('Artist status smoke', () => {
  test('artist dashboard recent order row drills into order detail', async ({ page }) => {
    test.skip(!ARTIST_EMAIL || !ARTIST_PASSWORD, 'Missing artist credentials');
    const assertNoLegacyDropsCalls = createArtistDropsGuard(page);

    try {
      await loginArtist(page);
      await page.goto('/partner/artist', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/partner\/artist(?:\/)?$/, { timeout: 15000 });

      const recentOrdersSection = page.locator('section:has(h2:has-text("Recent Orders"))').first();
      await expect(recentOrdersSection).toBeVisible({ timeout: 15000 });

      const firstRow = recentOrdersSection
        .locator('tbody tr')
        .filter({ has: page.locator('td:first-child') })
        .filter({
          hasText: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        })
        .first();
      await expect(firstRow).toBeVisible({ timeout: 15000 });

      const firstOrderCell = firstRow.locator('td').first();
      await expect(firstOrderCell).toBeVisible({ timeout: 10000 });
      await expect(firstOrderCell).toHaveText(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
        { timeout: 10000 }
      );

      await firstRow.click();

      await page.waitForURL(/\/partner\/artist\/orders\/[0-9a-f-]{36}$/i, { timeout: 15000 });
      await expect(page).toHaveURL(/\/partner\/artist\/orders\/[0-9a-f-]{36}$/i, {
        timeout: 15000,
      });
      await expect(page.getByRole('heading', { name: /artist order detail/i })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(/order id/i)).toBeVisible({ timeout: 15000 });
    } finally {
      assertNoLegacyDropsCalls();
    }
  });

  test('artist can toggle product active state and it persists after reload', async ({ page }) => {
    test.skip(!ARTIST_EMAIL || !ARTIST_PASSWORD, 'Missing artist credentials');
    const assertNoLegacyDropsCalls = createArtistDropsGuard(page);

    try {
      await loginArtist(page);
      await page.goto('/partner/artist/products', { waitUntil: 'domcontentloaded' });

      const row = await findProductRow(page);
      const title = await getRowTitle(row);
      const beforeStatus = await getRowStatus(row);
      const control = await getToggleControl(row);

      if (control.kind === 'checkbox') {
        await expect(control.locator).toBeVisible({ timeout: 10000 });
        const beforeChecked = await control.locator.isChecked();
        await control.locator.click();
        await expect(control.locator).toHaveJSProperty('checked', !beforeChecked, {
          timeout: 15000,
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        const reloadedRow = page.locator('table tbody tr').filter({ hasText: title }).first();
        if ((await reloadedRow.count()) === 0) {
          expect(beforeChecked).toBe(true);
          return;
        }
        await expect(reloadedRow).toBeVisible({ timeout: 15000 });
        const reloadedControl = await getToggleControl(reloadedRow);
        await expect(reloadedControl.locator).toHaveJSProperty('checked', !beforeChecked, {
          timeout: 15000,
        });
        return;
      }

      await expect(control.locator).toBeVisible({ timeout: 10000 });
      const before = ((await control.locator.innerText()) || '').trim().toLowerCase();
      await control.locator.click();

      const expectedAfter =
        before.includes('inactive') ? /set active|activate/i : /set inactive|deactivate/i;
      await expect(
        row.getByRole('button', { name: expectedAfter }).first()
      ).toBeVisible({ timeout: 15000 });

      await page.reload({ waitUntil: 'domcontentloaded' });

      const reloadedRow = page.locator('table tbody tr').filter({ hasText: title }).first();
      if ((await reloadedRow.count()) === 0) {
        expect(beforeStatus).toBe('active');
        return;
      }
      await expect(reloadedRow).toBeVisible({ timeout: 15000 });
      const afterStatus = await getRowStatus(reloadedRow);
      const expectedStatus = beforeStatus === 'active' ? 'inactive' : 'active';
      expect(afterStatus).toContain(expectedStatus);
    } finally {
      assertNoLegacyDropsCalls();
    }
  });
});
