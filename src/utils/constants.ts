import type { PipelineStage, RawCaseStatus, TimePeriod } from '../types/mortgage';

export const BRAND = {
  purple: '#3D4CF9',
  purpleLight: '#5B68FA',
  panel: '#F7F7F4',
  border: '#E7E7E3',
  text: '#22232A',
  muted: '#6B6D76',
  green: '#1D9E75',
  red: '#E24B4A',
} as const;

export const PIPELINE_ORDER: Array<Exclude<PipelineStage, 'NOT_PROCEEDING'>> = [
  'LEAD',
  'RECOMMENDATION',
  'APPLICATION',
  'OFFER',
  'COMPLETION',
];

export const ALL_STATUS_ORDER: PipelineStage[] = [...PIPELINE_ORDER, 'NOT_PROCEEDING'];

export const RAW_CASE_STATUSES: RawCaseStatus[] = [
  'LEAD',
  'PRE_RECOMMENDATION',
  'POST_RECOMMENDATION_REVIEW',
  'PRE_APPLICATION',
  'REVIEW',
  'APPLICATION_SUBMITTED',
  'REFERRED',
  'AWAITING_VALUATION',
  'AWAITING_OFFER',
  'OFFER_RECEIVED',
  'EXCHANGE',
  'COMPLETE',
  'IMPORTING',
  'IMPORTED_COMPLETE',
  'NOT_PROCEEDING',
];

export const SYSTEM_CASE_STATUSES: RawCaseStatus[] = ['IMPORTING', 'IMPORTED_COMPLETE'];

export const PIPELINE_STAGE_BY_STATUS: Record<RawCaseStatus, PipelineStage | null> = {
  LEAD: 'LEAD',
  PRE_RECOMMENDATION: 'RECOMMENDATION',
  POST_RECOMMENDATION_REVIEW: 'RECOMMENDATION',
  PRE_APPLICATION: 'APPLICATION',
  REVIEW: 'APPLICATION',
  APPLICATION_SUBMITTED: 'APPLICATION',
  REFERRED: 'APPLICATION',
  AWAITING_VALUATION: 'OFFER',
  AWAITING_OFFER: 'OFFER',
  OFFER_RECEIVED: 'OFFER',
  EXCHANGE: 'COMPLETION',
  COMPLETE: 'COMPLETION',
  IMPORTING: null,
  IMPORTED_COMPLETE: null,
  NOT_PROCEEDING: 'NOT_PROCEEDING',
};

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
  REASON_BTL_REMORTGAGE: 'Buy-to-let Remortgage',
  REASON_EQUITY_RELEASE: 'Equity Release',
  REASON_BRIDGING: 'Bridging',
  REASON_INVALID_MORTGAGE_REASON: 'Invalid Mortgage Reason',
  REASON_COMMERCIAL: 'Commercial',
  REASON_OTHER: 'Other',
  UNKNOWN: 'Other',
};

export const OTHER_GROUPED_CASE_TYPES = [
  'REASON_BTL_REMORTGAGE',
  'REASON_EQUITY_RELEASE',
  'REASON_BRIDGING',
  'REASON_INVALID_MORTGAGE_REASON',
  'REASON_COMMERCIAL',
] as const;

export const OTHER_GROUPED_CASE_TYPE_LABELS = OTHER_GROUPED_CASE_TYPES.map((caseType) => CASE_TYPE_LABELS[caseType]);

export const OTHER_CASE_TYPE_TOOLTIP =
  'Includes Buy-to-let Remortgage, Equity Release, Bridging, Invalid Mortgage Reason, and Commercial.';

export const CASE_TYPE_LABEL_ORDER = [
  'First-time buyer',
  'House move',
  'Remortgage',
  'Buy-to-let',
  'Buy-to-let Remortgage',
  'Equity Release',
  'Bridging',
  'Invalid Mortgage Reason',
  'Commercial',
  'Other',
] as const;

const CASE_TYPE_LABEL_ORDER_MAP: Map<string, number> = new Map(
  CASE_TYPE_LABEL_ORDER.map((label, index) => [label, index]),
);
const OTHER_GROUPED_CASE_TYPE_SET = new Set<string>(OTHER_GROUPED_CASE_TYPES);

export function toCaseTypeLabel(caseType: string, groupOther = true): string {
  if (groupOther && OTHER_GROUPED_CASE_TYPE_SET.has(caseType)) {
    return 'Other';
  }
  return CASE_TYPE_LABELS[caseType] ?? CASE_TYPE_LABELS.UNKNOWN;
}

export function sortCaseTypeLabels(labels: string[]): string[] {
  return labels.slice().sort((a, b) => {
    const rankA = CASE_TYPE_LABEL_ORDER_MAP.get(a) ?? Number.MAX_SAFE_INTEGER;
    const rankB = CASE_TYPE_LABEL_ORDER_MAP.get(b) ?? Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.localeCompare(b);
  });
}

export const STATUS_LABELS: Record<PipelineStage, string> = {
  LEAD: 'Lead',
  RECOMMENDATION: 'Recommendation',
  APPLICATION: 'Application',
  OFFER: 'Offer',
  COMPLETION: 'Completion',
  NOT_PROCEEDING: 'Not proceeding',
};

export const STATUS_TOOLTIPS: Record<PipelineStage, string> = {
  LEAD: 'Represents unqualified interest. Contains LEAD',
  RECOMMENDATION:
    "Groups the adviser's research and advice process. PRE_RECOMMENDATION and POST_RECOMMENDATION_REVIEW are both internal adviser states before the client has committed to anything. Contains PRE_RECOMMENDATION, POST_RECOMMENDATION_REVIEW",
  APPLICATION:
    "Everything from the client agreeing to proceed through to the lender receiving the case. REFERRED sits here because it's still fundamentally an underwriting response to the submission, not a new stage in the client journey. Contains PRE_APPLICATION, REVIEW, APPLICATION_SUBMITTED, REFERRED",
  OFFER:
    "The lender's assessment phase. AWAITING_VALUATION and AWAITING_OFFER are both just waiting states within this phase, and OFFER_RECEIVED is the outcome. Reflects that the client and broker are essentially waiting on the lender throughout. Contains AWAITING_VALUATION, AWAITING_OFFER, OFFER_RECEIVED",
  COMPLETION:
    "EXCHANGE and COMPLETE are both conveyancing milestones. They're legally distinct but from a mortgage pipeline perspective they represent the same final phase - the deal is done, it's just a matter of when the keys exchange hands. Contains EXCHANGE, COMPLETE",
  NOT_PROCEEDING: 'Exit state that can occur at any stage. Contains NOT_PROCEEDING',
};

export function isSystemCaseStatus(status: RawCaseStatus): boolean {
  return SYSTEM_CASE_STATUSES.includes(status);
}

export function toPipelineStage(status: RawCaseStatus): PipelineStage | null {
  return PIPELINE_STAGE_BY_STATUS[status] ?? null;
}

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

