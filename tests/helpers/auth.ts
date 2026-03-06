import { expect, Locator, Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ARTIST_EMAIL,
  ARTIST_PASSWORD,
  BUYER_EMAIL,
  BUYER_PASSWORD,
  LABEL_EMAIL,
  LABEL_PASSWORD,
  UI_BASE_URL,
} from '../_env';

const assertNoPortalError = (page: Page) => {
  const url = page.url();
  if (url.includes('portalError=')) {
    throw new Error(`Portal error: ${url}`);
  }
};

type LoginRole = 'buyer' | 'admin' | 'artist' | 'label';
type AuthScope = 'fan' | 'partner';

type GotoAppOptions = Parameters<Page['goto']>[1] & {
  authRetry?: boolean;
  _authRetryCount?: number;
};

type PartnerLoginOptions = {
  email: string;
  password: string;
  returnTo?: string;
  role?: Exclude<LoginRole, 'buyer'>;
};

type BuyerLoginOptions = {
  email?: string;
  password?: string;
  returnTo?: string;
};

type LoginFanOpts = {
  expectRejection?: boolean;
};

const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizeReturnTarget = (value: string | null | undefined, fallback: string) => {
  const decoded = safeDecode(String(value || '').trim());
  if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  return fallback;
};

const getReturnTargetFromLoginUrl = (urlValue: string, fallback: string) => {
  try {
    const url = new URL(urlValue);
    return normalizeReturnTarget(
      url.searchParams.get('returnTo') || url.searchParams.get('returnUrl'),
      fallback
    );
  } catch {
    return fallback;
  }
};

const navigateWithinApp = async (page: Page, targetPath: string): Promise<boolean> => {
  try {
    const currentUrl = new URL(page.url());
    const appOrigin = new URL(UI_BASE_URL).origin;
    if (currentUrl.origin !== appOrigin) return false;
    await page.evaluate((target) => {
      if (window.location.pathname + window.location.search + window.location.hash === target) {
        return;
      }
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, targetPath);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  } catch {
    return false;
  }
};

const firstVisible = async (candidates: Locator[], timeout = 10000): Promise<Locator> => {
  for (const candidate of candidates) {
    const locator = candidate.first();
    if ((await locator.count().catch(() => 0)) === 0) continue;
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  const fallback = candidates[0].first();
  await expect(fallback).toBeVisible({ timeout });
  return fallback;
};

const submitPartnerLoginForm = async (page: Page, email: string, password: string) => {
  const emailField = await firstVisible([
    page.getByLabel(/email/i),
    page.getByPlaceholder(/email/i),
    page.getByTestId(/email/i),
    page.locator('input[type="email"][name="email"], input#partner-email'),
  ]);
  const passwordField = await firstVisible([
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.getByTestId(/password/i),
    page.locator('input[type="password"][name="password"], input#partner-password'),
  ]);
  const loginButton = page.getByRole('button', { name: /^login$/i });

  await expect(loginButton).toBeVisible({ timeout: 10000 });
  await emailField.fill(email);
  await passwordField.fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/partner\/login(?:[/?#]|$)/i.test(response.url()),
    { timeout: 15000 }
  );
  await loginButton.click();
  return loginResponsePromise;
};

const submitFanLoginForm = async (page: Page, email: string, password: string) => {
  if (await page.getByRole('button', { name: /logout/i }).isVisible().catch(() => false)) return null;
  if (await page.getByRole('button', { name: /my account/i }).isVisible().catch(() => false)) return null;

  await page.goto(`${UI_BASE_URL}/fan/login?returnTo=%2F`, { waitUntil: 'domcontentloaded' });

  const emailField = await firstVisible([
    page.getByLabel(/email/i),
    page.getByPlaceholder(/email/i),
    page.getByTestId(/email/i),
    page.locator('input[type="email"][name="email"], input#fan-email'),
  ]);
  const passwordField = await firstVisible([
    page.getByLabel(/password/i),
    page.getByPlaceholder(/password/i),
    page.getByTestId(/password/i),
    page.locator('input[type="password"][name="password"], input#fan-password'),
  ]);
  const signInButton = page.getByRole('button', { name: /^sign in$/i });
  const loginButton = page.getByRole('button', { name: /^login$/i });

  const submitButton = (await signInButton.isVisible().catch(() => false)) ? signInButton : loginButton;
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await emailField.fill(email);
  await passwordField.fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/auth\/(?:fan\/)?login(?:[/?#]|$)/i.test(response.url()),
    { timeout: 15000 }
  );
  await submitButton.click();
  return loginResponsePromise;
};

const resetAuth = async (page: Page) => {
  await page.context().clearCookies();
  await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // no-op for restricted storage contexts
    }
  });
};

export const gotoApp = async (
  page: Page,
  path = '/',
  options: GotoAppOptions = {}
) => {
  const { authRetry = true, _authRetryCount = 0, ...gotoOptions } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const usedSoftNavigation = await navigateWithinApp(page, normalizedPath);

  if (!usedSoftNavigation) {
    await page.goto(`${UI_BASE_URL}${normalizedPath}`, {
      waitUntil: 'domcontentloaded',
      ...gotoOptions,
    });
  }

  if (!authRetry || _authRetryCount >= 1) return;

  const shouldWatchForRedirect =
    normalizedPath.startsWith('/partner') || normalizedPath.startsWith('/fan');
  if (shouldWatchForRedirect) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const currentPath = new URL(page.url()).pathname.toLowerCase();
      if (currentPath.startsWith('/partner/login') || currentPath.startsWith('/fan/login')) {
        break;
      }
      await page.waitForTimeout(100);
    }
  }

  const currentUrl = new URL(page.url());
  const pathname = currentUrl.pathname.toLowerCase();
  if (pathname.startsWith('/partner/login')) {
    const returnTo = getReturnTargetFromLoginUrl(page.url(), normalizedPath);
    await loginAdmin(page, { returnTo });
    const afterLoginPath = new URL(page.url()).pathname.toLowerCase();
    const expectedPath = normalizeReturnTarget(returnTo, normalizedPath).toLowerCase();
    if (afterLoginPath !== expectedPath) {
      await gotoApp(page, normalizedPath, {
        ...gotoOptions,
        authRetry,
        _authRetryCount: _authRetryCount + 1,
      });
    }
    return;
  }

  if (pathname.startsWith('/fan/login')) {
    const returnTo = getReturnTargetFromLoginUrl(page.url(), normalizedPath);
    await loginBuyer(page, { returnTo });
    const afterLoginPath = new URL(page.url()).pathname.toLowerCase();
    const expectedPath = normalizeReturnTarget(returnTo, normalizedPath).toLowerCase();
    if (afterLoginPath !== expectedPath) {
      await gotoApp(page, normalizedPath, {
        ...gotoOptions,
        authRetry,
        _authRetryCount: _authRetryCount + 1,
      });
    }
  }
};

