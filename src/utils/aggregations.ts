import { differenceInCalendarDays, format, isWithinInterval } from 'date-fns';
import type {
  CaseStatus,
  DistributionBucket,
  LenderStats,
  MarketStats,
  MortgageCase,
  PeriodModel,
  PipelineRow,
  TimePeriod,
} from '../types/mortgage';
import { ALL_STATUS_ORDER, CASE_TYPE_LABELS, LTV_BANDS, MORTGAGE_AMOUNT_BANDS, PIPELINE_ORDER } from './constants';
import { resolvePeriodBounds, toPeriodKey } from './dateUtils';

function safeDaysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  return Math.max(0, differenceInCalendarDays(end, start));
}

function avg(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function medianValue(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function toDistribution(values: Record<string, number>): DistributionBucket[] {
  const total = Object.values(values).reduce((sum, v) => sum + v, 0);
  return Object.entries(values).map(([label, count]) => ({
    label,
    count,
    percentage: total ? count / total : 0,
  }));
}

export function filterByPeriod(data: MortgageCase[], period: TimePeriod): MortgageCase[] {
  const bounds = resolvePeriodBounds(period);
  return data.filter((item) => {
    if (!item.createdAt) {
      return false;
    }
    return isWithinInterval(item.createdAt, bounds);
  });
}

export function pipelineFunnel(data: MortgageCase[]): PipelineRow[] {
  const total = data.length || 1;
  const counts = new Map<CaseStatus, number>();
  for (const status of ALL_STATUS_ORDER) {
    counts.set(status, 0);
  }
  for (const row of data) {
    counts.set(row.caseStatus, (counts.get(row.caseStatus) ?? 0) + 1);
  }

  return ALL_STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
    percentage: (counts.get(status) ?? 0) / total,
  }));
}

export function ltvDistribution(data: MortgageCase[]): DistributionBucket[] {
  const buckets = new Map<string, number>(LTV_BANDS.map((band) => [band.label, 0]));
  for (const row of data) {
    if (row.ltv === null || row.ltv > 1.5 || row.ltv < 0) {
      continue;
    }
    const band = LTV_BANDS.find((item) => row.ltv! <= item.max);
    if (band) {
      buckets.set(band.label, (buckets.get(band.label) ?? 0) + 1);
    }
  }
  return toDistribution(Object.fromEntries(buckets));
}

export function mortgageAmountDistribution(data: MortgageCase[]): DistributionBucket[] {
  const buckets = new Map<string, number>(MORTGAGE_AMOUNT_BANDS.map((band) => [band.label, 0]));
  for (const row of data) {
    if (!row.mortgageAmount || row.mortgageAmount <= 0) {
      continue;
    }
    const band = MORTGAGE_AMOUNT_BANDS.find((item) => row.mortgageAmount! >= item.min && row.mortgageAmount! < item.max);
    if (band) {
      buckets.set(band.label, (buckets.get(band.label) ?? 0) + 1);
    }
  }
  return toDistribution(Object.fromEntries(buckets));
}

export function monthlyVolume(data: MortgageCase[]): Array<{ month: string; count: number }> {
  const byMonth = new Map<string, number>();
  for (const row of data) {
    if (!row.createdAt) {
      continue;
    }
    const key = format(row.createdAt, 'yyyy-MM');
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, count]) => ({
      month: monthKey.slice(5, 7),
      count,
    }));
}

