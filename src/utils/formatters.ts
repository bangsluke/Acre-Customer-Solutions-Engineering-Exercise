export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.round(value));
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactCurrency(value: number): string {
  const compact = new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
  return `£${compact.toLowerCase()}`;
}

export function formatPercentage(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPercentagePoints(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatDays(value: number): string {
  return `${Math.round(value)} days`;
}

export function formatSignedDaysDelta(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}d`;
}

export function formatSignedCurrencyDelta(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${formatCurrency(rounded)}`;
}

export function formatDirectionalDaysVsMarket(value: number): string {
  const rounded = Math.round(value);
  const absValue = Math.abs(rounded);
  if (rounded <= 0) {
    return `↓ -${absValue}d vs market avg`;
  }
  return `↑ +${absValue}d vs market avg`;
}

