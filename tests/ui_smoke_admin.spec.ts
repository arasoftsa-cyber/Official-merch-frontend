import { test, expect, Page, Locator } from '@playwright/test';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const LABEL_EMAIL = process.env.LABEL_EMAIL;
const LABEL_PASSWORD = process.env.LABEL_PASSWORD;
const ARTIST_EMAIL = process.env.ARTIST_EMAIL;
const ARTIST_PASSWORD = process.env.ARTIST_PASSWORD;
const UI_ARTIST_EMAIL = process.env.UI_ARTIST_EMAIL || 'artist1@test.com';
const UI_ARTIST_PASSWORD = process.env.UI_ARTIST_PASSWORD || '123456789';
const SEEDED_ARTIST_ID = '11111111-1111-1111-1111-111111111111';
const BASE_URL = 'http://localhost:5173';

async function pickFirstRealOption(
  selectLocator: Locator,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {}
) {
  const findFirstRealOptionValue = async () => {
    const options = await selectLocator.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value?.trim() ?? '',
        text: (node.textContent ?? '').trim(),
      }))
    );
    const realOption = options.find(
      (option) =>
        option.value.length > 0 &&
        option.value !== 'placeholder' &&
        option.text.length > 0 &&
        !/select|choose|loading/i.test(option.text)
    );
    return realOption?.value ?? '';
  };

  try {
    await expect
      .poll(async () => findFirstRealOptionValue(), { timeout: timeoutMs })
      .not.toBe('');
  } catch {
    const options = await selectLocator.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value?.trim() ?? '',
        text: (node.textContent ?? '').trim(),
      }))
    );
    const dump = options.map((option) => `[value="${option.value}" text="${option.text}"]`).join(', ');
    throw new Error(
      `Timed out waiting for a real select option. Observed options: ${dump || '<none>'}`
    );
  }

  return findFirstRealOptionValue();
}

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

const loginAdmin = async (page: Page) => {
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

  await email.fill(ADMIN_EMAIL ?? '');
  await password.fill(ADMIN_PASSWORD ?? '');
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  assertNoPortalError(page);
  await Promise.race([
    page.waitForURL(/\/partner\/admin(\/|$)/, { timeout: 15000 }),
    expect(page.getByRole('heading', { name: /admin/i })).toBeVisible({ timeout: 15000 }),
  ]);
  assertNoPortalError(page);
};

const loginLabel = async (page: Page) => {
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

  await email.fill(LABEL_EMAIL ?? '');
  await password.fill(LABEL_PASSWORD ?? '');
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  assertNoPortalError(page);
  await Promise.race([
    page.waitForURL(/\/partner\/label(\/|$)/, { timeout: 15000 }),
    expect(page.getByRole('heading', { name: /label dashboard/i })).toBeVisible({
      timeout: 15000,
    }),
  ]);
  assertNoPortalError(page);
};

const loginArtist = async (
  page: Page,
  credentials?: { email?: string | null; password?: string | null }
) => {
  await resetAuth(page);
  await page.goto(`${BASE_URL}/partner/login`, { waitUntil: 'domcontentloaded' });
  assertNoPortalError(page);
  const form = page.locator('form').first();
  const email = form.getByTestId('login-email');
  const password = form.getByTestId('login-password');
  const submit = form.getByRole('button', { name: /^login$/i });

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(credentials?.email ?? UI_ARTIST_EMAIL ?? ARTIST_EMAIL ?? '');
  await password.fill(credentials?.password ?? UI_ARTIST_PASSWORD ?? ARTIST_PASSWORD ?? '');
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  assertNoPortalError(page);
  await Promise.race([
    page.waitForURL(/\/partner\/artist(\/|$)/, { timeout: 15000 }),
    expect(page.getByRole('heading', { name: /artist/i })).toBeVisible({ timeout: 15000 }),
  ]);
  assertNoPortalError(page);
};

