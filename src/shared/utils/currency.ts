export const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export const formatCurrencyFromCents = (value?: number | string | null) => {
  const cents =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(cents)) return '—';
  return currencyFormatter.format(cents / 100);
};
