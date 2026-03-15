import { getFormattingMetadata } from '../formatting/formattingConfig';

type CurrencyFormatOptions = {
  currency?: string | null;
  locale?: string | null;
};

type NumberFormatOptions = {
  locale?: string | null;
} & Intl.NumberFormatOptions;

type DateFormatOptions = Omit<Intl.DateTimeFormatOptions, 'timeZone'> & {
  locale?: string | null;
  timeZone?: string | null;
};

const numberFormatterCache = new Map<string, Intl.NumberFormat>();
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const parseNumericValue = (value?: number | string | null): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
};

const buildNumberFormatter = (
  locale: string,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat => {
  const cacheKey = JSON.stringify([locale, options]);
  const cached = numberFormatterCache.get(cacheKey);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat(locale, options);
  numberFormatterCache.set(cacheKey, formatter);
  return formatter;
};

const buildDateFormatter = (
  locale: string,
  options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
  const cacheKey = JSON.stringify([locale, options]);
  const cached = dateFormatterCache.get(cacheKey);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat(locale, options);
  dateFormatterCache.set(cacheKey, formatter);
  return formatter;
};

const resolveNumberLocale = (locale?: string | null) =>
  readText(locale) || getFormattingMetadata().locale;

const resolveCurrencyConfig = (options?: CurrencyFormatOptions) => {
  const metadata = getFormattingMetadata();
  return {
    locale: readText(options?.locale) || metadata.locale,
    currency: readText(options?.currency)?.toUpperCase() || metadata.currency,
  };
};

const resolveDateConfig = (options?: DateFormatOptions) => {
  const metadata = getFormattingMetadata();
  const locale = readText(options?.locale) || metadata.locale;
  const timeZone = readText(options?.timeZone) || metadata.timeZone || undefined;
  const resolvedOptions: Intl.DateTimeFormatOptions = { ...options };
  delete (resolvedOptions as any).locale;
  delete (resolvedOptions as any).timeZone;
  if (timeZone && !resolvedOptions.timeZone) {
    resolvedOptions.timeZone = timeZone;
  }
  return {
    locale,
    options: resolvedOptions,
  };
};

export function formatNumber(
  value?: number | string | null,
  options: NumberFormatOptions = {}
): string {
  const numericValue = parseNumericValue(value);
  if (!Number.isFinite(numericValue)) return '-';
  const locale = resolveNumberLocale(options.locale);
  const resolvedOptions = { ...options };
  delete (resolvedOptions as any).locale;
  return buildNumberFormatter(locale, resolvedOptions).format(numericValue);
}

export function formatCurrencyFromCents(
  value?: number | string | null,
  options?: CurrencyFormatOptions
): string {
  const cents = parseNumericValue(value);
  if (!Number.isFinite(cents)) return '-';
  return formatCurrencyFromAmount(cents / 100, options);
}

export function formatCurrencyFromAmount(
  value?: number | string | null,
  options?: CurrencyFormatOptions
): string {
  const amount = parseNumericValue(value);
  if (!Number.isFinite(amount)) return '-';
  const { locale, currency } = resolveCurrencyConfig(options);
  return buildNumberFormatter(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(
  value?: string | number | Date | null,
  options: DateFormatOptions = {}
): string {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  const { locale, options: resolvedOptions } = resolveDateConfig(options);
  return buildDateFormatter(locale, resolvedOptions).format(parsed);
}

export function formatDate(
  value?: string | number | Date | null,
  options: DateFormatOptions = {}
): string {
  return formatDateTime(value, options);
}