export function caseTypeBreakdown(data: MortgageCase[]): DistributionBucket[] {
  const counts: Record<string, number> = {};
  for (const row of data) {
    const label = CASE_TYPE_LABELS[row.caseType] ?? CASE_TYPE_LABELS.UNKNOWN;
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return toDistribution(counts);
}

export function lenderMarketShare(data: MortgageCase[]): Array<{ lender: string; count: number; percentage: number }> {
  const completed = data.filter((item) => item.caseStatus === 'COMPLETE');
  const byLender = new Map<string, number>();
  for (const row of completed) {
    byLender.set(row.lender, (byLender.get(row.lender) ?? 0) + 1);
  }
  const total = completed.length || 1;
  return [...byLender.entries()]
    .map(([lender, count]) => ({
      lender,
      count,
      percentage: count / total,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function computeResubmissionRate(data: MortgageCase[]): number {
  const eligible = data.filter((row) => row.firstSubmittedDate !== null);
  if (!eligible.length) {
    return 0;
  }
  const resubmitted = eligible.filter(
    (row) =>
      row.lastSubmittedDate !== null &&
      row.firstSubmittedDate !== null &&
      row.lastSubmittedDate.getTime() > row.firstSubmittedDate.getTime(),
  ).length;
  return resubmitted / eligible.length;
}

function marketMedianSubmittedToOfferDays(data: MortgageCase[]): number {
  const values = data
    .map((row) => safeDaysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, row.firstOfferDate))
    .filter((v): v is number => v !== null);
  if (!values.length) {
    return 0;
  }
  return medianValue(values);
}

function computeStalledSubmittedRate(data: MortgageCase[], marketMedianDays: number): number {
  const submitted = data.filter((row) => row.caseStatus === 'APPLICATION_SUBMITTED');
  if (!submitted.length || marketMedianDays <= 0) {
    return 0;
  }
  const now = new Date(2025, 11, 31);
  const stalledCount = submitted.filter((row) => {
    const age = safeDaysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now);
    return age !== null && age > marketMedianDays;
  }).length;
  return stalledCount / submitted.length;
}

export function computeMarketStats(data: MortgageCase[]): MarketStats {
  const completionDays = data
    .map((row) => safeDaysBetween(row.firstSubmittedDate, row.completionDate))
    .filter((v): v is number => v !== null);
  const daysToOffer = data
    .map((row) => safeDaysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((v): v is number => v !== null);
  const validLtv = data
    .map((row) => row.ltv)
    .filter((value): value is number => value !== null && value <= 1.5 && value >= 0);
  const marketMedianDays = marketMedianSubmittedToOfferDays(data);

  return {
    totalCases: data.length,
    totalLoanValue: data.reduce((sum, row) => sum + (row.mortgageAmount && row.mortgageAmount > 0 ? row.mortgageAmount : 0), 0),
    completedCases: data.filter((row) => row.caseStatus === 'COMPLETE').length,
    avgCompletionDays: avg(completionDays),
    avgLtv: avg(validLtv),
    protectionAttachRate: data.length ? data.filter((row) => row.linkedProtection).length / data.length : 0,
    avgDaysToOffer: avg(daysToOffer),
    avgDaysToComplete: avg(completionDays),
    resubmissionRate: computeResubmissionRate(data),
    stalledSubmittedRate: computeStalledSubmittedRate(data, marketMedianDays),
    pipeline: pipelineFunnel(data),
    monthlyVolume: monthlyVolume(data),
    caseMix: caseTypeBreakdown(data),
    marketShare: lenderMarketShare(data),
    ltvDistribution: ltvDistribution(data),
    mortgageAmountDistribution: mortgageAmountDistribution(data),
  };
}

export function computeLenderStats(data: MortgageCase[], lender: string, marketStats: MarketStats): LenderStats {
  const lenderRows = data.filter((row) => row.lender === lender);
  const completionDays = lenderRows
    .map((row) => safeDaysBetween(row.firstSubmittedDate, row.completionDate))
    .filter((v): v is number => v !== null);
  const daysToOffer = lenderRows
    .map((row) => safeDaysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((v): v is number => v !== null);
  const completedRows = lenderRows.filter((row) => row.caseStatus === 'COMPLETE');
  const validLoanRows = lenderRows.filter((row) => row.mortgageAmount !== null && row.mortgageAmount > 0);
  const validLtvRows = lenderRows.filter((row) => row.ltv !== null && row.ltv <= 1.5 && row.ltv >= 0);

  return {
    lender,
    totalCases: lenderRows.length,
    marketShare: marketStats.completedCases ? completedRows.length / marketStats.completedCases : 0,
    avgLoanSize: avg(validLoanRows.map((item) => item.mortgageAmount ?? 0)),
    completionRate: lenderRows.length ? completedRows.length / lenderRows.length : 0,
    avgDaysToOffer: avg(daysToOffer),
    avgLtv: avg(validLtvRows.map((item) => item.ltv ?? 0)),
    brokerRevenuePerCase: avg(
      lenderRows
        .map((item) => item.totalCaseRevenue)
        .filter((value): value is number => value !== null),
    ),
    protectionAttachRate: lenderRows.length ? lenderRows.filter((row) => row.linkedProtection).length / lenderRows.length : 0,
    avgDaysToComplete: avg(completionDays),
    resubmissionRate: computeResubmissionRate(lenderRows),
    caseMix: caseTypeBreakdown(lenderRows),
    pipeline: pipelineFunnel(lenderRows),
  };
}

export function computeAllLenderStats(data: MortgageCase[], marketStats: MarketStats): Map<string, LenderStats> {
  const lenders = [...new Set(data.map((item) => item.lender))];
  const map = new Map<string, LenderStats>();
  for (const lender of lenders) {
    map.set(lender, computeLenderStats(data, lender, marketStats));
  }
  return map;
}

export function pickDefaultLender(data: MortgageCase[]): string {
  const counts = new Map<string, number>();
  for (const row of data) {
    if (row.caseStatus !== 'COMPLETE') {
      continue;
    }
    counts.set(row.lender, (counts.get(row.lender) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? data[0]?.lender ?? '';
}

export function computePeriodModel(
  data: MortgageCase[],
  period: TimePeriod,
  quality: PeriodModel['quality'],
): PeriodModel {
  const periodData = filterByPeriod(data, period);
  const marketStats = computeMarketStats(periodData);
  return {
    periodKey: toPeriodKey(period),
    periodData,
    marketStats,
    lenderStats: null,
    quality,
  };
}

export function priorPeriodLabel(period: TimePeriod): string | null {
  if (period.type === 'this_month') {
    return 'vs previous month';
  }
  if (period.type === 'this_quarter') {
    return 'vs previous quarter';
  }
  return null;
}

export function marketConversionRates(data: PipelineRow[]): Array<{ status: string; conversion: number }> {
  return PIPELINE_ORDER.slice(1).map((status, index) => {
    const prev = data.find((row) => row.status === PIPELINE_ORDER[index]);
    const current = data.find((row) => row.status === status);
    return {
      status,
      conversion: prev && current && prev.count > 0 ? current.count / prev.count : 0,
    };
  });
}

