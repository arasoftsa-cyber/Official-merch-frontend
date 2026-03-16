import type { Page } from '@playwright/test';
import { getBrowserAppEnv } from '../_env';

export type AppGotoOptions = Parameters<Page['goto']>[1];

export const getUiBaseUrl = () => getBrowserAppEnv().UI_BASE_URL;

export const normalizeAppPath = (path = '/') => (path.startsWith('/') ? path : `/${path}`);

export const getAppUrl = (path = '/') => `${getUiBaseUrl()}${normalizeAppPath(path)}`;

export const gotoApp = async (
  page: Page,
  path = '/',
  options: AppGotoOptions = {}
) =>
  page.goto(getAppUrl(path), {
    waitUntil: 'domcontentloaded',
    ...options,
  });

export const softNavigateWithinApp = async (page: Page, targetPath: string): Promise<boolean> => {
  try {
    const currentUrl = new URL(page.url());
    const appOrigin = new URL(getUiBaseUrl()).origin;
    if (currentUrl.origin !== appOrigin) return false;
    const normalizedTarget = normalizeAppPath(targetPath);
    await page.evaluate((target) => {
      if (window.location.pathname + window.location.search + window.location.hash === target) {
        return;
      }
      window.history.pushState({}, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, normalizedTarget);
    await page.waitForLoadState('domcontentloaded').catch(() => null);
    return true;
  } catch {
    return false;
  }
};
