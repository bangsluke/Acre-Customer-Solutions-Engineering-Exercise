import type { CaseStatus, TimePeriod } from '../types/mortgage';

export const BRAND = {
  purple: '#6C5CE7',
  purpleLight: '#A29BFE',
  panel: '#F7F7F4',
  border: '#E7E7E3',
  text: '#22232A',
  muted: '#6B6D76',
  green: '#1D9E75',
  red: '#E24B4A',
} as const;

export const PIPELINE_ORDER: CaseStatus[] = [
  'LEAD',
  'PRE_RECOMMENDATION',
  'APPLICATION_SUBMITTED',
  'OFFER_RECEIVED',
  'COMPLETE',
];

export const ALL_STATUS_ORDER: CaseStatus[] = [...PIPELINE_ORDER, 'NOT_PROCEEDING'];

export const DEFAULT_PERIOD: TimePeriod = { type: 'this_year' };

export const TIME_FILTERS: Array<{ id: TimePeriod['type']; label: string }> = [
  { id: 'this_year', label: 'This year' },
  { id: 'this_half', label: 'This half' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_month', label: 'This month' },
  { id: 'custom', label: 'Select dates' },
];

export const CASE_TYPE_LABELS: Record<string, string> = {
  REASON_FTB: 'First-time buyer',
  REASON_REMORTGAGE: 'Remortgage',
  REASON_HOUSE_MOVE: 'House move',
  REASON_BTL: 'Buy-to-let',
  REASON_OTHER: 'Other',
  UNKNOWN: 'Other',
};

export const STATUS_LABELS: Record<CaseStatus, string> = {
  LEAD: 'Lead',
  PRE_RECOMMENDATION: 'Pre-recommendation',
  APPLICATION_SUBMITTED: 'Submitted',
  OFFER_RECEIVED: 'Offer received',
  COMPLETE: 'Complete',
  NOT_PROCEEDING: 'Not proceeding',
};

export const LTV_BANDS = [
  { max: 0.6, label: '0-60%' },
  { max: 0.75, label: '60-75%' },
  { max: 0.85, label: '75-85%' },
  { max: 0.9, label: '85-90%' },
  { max: 0.95, label: '90-95%' },
  { max: 1, label: '95-100%' },
];

export const MORTGAGE_AMOUNT_BANDS = [
  { min: 0, max: 100_000, label: '< £100k' },
  { min: 100_000, max: 200_000, label: '£100-200k' },
  { min: 200_000, max: 350_000, label: '£200-350k' },
  { min: 350_000, max: 500_000, label: '£350-500k' },
  { min: 500_000, max: 1_000_000, label: '£500k-1m' },
  { min: 1_000_000, max: Number.POSITIVE_INFINITY, label: '£1m+' },
];

export function getCsvUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return new URL('mortgage.csv', window.location.origin + base).toString();
}

