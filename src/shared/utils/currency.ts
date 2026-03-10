export const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatCurrencyFromCents = (value?: number | string | null) => {
  const cents =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(cents)) return '-';
  return currencyFormatter.format(cents / 100);
};

export const formatCurrencyFromAmount = (value?: number | string | null) => {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isFinite(amount)) return '-';
  return currencyFormatter.format(amount);
};