export const loginPartner = async (page: Page, options: PartnerLoginOptions) => {
  const { email, password, returnTo, role = 'admin' } = options;
  const target = returnTo ?? '/partner/admin';
  if (!email || !password) {
    throw new Error('Missing partner credentials');
  }

  await resetAuth(page);
  await page.goto(`${UI_BASE_URL}/partner/login?returnTo=${encodeURIComponent(target)}`, {
    waitUntil: 'domcontentloaded',
  });
  assertNoPortalError(page);

  const loginResponse = await submitPartnerLoginForm(page, email, password);
  if (!loginResponse.ok()) {
    const bodyText = await loginResponse.text().catch(() => '<unavailable>');
    throw new Error(`Partner login failed (${loginResponse.status()}): ${bodyText}`);
  }

  await expect(page).toHaveURL(
    (url) => !url.pathname.includes('/partner/login'),
    { timeout: 15000 }
  );
  const navigated = await navigateWithinApp(page, target);
  if (!navigated) {
    await page.goto(`${UI_BASE_URL}${target}`, { waitUntil: 'domcontentloaded' });
  }
  assertNoPortalError(page);
  await expectLoggedIn(page, { role, expectedScope: 'partner' });
  assertNoPortalError(page);
};

export const expectLoggedIn = async (
  page: Page,
  options: { role: LoginRole; expectedScope?: AuthScope }
) => {
  const { role } = options;
  const expectedScope: AuthScope =
    options.expectedScope || (role === 'buyer' ? 'fan' : 'partner');
  const hasVisible = async (locator: Locator) => {
    if ((await locator.count().catch(() => 0)) === 0) return false;
    return locator.first().isVisible().catch(() => false);
  };

  const roleUrlOk = (pathname: string) => {
    switch (role) {
      case 'buyer':
        return pathname.includes('/fan') || pathname.includes('/buyer') || pathname.includes('/products');
      case 'admin':
        return pathname.includes('/partner');
      case 'artist':
        return pathname.includes('/partner');
      case 'label':
        return pathname.includes('/partner');
      default:
        return false;
    }
  };

  const roleUiOk = async () => {
    switch (role) {
      case 'buyer':
        return (
          (await hasVisible(page.getByRole('link', { name: /logout/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /logout/i }))) ||
          (await hasVisible(page.getByRole('link', { name: /products/i }))) ||
          (await hasVisible(page.getByRole('link', { name: /cart/i })))
        );
      case 'admin':
        return (
          (await hasVisible(page.getByRole('link', { name: /admin/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /admin/i })))
        );
      case 'artist':
        return (
          (await hasVisible(page.getByRole('link', { name: /products/i }))) ||
          (await hasVisible(page.getByRole('link', { name: /drops/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /products/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /drops/i })))
        );
      case 'label':
        return (
          (await hasVisible(page.getByRole('link', { name: /portfolio/i }))) ||
          (await hasVisible(page.getByRole('link', { name: /sales/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /portfolio/i }))) ||
          (await hasVisible(page.getByRole('button', { name: /sales/i })))
        );
      default:
        return false;
    }
  };

  await page.waitForLoadState('domcontentloaded');
  if (expectedScope === 'partner') {
    await expect(page).toHaveURL(
      (url) =>
        !url.pathname.includes('/partner/login') && !url.pathname.includes('/fan/login'),
      { timeout: 20000 }
    );
  } else {
    await expect(page).toHaveURL((url) => !url.pathname.includes('/fan/login'), {
      timeout: 20000,
    });
  }
  await expect
    .poll(
      async () => {
        const path = new URL(page.url()).pathname.toLowerCase();
        if (roleUrlOk(path)) return 'url';
        if (await roleUiOk()) return 'ui';
        return '';
      },
      { timeout: 20000 }
    )
    .not.toBe('');
};

