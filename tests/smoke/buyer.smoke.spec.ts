import { test, expect, type Page } from '@playwright/test';
import { gotoApp } from '../helpers/navigation';

const DROP_CARD_SELECTOR =
  '[data-testid="drop-card"], a[href^="/drops/"], [data-testid="drop-list"] a';
const QUIZ_DROP_SCAN_LIMIT = 30;

type QuizDropScanResult = {
  cardCount: number;
  scannedCount: number;
  foundConfiguredQuiz: boolean;
};

const scanPublicDropsForConfiguredQuiz = async (page: Page): Promise<QuizDropScanResult> => {
  await gotoApp(page, '/drops', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => null);

  const cards = page.locator(DROP_CARD_SELECTOR);
  const cardCount = await cards.count();
  const scanLimit = Math.min(cardCount, QUIZ_DROP_SCAN_LIMIT);

  for (let i = 0; i < scanLimit; i += 1) {
    const card = cards.nth(i);
    const clicked = await card.click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (!clicked) continue;

    await page.waitForLoadState('domcontentloaded').catch(() => null);

    const quizCta = page
      .getByRole('button', { name: /quiz|take quiz|answer quiz|participate/i })
      .first();
    const quizHeading = page.getByText(/quiz/i).first();
    const hasQuizSignal =
      (await quizCta.isVisible().catch(() => false)) ||
      (await quizHeading.isVisible().catch(() => false));

    if (hasQuizSignal) {
      const hasConfiguredQuiz = await hasConfiguredQuizOnDropPage(page);
      if (hasConfiguredQuiz) {
        return { cardCount, scannedCount: i + 1, foundConfiguredQuiz: true };
      }
    }

    const navigatedBack = await page
      .goBack({ waitUntil: 'domcontentloaded' })
      .then(() => true)
      .catch(() => false);
    if (!navigatedBack) {
      await gotoApp(page, '/drops', { waitUntil: 'domcontentloaded' });
    }
    await page.waitForLoadState('networkidle').catch(() => null);
  }

  return { cardCount, scannedCount: scanLimit, foundConfiguredQuiz: false };
};

const hasConfiguredQuizOnDropPage = async (page: Page): Promise<boolean> => {
  const startQuizButton = page.getByRole('button', { name: /start quiz/i }).first();
  const startQuizLink = page.getByRole('link', { name: /start quiz/i }).first();
  const genericQuizHeading = page.getByRole('heading', { name: /quiz/i }).first();
  const specificQuizHeading = page
    .getByRole('heading', { name: /smoke drop quiz|drop quiz/i })
    .first();

  const hasAnyQuizSignal =
    (await startQuizButton.isVisible().catch(() => false)) ||
    (await startQuizLink.isVisible().catch(() => false)) ||
    (await genericQuizHeading.isVisible().catch(() => false)) ||
    (await page.getByText(/quiz/i).first().isVisible().catch(() => false));

  if (!hasAnyQuizSignal) return false;

  if (await startQuizButton.isVisible().catch(() => false)) {
    await startQuizButton.click();
  } else if (await startQuizLink.isVisible().catch(() => false)) {
    await startQuizLink.click();
  }

  const radioInputs = page.locator('input[type="radio"][name]');
  const textAnswers = page.getByPlaceholder(/your answer/i);
  const noQuestionsNotice = page.getByText(/no quiz questions configured/i).first();

  await expect
    .poll(
      async () => {
        const radioCount = await radioInputs.count();
        const textCount = await textAnswers.count();
        const noQuestionsVisible = await noQuestionsNotice.isVisible().catch(() => false);
        const hasSpecificHeading = await specificQuizHeading.isVisible().catch(() => false);
        return (
          radioCount > 0 ||
          textCount > 0 ||
          hasSpecificHeading ||
          (hasAnyQuizSignal && !noQuestionsVisible)
        );
      },
      { timeout: 2500, intervals: [250, 500, 750] }
    )
    .toBe(true)
    .catch(() => false);

  const hasQuestionInputs = (await radioInputs.count()) > 0 || (await textAnswers.count()) > 0;
  const hasSpecificHeading = await specificQuizHeading.isVisible().catch(() => false);
  const noQuestionsVisible = await noQuestionsNotice.isVisible().catch(() => false);

  if (hasQuestionInputs || hasSpecificHeading) return true;
  return hasAnyQuizSignal && !noQuestionsVisible;
};

