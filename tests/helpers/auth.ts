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
  options?: Parameters<Page['goto']>[1]
) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  await page.goto(`${UI_BASE_URL}${normalizedPath}`, options ?? { waitUntil: 'domcontentloaded' });
};

const loginPartner = async (
  page: Page,
  emailValue: string,
  passwordValue: string,
  role: Exclude<LoginRole, 'buyer'>
) => {
  await resetAuth(page);
  await gotoApp(page, '/partner/login', { waitUntil: 'domcontentloaded' });
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

  await email.fill(emailValue);
  await password.fill(passwordValue);
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  assertNoPortalError(page);
  await expectLoggedIn(page, { role });
  assertNoPortalError(page);
};

export const expectLoggedIn = async (
  page: Page,
  options: { role: LoginRole }
) => {
  const { role } = options;
  const hasVisible = async (locator: Locator) => {
    if ((await locator.count().catch(() => 0)) === 0) return false;
    return locator.first().isVisible().catch(() => false);
  };

  const roleUrlOk = (pathname: string) => {
    switch (role) {
      case 'buyer':
        return pathname.includes('/fan') || pathname.includes('/buyer') || pathname.includes('/products');
      case 'admin':
        return pathname.includes('/admin');
      case 'artist':
        return pathname.includes('/artist');
      case 'label':
        return pathname.includes('/label');
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
  await expect(page).toHaveURL((url) => !url.pathname.includes('/login'), { timeout: 20000 });
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

export const loginBuyer = async (page: Page) => {
  await resetAuth(page);
  await gotoApp(page, '/login', { waitUntil: 'domcontentloaded' });

  const email = page.getByTestId('login-email');
  const password = page.getByTestId('login-password');
  const submit = page.getByTestId('login-submit');

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(BUYER_EMAIL);
  await password.fill(BUYER_PASSWORD);
  await submit.click();

  await page.waitForLoadState('domcontentloaded');
  await expectLoggedIn(page, { role: 'buyer' });
};

export const loginFanWithCredentials = async (
  page: Page,
  emailValue: string,
  passwordValue: string
) => {
  await resetAuth(page);
  await gotoApp(page, '/fan/login', { waitUntil: 'domcontentloaded' });

  const form = page.locator('form').first();
  const emailByTestId = form.getByTestId('login-email');
  const email =
    (await emailByTestId.count()) > 0
      ? emailByTestId
      : form.locator('input[type="email"][name="email"], input#fan-email').first();
  const passwordByTestId = form.getByTestId('login-password');
  const password =
    (await passwordByTestId.count()) > 0
      ? passwordByTestId
      : form.locator('input[type="password"][name="password"]').first();
  const submitByTestId = form.getByTestId('login-submit');
  const submit =
    (await submitByTestId.count()) > 0
      ? submitByTestId
      : form.getByRole('button', { name: /log ?in/i });

  await expect(email).toBeVisible({ timeout: 10000 });
  await expect(password).toBeVisible({ timeout: 10000 });

  await email.fill(emailValue);
  await password.fill(passwordValue);
  await submit.click();
  await page.waitForLoadState('domcontentloaded');
};

export const loginAdmin = async (page: Page) =>
  loginPartner(page, ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');

export const loginArtist = async (page: Page) =>
  loginPartner(page, ARTIST_EMAIL, ARTIST_PASSWORD, 'artist');

export const loginLabel = async (page: Page) =>
  loginPartner(page, LABEL_EMAIL, LABEL_PASSWORD, 'label');
