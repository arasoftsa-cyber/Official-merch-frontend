import { expect, type Page } from '@playwright/test';
import { getCredentialedAccount } from '../_env';
import { getAppUrl, gotoApp, normalizeAppPath } from './navigation';

const PARTNER_LOGIN_RESPONSE_RE = /\/api\/auth\/(?:partner\/)?login(?:[/?#]|$)/i;
const FAN_LOGIN_RESPONSE_RE = /\/api\/auth\/(?:fan\/)?login(?:[/?#]|$)/i;
const PARTNER_LOGIN_DEBUG_ENABLED = /^(1|true|yes)$/i.test(
  String(process.env.PW_DEBUG_PARTNER_LOGIN || process.env.OM_DEBUG_PARTNER_LOGIN || '')
);

type LoginRole = 'buyer' | 'admin' | 'artist' | 'label';
type AuthScope = 'fan' | 'partner';

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

const isPartnerLoginResponse = (response: any): boolean => {
  const method = String(response?.request?.().method?.() || '').toUpperCase();
  if (method !== 'POST') return false;
  const urlText = String(response?.url?.() || '');
  try {
    const parsed = new URL(urlText);
    return /^\/api\/auth\/(?:partner\/)?login(?:\/)?$/i.test(parsed.pathname);
  } catch {
    return PARTNER_LOGIN_RESPONSE_RE.test(urlText);
  }
};

const logPartnerLoginDebug = (event: string, payload: Record<string, unknown> = {}) => {
  if (!PARTNER_LOGIN_DEBUG_ENABLED) return;
  // eslint-disable-next-line no-console
  console.info(`[pw-partner-login] ${event}`, payload);
};

const assertNoPortalError = (page: Page) => {
  const url = page.url();
  if (url.includes('portalError=')) {
    throw new Error(`Portal error: ${url}`);
  }
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

const submitPartnerLoginForm = async (page: Page, email: string, password: string) => {
  const pageHeading = page.getByRole('heading', { name: /^partner login$/i });
  const emailField = page.getByLabel(/^email$/i);
  const passwordField = page.getByLabel(/^password$/i);
  const loginButton = page.getByRole('button', { name: /^login$/i });

  await expect(pageHeading).toBeVisible({ timeout: 10000 });
  await expect(emailField).toBeVisible({ timeout: 10000 });
  await expect(passwordField).toBeVisible({ timeout: 10000 });
  await expect(loginButton).toBeVisible({ timeout: 10000 });
  await emailField.fill(email);
  await passwordField.fill(password);
  await expect(loginButton).toBeEnabled({ timeout: 5000 });

  const loginButtonDisabled = await loginButton.isDisabled().catch(() => true);
  logPartnerLoginDebug('submit_prepare', {
    pageUrl: page.url(),
    matcher: PARTNER_LOGIN_RESPONSE_RE.toString(),
    submitDisabled: loginButtonDisabled,
  });

  const observedAuthResponses: Array<{ method: string; status: number; url: string }> = [];
  const onResponse = (response: any) => {
    const request = response.request();
    const method = String(request?.method?.() || '').toUpperCase();
    const url = String(response.url?.() || '');
    if (method !== 'POST' || !/\/api\/auth\//i.test(url)) return;
    observedAuthResponses.push({
      method,
      status: Number(response.status?.() || 0),
      url,
    });
    if (observedAuthResponses.length > 8) {
      observedAuthResponses.shift();
    }
  };

  page.on('response', onResponse);
  try {
    const loginResponsePromise = page.waitForResponse(
      (response) => isPartnerLoginResponse(response),
      { timeout: 20000 }
    );

    const [loginResponse] = await Promise.all([loginResponsePromise, loginButton.click()]);
    logPartnerLoginDebug('submit_response_matched', {
      status: loginResponse.status(),
      url: loginResponse.url(),
    });
    return loginResponse;
  } catch (err: any) {
    logPartnerLoginDebug('submit_response_timeout', {
      pageUrl: page.url(),
      observedAuthResponses,
      error: String(err?.message || err || 'unknown_error'),
    });
    throw err;
  } finally {
    page.off('response', onResponse);
  }
};

const submitFanLoginForm = async (page: Page, email: string, password: string) => {
  const pageHeading = page.getByRole('heading', { name: /^fan login$/i });
  const emailField = page.getByTestId('fan-login-email');
  const passwordField = page.getByTestId('fan-login-password');
  const submitButton = page.getByTestId('fan-login-submit');

  await expect(pageHeading).toBeVisible({ timeout: 10000 });
  await expect(emailField).toBeVisible({ timeout: 10000 });
  await expect(passwordField).toBeVisible({ timeout: 10000 });
  await expect(submitButton).toBeVisible({ timeout: 10000 });
  await emailField.fill(email);
  await passwordField.fill(password);

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      FAN_LOGIN_RESPONSE_RE.test(response.url()),
    { timeout: 15000 }
  );

  await submitButton.click();
  return loginResponsePromise;
};

export const resetBrowserSession = async (page: Page) => {
  await gotoApp(page, '/logout', { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page.waitForLoadState('domcontentloaded').catch(() => null);
  await gotoApp(page, '/', { waitUntil: 'domcontentloaded' }).catch(() => null);
  await page
    .evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // no-op for restricted storage contexts
      }
    })
    .catch(() => null);
  await page.context().clearCookies().catch(() => null);
  await page.goto('about:blank', { waitUntil: 'domcontentloaded' }).catch(() => null);
};

export const openPartnerLoginPage = async (page: Page, returnTo = '/partner/admin') => {
  const normalizedTarget = normalizeReturnTarget(returnTo, '/partner/admin');
  const openLogin = () =>
    gotoApp(page, `/partner/login?returnTo=${encodeURIComponent(normalizedTarget)}`, {
      waitUntil: 'domcontentloaded',
    });

  await openLogin();
  if (!/\/partner\/login(?:[/?#]|$)/i.test(page.url())) {
    await resetBrowserSession(page);
    await openLogin();
  }
  assertNoPortalError(page);
  return normalizedTarget;
};

export const openFanLoginPage = async (page: Page, returnTo = '/') => {
  const normalizedTarget = normalizeReturnTarget(returnTo, '/');
  const openLogin = () =>
    gotoApp(page, `/fan/login?returnTo=${encodeURIComponent(normalizedTarget)}`, {
      waitUntil: 'domcontentloaded',
    });

  await openLogin();
  if (!/\/fan\/login(?:[/?#]|$)/i.test(page.url())) {
    await resetBrowserSession(page);
    await openLogin();
  }
  return normalizedTarget;
};

export const expectLoggedIn = async (
  page: Page,
  options: { role: LoginRole; expectedScope?: AuthScope; expectedPath?: string }
) => {
  const { role } = options;
  const expectedScope: AuthScope =
    options.expectedScope || (role === 'buyer' ? 'fan' : 'partner');
  const expectedPath = options.expectedPath ? normalizeAppPath(options.expectedPath).toLowerCase() : null;

  const roleUrlOk = (pathname: string) => {
    if (expectedPath) {
      return pathname === expectedPath || pathname.startsWith(`${expectedPath}/`);
    }
    switch (role) {
      case 'buyer':
        return pathname.includes('/fan') || pathname.includes('/buyer') || pathname.includes('/products');
      case 'admin':
      case 'artist':
      case 'label':
        return pathname.includes('/partner');
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
        return roleUrlOk(path);
      },
      { timeout: 20000 }
    )
    .toBe(true);
};

export const loginPartner = async (page: Page, options: PartnerLoginOptions) => {
  const { email, password, returnTo, role = 'admin' } = options;
  const target = normalizeReturnTarget(returnTo, '/partner/admin');
  if (!email || !password) {
    throw new Error('Missing partner credentials');
  }

  await resetBrowserSession(page);
  await openPartnerLoginPage(page, target);

  const loginResponse = await submitPartnerLoginForm(page, email, password);
  if (!loginResponse.ok()) {
    const bodyText = await loginResponse.text().catch(() => '<unavailable>');
    throw new Error(`Partner login failed (${loginResponse.status()}): ${bodyText}`);
  }

  assertNoPortalError(page);
  await expectLoggedIn(page, {
    role,
    expectedScope: 'partner',
    expectedPath: target,
  });
  assertNoPortalError(page);
};

export const loginBuyer = async (page: Page, options: BuyerLoginOptions = {}) => {
  const buyerAccount =
    options.email && options.password ? null : getCredentialedAccount('buyer');
  const emailValue = options.email ?? buyerAccount?.email ?? '';
  const passwordValue = options.password ?? buyerAccount?.password ?? '';
  const target = normalizeReturnTarget(options.returnTo, '/products');
  if (!emailValue || !passwordValue) {
    throw new Error('Missing buyer credentials');
  }

  await resetBrowserSession(page);
  await openFanLoginPage(page, target);

  const loginResponse = await submitFanLoginForm(page, emailValue, passwordValue);
  if (!loginResponse.ok()) {
    const bodyText = await loginResponse.text().catch(() => '<unavailable>');
    throw new Error(`Fan login failed (${loginResponse.status()}): ${bodyText}`);
  }

  await expectLoggedIn(page, {
    role: 'buyer',
    expectedScope: 'fan',
    expectedPath: target,
  });
};

export const loginFanWithCredentials = async (
  page: Page,
  emailValue: string,
  passwordValue: string,
  opts: LoginFanOpts = {}
) => {
  const { expectRejection = false } = opts;

  await resetBrowserSession(page);
  await openFanLoginPage(page, '/');

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
    ...getCredentialedAccount('admin'),
    returnTo: options.returnTo ?? '/partner/admin',
    role: 'admin',
  });

export const loginArtist = async (page: Page, options: { returnTo?: string } = {}) =>
  loginPartner(page, {
    ...getCredentialedAccount('artist'),
    returnTo: options.returnTo ?? '/partner/artist',
    role: 'artist',
  });

export const loginLabel = async (page: Page, options: { returnTo?: string } = {}) =>
  loginPartner(page, {
    ...getCredentialedAccount('label'),
    returnTo: options.returnTo ?? '/partner/label',
    role: 'label',
  });

export { getAppUrl };
