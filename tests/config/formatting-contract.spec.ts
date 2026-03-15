import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  getFormattingMetadata,
  normalizeFormattingMetadata,
  setFormattingMetadata,
} from '../../src/shared/formatting/formattingConfig';
import {
  formatCurrencyFromAmount,
  formatCurrencyFromCents,
  formatDate,
  formatDateTime,
} from '../../src/shared/utils/formatting';
import { resolveFrontendPathFromTest } from '../helpers/repoPaths';

const buildCurrencyExpectation = (locale: string, currency: string, amount: number) =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const buildDateExpectation = (
  locale: string,
  timeZone: string,
  value: string,
  options: Intl.DateTimeFormatOptions
) =>
  new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone,
  }).format(new Date(value));

test.describe('formatting contract', () => {
  test.beforeEach(() => {
    setFormattingMetadata({});
  });

  test('fallback metadata is deterministic when config is absent or invalid', () => {
    const metadata = normalizeFormattingMetadata({
      currency: 'not-a-currency',
      locale: 'not-a-locale',
      timezone: 'not-a-time-zone',
    });

    expect(metadata).toEqual({
      currency: DEFAULT_CURRENCY,
      locale: DEFAULT_LOCALE,
      timeZone: DEFAULT_TIME_ZONE,
    });

    expect(formatCurrencyFromAmount(1234.5)).toBe(
      buildCurrencyExpectation(DEFAULT_LOCALE, DEFAULT_CURRENCY, 1234.5)
    );
    expect(
      formatDateTime('2026-03-12T10:30:00.000Z', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    ).toBe(
      buildDateExpectation(DEFAULT_LOCALE, DEFAULT_TIME_ZONE, '2026-03-12T10:30:00.000Z', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
  });

  test('explicit currency and locale formatting works without mutating shared metadata', () => {
    setFormattingMetadata({
      currency: 'USD',
      locale: 'en-US',
      timezone: 'America/New_York',
    });

    expect(
      formatCurrencyFromAmount(1234.5, {
        currency: 'EUR',
        locale: 'de-DE',
      })
    ).toBe(buildCurrencyExpectation('de-DE', 'EUR', 1234.5));

    expect(
      formatDate('2026-03-12T10:30:00.000Z', {
        locale: 'en-GB',
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    ).toBe(
      buildDateExpectation('en-GB', 'UTC', '2026-03-12T10:30:00.000Z', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    );

    expect(getFormattingMetadata()).toEqual({
      currency: 'USD',
      locale: 'en-US',
      timeZone: 'America/New_York',
    });
  });

  test('changing metadata changes formatted output without caller changes', () => {
    setFormattingMetadata({
      formatting: {
        currency: 'USD',
        locale: 'en-US',
        timeZone: 'America/New_York',
      },
    });
    const usdCurrency = formatCurrencyFromCents(123456);
    const usDate = formatDateTime('2026-03-12T10:30:00.000Z', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    setFormattingMetadata({
      defaults: {
        defaultCurrency: 'EUR',
        defaultLocale: 'de-DE',
        defaultTimezone: 'Europe/Berlin',
      },
    });
    const eurCurrency = formatCurrencyFromCents(123456);
    const deDate = formatDateTime('2026-03-12T10:30:00.000Z', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    expect(usdCurrency).toBe(buildCurrencyExpectation('en-US', 'USD', 1234.56));
    expect(eurCurrency).toBe(buildCurrencyExpectation('de-DE', 'EUR', 1234.56));
    expect(usdCurrency).not.toBe(eurCurrency);

    expect(usDate).toBe(
      buildDateExpectation('en-US', 'America/New_York', '2026-03-12T10:30:00.000Z', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
    expect(deDate).toBe(
      buildDateExpectation('de-DE', 'Europe/Berlin', '2026-03-12T10:30:00.000Z', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    );
    expect(usDate).not.toBe(deDate);
  });

  test('AdminLeadsPage stays on the shared formatter path', () => {
    const pagePath = resolveFrontendPathFromTest(
      test.info().file,
      'src',
      'features',
      'admin',
      'pages',
      'AdminLeadsPage.tsx'
    );
    const source = readFileSync(pagePath, 'utf8');

    expect(source.includes("shared/utils/formatting")).toBe(true);
    expect(source.includes('formatDateTimeValue')).toBe(true);
    expect(source.includes('toLocaleString(')).toBe(false);
    expect(source.includes('Intl.NumberFormat')).toBe(false);
    expect(source.includes("'en-IN'")).toBe(false);
    expect(source.includes("'INR'")).toBe(false);
  });
});