const ensureArtistOptionAvailable = async (page: Page) => {
  const getFirstRealOption = async (select: ReturnType<Page['locator']>) => {
    const options = await select.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value?.trim() ?? '',
        label: (node.textContent ?? '').trim(),
      }))
    );
    return (
      options.find(
        (option) =>
          option.value.length > 0 && option.label.length > 0 && !/select/i.test(option.label)
      ) ||
      options.find((option) => option.value.length > 0) ||
      options.find((option) => option.label.length > 0 && !/select/i.test(option.label)) ||
      null
    );
  };

  const artistSelect = page.locator('select').first();
  await expect(artistSelect).toBeVisible({ timeout: 10000 });

  const existingOption = await getFirstRealOption(artistSelect);
  if (existingOption) {
    if (existingOption.value) {
      await artistSelect.selectOption(existingOption.value);
    } else {
      await artistSelect.selectOption({ label: existingOption.label });
    }
    return;
  }

  const loginRes = await page.request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginBody = await loginRes.json();
  const accessToken = loginBody?.accessToken;
  expect(accessToken).toBeTruthy();

  const unique = Date.now();
  const createRes = await page.request.post('/api/admin/provisioning/create-artist', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      handle: `smoke-admin-artist-${unique}`,
      name: `Smoke Admin Artist ${unique}`,
      theme: {},
    },
  });
  expect([200, 409]).toContain(createRes.status());

  let refreshedSelect = artistSelect;
  let firstRealOption: { value: string; label: string } | null = null;
  await page.goto('/partner/admin/products', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/partner\/admin\/products/);
  refreshedSelect = page.locator('select').first();
  await expect(refreshedSelect).toBeVisible({ timeout: 10000 });
  await expect
    .poll(
      async () => {
        firstRealOption = await getFirstRealOption(refreshedSelect);
        if (firstRealOption) return firstRealOption.value || firstRealOption.label || '__ok__';
        await page.reload({ waitUntil: 'domcontentloaded' });
        refreshedSelect = page.locator('select').first();
        await expect(refreshedSelect).toBeVisible({ timeout: 10000 });
        return '';
      },
      { timeout: 15000 }
    )
    .not.toBe('');

  expect(firstRealOption).toBeTruthy();
  if (firstRealOption!.value) {
    await refreshedSelect.selectOption(firstRealOption!.value);
  } else {
    await refreshedSelect.selectOption({ label: firstRealOption!.label });
  }
};