export const loginBuyer = async (page: Page, options: BuyerLoginOptions = {}) => {
  const emailValue = options.email ?? BUYER_EMAIL;
  const passwordValue = options.password ?? BUYER_PASSWORD;
  const target = options.returnTo ?? '/products';
  if (!emailValue || !passwordValue) {
    throw new Error('Missing buyer credentials');
  }

  await resetAuth(page);
  await page.goto(`${UI_BASE_URL}/fan/login?returnTo=${encodeURIComponent(target)}`, {
    waitUntil: 'domcontentloaded',
  });

  const loginResponse = await submitFanLoginForm(page, emailValue, passwordValue);
  if (loginResponse && !loginResponse.ok()) {
    const bodyText = await loginResponse.text().catch(() => '<unavailable>');
    throw new Error(`Fan login failed (${loginResponse.status()}): ${bodyText}`);
  }

  await expect(page).toHaveURL((url) => !url.pathname.includes('/fan/login'), {
    timeout: 15000,
  });
  const navigated = await navigateWithinApp(page, target);
  if (!navigated) {
    await page.goto(`${UI_BASE_URL}${target}`, { waitUntil: 'domcontentloaded' });
  }
  await expectLoggedIn(page, { role: 'buyer', expectedScope: 'fan' });
};

export const loginFanWithCredentials = async (
  page: Page,
  emailValue: string,
  passwordValue: string,
  opts: LoginFanOpts = {}
) => {
  const { expectRejection = false } = opts;

  await resetAuth(page);
  await page.goto(`${UI_BASE_URL}/fan/login`, { waitUntil: 'domcontentloaded' });

  const form = page.locator('form').first();
  const email = form.getByLabel(/email/i);
  const password = form.getByLabel(/password/i);
  const submit = form.getByRole('button', { name: /^(sign\s*in|log\s*in)$/i });

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(emailValue);
  await password.fill(passwordValue);
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => null),
    submit.click(),
  ]);

  if (expectRejection) {
    const url = page.url();
    const partnerBanner = page.getByText(/this account is for the partner portal/i).first();
    const goPartnerLink = page
      .getByRole('link', { name: /partner login|go to partner login/i })
      .first();
    const goPartnerButton = page
      .getByRole('button', { name: /partner login|go to partner login/i })
      .first();

    if (/\/partner\/login/i.test(url)) {
      await expect(
        page.getByRole('heading', { name: /partner/i })
      ).toBeVisible({ timeout: 15000 }).catch(() => null);
      return;
    }

    await expect(page).toHaveURL(/\/fan\/login/i, { timeout: 15000 });

    const bannerCount = await partnerBanner.count().catch(() => 0);
    const linkCount = await goPartnerLink.count().catch(() => 0);
    const buttonCount = await goPartnerButton.count().catch(() => 0);

    if (bannerCount > 0) {
      await expect(partnerBanner).toBeVisible({ timeout: 15000 });
    } else if (linkCount > 0) {
      await expect(goPartnerLink).toBeVisible({ timeout: 15000 });
    } else if (buttonCount > 0) {
      await expect(goPartnerButton).toBeVisible({ timeout: 15000 });
    } else {
      await expect(
        page.getByText(/role_not_allowed|not allowed|unauthorized|forbidden/i).first()
      ).toBeVisible({
        timeout: 15000,
      });
    }

    await expect(page)
      .not.toHaveURL(/\/fan\/(orders|addresses|dashboard)/i, { timeout: 2000 })
      .catch(() => null);
    return;
  }

  await expect(page).not.toHaveURL(/\/fan\/login/i, { timeout: 20000 });
};

export const loginAdmin = async (page: Page, options: { returnTo?: string } = {}) =>
  loginPartner(page, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    returnTo: options.returnTo ?? '/partner/admin',
    role: 'admin',
  });

export const loginArtist = async (page: Page, options: { returnTo?: string } = {}) =>
  loginPartner(page, {
    email: ARTIST_EMAIL,
    password: ARTIST_PASSWORD,
    returnTo: options.returnTo ?? '/partner/artist',
    role: 'artist',
  });

export const loginLabel = async (page: Page, options: { returnTo?: string } = {}) =>
  loginPartner(page, {
    email: LABEL_EMAIL,
    password: LABEL_PASSWORD,
    returnTo: options.returnTo ?? '/partner/label',
    role: 'label',
  });
