import { test, expect } from '../helpers/session';
import { gotoApp, loginAdmin } from '../helpers/auth';

test.describe('Admin smoke', () => {
  test('admin artists page shows featured column and toggle', async ({ adminPage }) => {
    await gotoApp(adminPage, '/partner/admin/artists', { waitUntil: 'domcontentloaded' });
    await expect(adminPage).toHaveURL(/\/partner\/admin\/artists/);

    await expect(adminPage.getByTestId('admin-artist-featured-header')).toBeVisible({ timeout: 15000 });

    const featuredToggleByTestId = adminPage.locator('[data-testid^="admin-artist-featured-toggle-"]').first();
    const featuredToggle =
      (await featuredToggleByTestId.count()) > 0
        ? featuredToggleByTestId
        : adminPage.locator('table tbody input[type="checkbox"]').first();

    await expect(featuredToggle).toBeVisible({ timeout: 15000 });
    await expect(featuredToggle).toBeEnabled({ timeout: 15000 });
  });

  test('onboarding request flow supports required plan + admin approval payload fields', async ({ page }) => {
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

  test('onboarding request flow supports UI rejection with required comment', async ({ page }) => {
    const stamp = Date.now();
    const artistName = `Smoke Reject Artist ${stamp}`;
    const handle = `smoke-reject-${stamp}`;
    const handleWithAt = `@${handle}`;
    const email = `smoke.reject.${stamp}@example.invalid`;
    const phone = `8888${(stamp % 1000000).toString().padStart(6, '0')}`;

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
    await expect(page.getByText(/request submitted|submitted|request received|thank you/i)).toBeVisible({
      timeout: 20000,
    });

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

    await requestCard.getByRole('button', { name: /review application|review/i }).click();
    await expect(page.getByRole('heading', { name: /review application/i })).toBeVisible({ timeout: 20000 });

    const rejectAttemptWithoutComment = page
      .waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          /\/api\/admin\/artist-access-requests\/[^/]+\/reject/i.test(r.url()),
        { timeout: 1200 }
      )
      .then(() => true)
      .catch(() => false);

    await page.getByRole('button', { name: /reject application/i }).click();
    const rejectWithoutCommentResponse = await rejectAttemptWithoutComment;
    expect(rejectWithoutCommentResponse).toBe(false);
    await expect(page.getByText(/rejection comment is required/i)).toBeVisible({ timeout: 10000 });

    const rejectionReason = `Rejected by smoke ${Date.now()} due to missing launch assets.`;
    await page
      .getByPlaceholder(/if rejecting, please explain why/i)
      .fill(rejectionReason);

    const rejectRespPromise = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        /\/api\/admin\/artist-access-requests\/[^/]+\/reject/i.test(r.url()),
      { timeout: 30000 }
    );
    await page.getByRole('button', { name: /reject application/i }).click();
    const resp = await rejectRespPromise;
    if (!resp.ok()) {
      const body = await resp.text().catch(() => '<unavailable>');
      console.error('[reject] response body', body);
      throw new Error(`Reject failed: ${resp.status()} ${body}`);
    }

    await expect(page.getByText(/rejected successfully|application rejected|success/i)).toBeVisible({
      timeout: 20000,
    });
  });
});