test.describe('Admin smoke', () => {
  test('admin can create product and manage variants', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    await loginAdmin(page);

    await page.goto('/partner/admin/products', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/products/);

    const uniqueTitle = `Smoke Admin Product ${Date.now()}`;
    await ensureArtistOptionAvailable(page);

    await page.getByPlaceholder('Title').fill(uniqueTitle);
    await page.getByPlaceholder('Description').fill('Created by admin smoke');
    await page.getByPlaceholder('Price').fill('29.99');
    await page.getByPlaceholder('Stock').fill('12');

    await page.getByRole('button', { name: /create product/i }).click();

    const createdRow = page.locator('table tbody tr').filter({ hasText: uniqueTitle }).first();
    await expect(createdRow).toBeVisible({ timeout: 15000 });

    await createdRow.getByRole('button', { name: /variants/i }).click();
    await expect(page).toHaveURL(/\/partner\/admin\/products\/.+\/variants/);

    const uniqueSku = `ADM-${Date.now()}`;
    await page.getByRole('button', { name: /add variant/i }).click();

    const skuInput = page.getByPlaceholder('SKU').last();
    const sizeInput = page.getByPlaceholder('Size').last();
    const colorInput = page.getByPlaceholder('Color').last();
    const priceInput = page.getByPlaceholder('Price cents').last();
    const stockInput = page.getByPlaceholder('Stock').last();

    await skuInput.fill(uniqueSku);
    await sizeInput.fill('L');
    await colorInput.fill('Black');
    await priceInput.fill('2999');
    await stockInput.fill('20');

    await page.getByRole('button', { name: /save variants/i }).click();
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expect(page.locator(`input[value="${uniqueSku}"]`).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('admin and artist drops views stay in sync for published drops', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');

    let currentStep = 'init';
    const adminSteps = new Set([
      'goto admin drops',
      'open create drop',
      'create drop submit',
      'open edit modal',
      'attach product',
      'save mapping',
      'publish drop',
      'unpublish drop',
      'archive drop',
    ]);
    const dropTitle = `UI Smoke Drop ${Date.now()}`;
    const legacyCalls: {
      url: string;
      method: string;
      resourceType: string;
      step: string;
      pageUrl: string;
    }[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/drops') && !url.includes('/api/admin/drops')) {
        legacyCalls.push({
          url,
          method: req.method(),
          resourceType: req.resourceType(),
          step: currentStep,
          pageUrl: page.url(),
        });
      }
    });
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text()?.trim();
      if (!text) return;
      consoleErrors.push(text);
      if (consoleErrors.length > 20) {
        consoleErrors.shift();
      }
    });

    await loginAdmin(page);
    currentStep = 'goto admin drops';
    await page.goto('/partner/admin/drops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/drops/, { timeout: 15000 });

    const artistSelect = page.getByLabel('Artist');
    await expect(artistSelect).toBeVisible({ timeout: 10000 });
    await pickFirstRealOption(artistSelect);
    const artistOptions = await artistSelect.locator('option').evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: (node as HTMLOptionElement).value?.trim() ?? '',
        text: (node.textContent ?? '').trim(),
      }))
    );
    const realOptions = artistOptions.filter(
      (option) =>
        option.value.length > 0 &&
        option.value !== 'placeholder' &&
        option.text.length > 0 &&
        !/select|choose|loading/i.test(option.text)
    );
    const findByText = (pattern: RegExp) =>
      realOptions.find((option) => pattern.test(option.text));
    const matchedArtistOption =
      findByText(/atanu/i) ||
      findByText(/artist1@test\.com/i) ||
      findByText(/artist1/i) ||
      null;
    if (!matchedArtistOption) {
      const dump = artistOptions
        .map((option) => `[value="${option.value}" text="${option.text}"]`)
        .join(', ');
      throw new Error(
        `No artist option matched the artist login (expected Atanu/artist1). Available options: ${dump || '<none>'}`
      );
    }
    await artistSelect.selectOption(matchedArtistOption.value);
    currentStep = 'open create drop';
    await page.getByPlaceholder('Drop title').fill(dropTitle);
    currentStep = 'create drop submit';
    await page.getByRole('button', { name: /create drop/i }).click();

    const findAdminRow = () =>
      page
        .locator('div.divide-y > div')
        .filter({ hasText: dropTitle })
        .first();

    let adminRow = findAdminRow();
    await expect(adminRow).toBeVisible({ timeout: 15000 });
    await expect(adminRow.locator('span').nth(2)).toContainText(/draft/i, { timeout: 15000 });

    const getDropIdFromRow = async (row: ReturnType<typeof findAdminRow>) => {
      const editButton = row.locator('[data-testid^="admin-drop-edit-"]').first();
      await expect(editButton).toBeVisible({ timeout: 15000 });
      const testId = await editButton.getAttribute('data-testid');
      const dropId = testId?.replace('admin-drop-edit-', '').trim();
      if (!dropId) {
        throw new Error(`Unable to resolve drop id from row for ${dropTitle}`);
      }
      return dropId;
    };

    const clickAdminAction = async (
      row: ReturnType<typeof findAdminRow>,
      dropId: string,
      action: 'publish' | 'unpublish' | 'archive'
    ) => {
      const menuButton = row.getByTestId(`admin-drop-menu-${dropId}`);
      await expect(menuButton).toBeVisible({ timeout: 15000 });
      await menuButton.click();
      const actionItem = page.getByTestId(`admin-drop-${action}-${dropId}`);
      await expect(actionItem).toBeVisible({ timeout: 15000 });
      await actionItem.click();
    };

    const waitForAdminStatus = async (expected: RegExp) => {
      await expect(findAdminRow().locator('span').nth(2)).toContainText(expected, {
        timeout: 15000,
      });
    };

    const collectBannerText = async () => {
      const texts = await page
        .locator('[role="alert"], [role="status"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node.textContent || '').trim()).filter(Boolean)
        );
      return texts.join(' | ');
    };

    const dropId = await getDropIdFromRow(adminRow);
    const editButton = adminRow.getByTestId(`admin-drop-edit-${dropId}`);
    await expect(editButton).toBeVisible({ timeout: 15000 });
    currentStep = 'open edit modal';
    await editButton.click();

    const editDialog = page.getByRole('dialog', { name: /edit drop/i });
    await expect(editDialog).toBeVisible({ timeout: 15000 });
    const attachProductsSection = editDialog
      .locator('section')
      .filter({ hasText: /attach products/i })
      .first();
    await expect(attachProductsSection).toBeVisible({ timeout: 15000 });
    const attachCheckboxes = attachProductsSection.locator('input[type="checkbox"]');
    const modalError = editDialog.locator('[role="alert"]').first();

    await expect
      .poll(
        async () => {
          if ((await attachCheckboxes.count()) > 0) return 'checkboxes';
          if (await modalError.isVisible().catch(() => false)) return 'error';
          return 'loading';
        },
        { timeout: 15000 }
      )
      .toMatch(/checkboxes|error/);
    if ((await attachCheckboxes.count()) === 0) {
      const errorText =
        (await modalError.textContent())?.trim() ||
        ((await editDialog.textContent())?.trim() || 'Unknown modal content');
      const lastFiveConsoleErrors = consoleErrors.slice(-5);
      throw new Error(
        `Edit Drop modal products load failed: ${errorText}. Console errors: ${
          lastFiveConsoleErrors.length > 0 ? lastFiveConsoleErrors.join(' | ') : 'none'
        }`
      );
    }

    const smokeTeeCheckbox = attachProductsSection
      .locator('label', { hasText: /smoke tee/i })
      .locator('input[type="checkbox"]')
      .first();
    const productCheckbox =
      (await smokeTeeCheckbox.count()) > 0 ? smokeTeeCheckbox : attachCheckboxes.first();
    await expect(productCheckbox).toBeVisible({ timeout: 15000 });
    currentStep = 'attach product';
    if (!(await productCheckbox.isChecked())) {
      await productCheckbox.check();
    }

    const saveButton = editDialog.getByRole('button', { name: /^save$/i });
    await expect(saveButton).toBeVisible({ timeout: 15000 });
    currentStep = 'save mapping';
    await saveButton.click();

    await expect
      .poll(
        async () => {
          if (!(await editDialog.isVisible().catch(() => false))) return 'closed';
          const notice = page.locator('[role="status"]').first();
          if ((await notice.count()) > 0 && (await notice.isVisible().catch(() => false))) {
            const text = (await notice.textContent())?.trim().toLowerCase() || '';
            if (text.includes('drop updated') || text.includes('saved')) return 'saved';
          }
          return 'pending';
        },
        { timeout: 15000 }
      )
      .toMatch(/closed|saved/);

    adminRow = findAdminRow();
    const publishMenuButton = adminRow.getByTestId(`admin-drop-menu-${dropId}`);
    await expect(publishMenuButton).toBeVisible({ timeout: 15000 });
    await publishMenuButton.click();
    const publishItem = page.getByTestId(`admin-drop-publish-${dropId}`);
    await expect(publishItem).toBeVisible({ timeout: 15000 });
    await expect(publishItem).toBeEnabled({ timeout: 15000 });
    await page.keyboard.press('Escape');

    currentStep = 'publish drop';
    await clickAdminAction(adminRow, dropId, 'publish');

    try {
      await waitForAdminStatus(/published/i);
    } catch (err) {
      const bannerText = await collectBannerText();
      throw new Error(`Admin publish did not reach published. Banner: ${bannerText || 'none'}`);
    }

    currentStep = 'unpublish drop';
    await clickAdminAction(findAdminRow(), dropId, 'unpublish');
    try {
      await waitForAdminStatus(/draft/i);
    } catch (err) {
      const bannerText = await collectBannerText();
      throw new Error(`Admin unpublish did not reach draft. Banner: ${bannerText || 'none'}`);
    }

    await clickAdminAction(findAdminRow(), dropId, 'publish');
    try {
      await waitForAdminStatus(/published/i);
    } catch (err) {
      const bannerText = await collectBannerText();
      throw new Error(`Admin publish did not reach published. Banner: ${bannerText || 'none'}`);
    }
    currentStep = 'verify public drop route';
    await page.goto('/drops', { waitUntil: 'domcontentloaded' });
    const publicDropRow = page.locator('li').filter({ hasText: dropTitle }).first();
    await expect(publicDropRow).toBeVisible({ timeout: 15000 });
    await publicDropRow.getByRole('link', { name: /view/i }).click();
    await expect(page).toHaveURL(/\/drops\/(?![0-9a-f-]{36}(?:[/?#]|$))[^/?#]+$/i, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: dropTitle })).toBeVisible({ timeout: 15000 });
    await page.goto('/partner/admin/drops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/drops/, { timeout: 15000 });

    currentStep = 'switch to artist login';
    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/partner\/login/, { timeout: 15000 });

    await loginArtist(page);

    const artistToken =
      (await page.evaluate(() => localStorage.getItem('auth_access_token'))) ?? '';
    expect(artistToken).toBeTruthy();

    currentStep = 'goto artist drops';
    await page.goto('/partner/artist/drops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/artist\/drops/, { timeout: 15000 });

    const artistRows = page.locator('table tbody tr').filter({ hasText: dropTitle });
    await expect(artistRows).toHaveCount(1, { timeout: 15000 });
    const artistRow = artistRows.first();
    await expect(artistRow).toBeVisible({ timeout: 15000 });
    await expect(artistRow.locator('td').nth(2)).toContainText(/published/i, { timeout: 15000 });

    const artistUnpublishButton = artistRow.getByRole('button', { name: /unpublish/i });
    await expect(artistUnpublishButton).toBeVisible({ timeout: 15000 });
    await artistUnpublishButton.click();

    await page.reload({ waitUntil: 'domcontentloaded' });
    const updatedRow = page.locator('table tbody tr').filter({ hasText: dropTitle }).first();
    await expect(updatedRow).toBeVisible({ timeout: 15000 });
    await expect(updatedRow.locator('td').nth(2)).toContainText(/draft/i, { timeout: 15000 });
    const artistPublishButton = updatedRow.getByRole('button', { name: /^publish$/i }).first();
    await expect(artistPublishButton).toBeVisible({ timeout: 15000 });
    await artistPublishButton.click();
    await expect(updatedRow.locator('td').nth(2)).toContainText(/published/i, { timeout: 15000 });

    const scopedResponse = await page.request.get('/api/artist/drops', {
      headers: { Authorization: `Bearer ${artistToken}` },
    });
    expect(scopedResponse.ok()).toBeTruthy();
    const scopedBody = await scopedResponse.json();
    const scopedItems = Array.isArray(scopedBody?.items)
      ? scopedBody.items
      : Array.isArray(scopedBody)
      ? scopedBody
      : [];
    const artistIds = Array.from(
      new Set(
        scopedItems
          .map((item: any) => item?.artist_id ?? item?.artistId)
          .filter((value: any) => typeof value === 'string' && value.length > 0)
      )
    );
    expect(artistIds.length).toBe(1);
    expect(artistIds[0]).toBe(SEEDED_ARTIST_ID);

    await page.getByRole('button', { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/partner\/login/, { timeout: 15000 });

    await loginAdmin(page);
    await page.goto('/partner/admin/drops', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/partner\/admin\/drops/, { timeout: 15000 });
    await expect(findAdminRow()).toBeVisible({ timeout: 15000 });
    currentStep = 'archive drop';
    await clickAdminAction(findAdminRow(), dropId, 'archive');
    await waitForAdminStatus(/archived/i);
    const uniqueLegacyCalls = Array.from(
      new Map(
        legacyCalls.map((call) => [`${call.step}__${call.method}__${call.url}`, call] as const)
      ).values()
    );
    const legacyCallsInAdmin = uniqueLegacyCalls.filter((call) => adminSteps.has(call.step));
    const groupedByStep = new Map<string, typeof uniqueLegacyCalls>();
    for (const call of uniqueLegacyCalls) {
      const existing = groupedByStep.get(call.step) ?? [];
      existing.push(call);
      groupedByStep.set(call.step, existing);
    }
    const legacyReport = Array.from(groupedByStep.entries())
      .map(([step, calls]) => {
        const lines = calls.map(
          (call) =>
            `method=${call.method} resourceType=${call.resourceType} pageUrl=${call.pageUrl} url=${call.url}`
        );
        return `${step}\n${lines.join('\n')}`;
      })
      .join('\n\n');
    const groupedAdminOnly = new Map<string, typeof legacyCallsInAdmin>();
    for (const call of legacyCallsInAdmin) {
      const existing = groupedAdminOnly.get(call.step) ?? [];
      existing.push(call);
      groupedAdminOnly.set(call.step, existing);
    }
    const legacyReportAdminOnly = Array.from(groupedAdminOnly.entries())
      .map(([step, calls]) => {
        const lines = calls.map(
          (call) =>
            `method=${call.method} resourceType=${call.resourceType} pageUrl=${call.pageUrl} url=${call.url}`
        );
        return `${step}\n${lines.join('\n')}`;
      })
      .join('\n\n');
    expect(
      legacyCallsInAdmin,
      `Legacy /api/drops calls detected (all steps):\n${legacyReport || '<none>'}\n\nLegacy /api/drops calls in admin steps:\n${legacyReportAdminOnly || '<none>'}`
    ).toHaveLength(0);
  });
});

test.describe('Label smoke', () => {
  test('label dashboard renders portfolio overview', async ({ page }) => {
    test.skip(!LABEL_EMAIL || !LABEL_PASSWORD, 'Missing label credentials');
    await loginLabel(page);
    await page.goto('/partner/label');
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

    await page.goto('/partner/label', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
    const redirectedUrl = new URL(page.url());
    if (redirectedUrl.pathname === '/fan/login') {
      expect(redirectedUrl.searchParams.get('returnUrl')).toBe('/partner/label');
    }
  });
});