const openFirstPublicDropWithQuiz = async (page: Page): Promise<void> => {
  const initialScan = await scanPublicDropsForConfiguredQuiz(page);
  if (initialScan.foundConfiguredQuiz) return;

  if (initialScan.cardCount === 0) {
    throw new Error(
      'No public drops are visible in the UI. ' +
        'Check drop publish state and featured query filters.'
    );
  }

  throw new Error(
    `/drops shows ${initialScan.cardCount} card(s), ` +
      `but no configured quiz was found in the first ${initialScan.scannedCount} card(s).`
  );
};

test.describe('Buyer smoke', () => {
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
    await expect(page.locator('footer').getByText(/OfficialMerch/i).first()).toBeVisible({
      timeout: 15000,
    });

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
      const productsSection = page
        .locator('section')
        .filter({ has: page.getByRole('heading', { name: /products/i }) })
        .first();
      const noProductsNotice = page
        .getByText(/no (products|merch).*(yet|available)|no catalog items yet/i)
        .first();

      await expect
        .poll(
          async () =>
            (await artistProductLinks.count()) > 0 ||
            (await productsSection.isVisible().catch(() => false)) ||
            (await noProductsNotice.isVisible().catch(() => false)),
          { timeout: 10000 }
        )
        .toBe(true);

      if ((await productsSection.count()) > 0) {
        const productTeaserLinks = productsSection.getByRole('link', { name: /view product/i });
        if ((await productTeaserLinks.count()) > 0) {
          await expect(productsSection).not.toContainText(/\u20b9|\$\s*\d+([.,]\d{2})?/i);
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

  test('public drop quiz lead submission works end-to-end', async ({ page }) => {
    await openFirstPublicDropWithQuiz(page);
    const uniqueLeadEmail = `smoke+${Date.now()}@test.com`;
    await expect(page).toHaveURL(/\/drops\/[^/?#]+(?:[/?#]|$)/, { timeout: 15000 });

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
      await quizTextAnswers.nth(i).fill('smoke');
    }

    const continueOrNextButton = page
      .getByRole('button', { name: /continue|next|finish/i })
      .first();
    if (await continueOrNextButton.isVisible().catch(() => false)) {
      await continueOrNextButton.click();
    }

    await expect
      .poll(
        async () =>
          (await page.getByLabel(/^name$/i).first().isVisible().catch(() => false)) ||
          (await page.getByRole('button', { name: /submit|finish/i }).first().isVisible().catch(() => false)),
        { timeout: 10000, intervals: [250, 500, 1000] }
      )
      .toBe(true);

    const nameInput = page.getByLabel(/^name$/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill('Smoke Fan');
    }
    const emailInput = page.getByLabel(/^email$/i).first();
    if (await emailInput.isVisible().catch(() => false)) {
      await emailInput.fill(uniqueLeadEmail);
    }
    const phoneInput = page.getByLabel(/^phone$/i).first();
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill('9999999999');
    }

    let submitButton = page.getByRole('button', { name: /^submit$/i }).first();
    if (!(await submitButton.isVisible().catch(() => false))) {
      submitButton = page.getByRole('button', { name: /finish|done/i }).first();
    }
    if (!(await submitButton.isVisible().catch(() => false))) {
      submitButton = page.getByRole('button', { name: /continue|next/i }).first();
    }
    await expect(submitButton).toBeVisible({ timeout: 10000 });

    const priorUrl = page.url();
    const submitLeadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/leads(?:[/?#]|$)/i.test(response.url()) &&
        [200, 201].includes(response.status()),
      { timeout: 10000 }
    );
    await submitButton.click();
    await submitLeadResponse;

    await expect
      .poll(
        async () =>
          (await page.getByText(/we will contact you if you win/i).first().isVisible().catch(() => false)) ||
          (await page.getByRole('status').first().isVisible().catch(() => false)) ||
          page.url() !== priorUrl ||
          (await page.locator('[data-testid*="success"], [data-testid*="confirmation"]').first().isVisible().catch(() => false)),
        { timeout: 10000, intervals: [250, 500, 1000] }
      )
      .toBe(true);
  });
});
