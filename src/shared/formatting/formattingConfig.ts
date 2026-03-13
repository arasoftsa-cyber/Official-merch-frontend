export type FormattingMetadata = {
  currency: string;
  locale: string;
  timeZone?: string | null;
};

export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_LOCALE = 'en-IN';
export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

const DEFAULT_FORMATTING_METADATA: FormattingMetadata = {
  currency: DEFAULT_CURRENCY,
  locale: DEFAULT_LOCALE,
  timeZone: DEFAULT_TIME_ZONE,
};

let currentFormattingMetadata: FormattingMetadata = DEFAULT_FORMATTING_METADATA;

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const pickFirstText = (sources: any[], keys: string[]): string => {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of keys) {
      const value = readText(source?.[key]);
      if (value) return value;
    }
  }
  return '';
};

const isValidLocale = (locale: string): boolean => {
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0;
  } catch {
    return false;
  }
};

const isValidCurrency = (currency: string): boolean => {
  try {
    new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency,
    });
    return true;
  } catch {
    return false;
  }
};

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone });
    return true;
  } catch {
    return false;
  }
};

export function normalizeFormattingMetadata(payload: any): FormattingMetadata {
  const sources = [
    payload,
    payload?.presentation,
    payload?.formatting,
    payload?.storefront,
    payload?.defaults,
    payload?.settings,
  ];

  const localeCandidate = pickFirstText(sources, ['locale', 'defaultLocale']);
  const currencyCandidate = pickFirstText(sources, ['currency', 'defaultCurrency']);
  const timeZoneCandidate = pickFirstText(sources, ['timeZone', 'timezone', 'defaultTimeZone', 'defaultTimezone']);
  const normalizedCurrencyCandidate = currencyCandidate.toUpperCase();

  return {
    locale: isValidLocale(localeCandidate) ? localeCandidate : DEFAULT_LOCALE,
    currency: isValidCurrency(normalizedCurrencyCandidate)
      ? normalizedCurrencyCandidate
      : DEFAULT_CURRENCY,
    timeZone: isValidTimeZone(timeZoneCandidate) ? timeZoneCandidate : DEFAULT_TIME_ZONE,
  };
}

export function getFormattingMetadata(): FormattingMetadata {
  return currentFormattingMetadata;
}

export function setFormattingMetadata(payload: any): FormattingMetadata {
  currentFormattingMetadata = normalizeFormattingMetadata(payload);
  return currentFormattingMetadata;
}
