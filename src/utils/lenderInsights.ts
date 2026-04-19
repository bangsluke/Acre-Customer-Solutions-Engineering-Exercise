import type { MarketStats, MortgageCase, TimePeriod } from '../types/mortgage';
import { filterByPeriod, ltvDistribution } from './aggregations';
import { CASE_TYPE_LABELS, isSystemCaseStatus, toPipelineStage } from './constants';
import { priorPeriod } from './dateUtils';

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const STALLED_DAYS_THRESHOLD = 14;

function protectionByType(rows: MortgageCase[]) {
  const map = new Map<string, { total: number; protectedCount: number }>();
  for (const row of rows) {
    const label = CASE_TYPE_LABELS[row.caseType] ?? 'Other';
    const bucket = map.get(label) ?? { total: 0, protectedCount: 0 };
    bucket.total += 1;
    if (row.linkedProtection) {
      bucket.protectedCount += 1;
    }
    map.set(label, bucket);
  }
  return [...map.entries()].map(([label, item]) => ({
    label,
    rate: item.total ? item.protectedCount / item.total : 0,
  }));
}

function averageOfferDays(rows: MortgageCase[]): number {
  const values = rows
    .map((row) => daysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((value): value is number => value !== null);
  return average(values);
}

export interface InsightRecommendation {
  text: string;
  tone: 'amber' | 'red' | 'green';
  href: string;
}

export interface InsightEvaluation {
  alertMessages: string[];
  recommendations: InsightRecommendation[];
}

export interface LtvOpportunityGap {
  label: string;
  marketGrowthRate: number;
  lenderShare: number;
  marketShare: number;
  shareGap: number;
  opportunityScore: number;
}

export interface StalledSubmittedCase {
  caseId: string;
  stallStartDate: Date | null;
  daysStalled: number;
  caseType: string;
  revenueAtRisk: number;
  mortgageAmount: number;
}

export interface StalledSubmittedInsights {
  thresholdDays: number;
  rows: StalledSubmittedCase[];
  stalledCount: number;
  revenueAtRisk: number;
  mortgageValueAtRisk: number;
  avgDaysStalled: number;
}

export function computeStalledSubmittedInsights(
  periodData: MortgageCase[],
  selectedLender: string,
  now: Date = new Date(2025, 11, 31),
): StalledSubmittedInsights {
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  const submittedRows = lenderRows.filter((row) => toPipelineStage(row.caseStatus) === 'APPLICATION');
  const thresholdDays = STALLED_DAYS_THRESHOLD;

  const rows = submittedRows
    .map((row) => ({
      caseId: row.caseId,
      stallStartDate: row.lastSubmittedDate ?? row.firstSubmittedDate,
      daysStalled: daysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now) ?? 0,
      caseType: CASE_TYPE_LABELS[row.caseType] ?? 'Other',
      revenueAtRisk: row.totalCaseRevenue ?? 0,
      mortgageAmount: row.mortgageAmount ?? 0,
    }))
    .filter((row) => row.daysStalled >= thresholdDays)
    .sort((a, b) => b.daysStalled - a.daysStalled);

  return {
    thresholdDays,
    rows,
    stalledCount: rows.length,
    revenueAtRisk: rows.reduce((sum, row) => sum + row.revenueAtRisk, 0),
    mortgageValueAtRisk: rows.reduce((sum, row) => sum + row.mortgageAmount, 0),
    avgDaysStalled: average(rows.map((row) => row.daysStalled)),
  };
}

export function evaluateLenderInsights(periodData: MortgageCase[], selectedLender: string, marketStats: MarketStats): InsightEvaluation {
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  const stalledInsights = computeStalledSubmittedInsights(periodData, selectedLender);
  const stalledThresholdLabel = Math.max(STALLED_DAYS_THRESHOLD, Math.round(stalledInsights.thresholdDays));
  const lenderRowsWithoutSystemStates = lenderRows.filter((row) => !isSystemCaseStatus(row.caseStatus));
  const periodRowsWithoutSystemStates = periodData.filter((row) => !isSystemCaseStatus(row.caseStatus));
  const lenderNotProceedingRate = lenderRowsWithoutSystemStates.length
    ? lenderRowsWithoutSystemStates.filter((row) => toPipelineStage(row.caseStatus) === 'NOT_PROCEEDING').length / lenderRowsWithoutSystemStates.length
    : 0;
  const marketNotProceedingRate = periodRowsWithoutSystemStates.length
    ? periodRowsWithoutSystemStates.filter((row) => toPipelineStage(row.caseStatus) === 'NOT_PROCEEDING').length / periodRowsWithoutSystemStates.length
    : 0;

  const protectionRows = protectionByType(lenderRows).sort((a, b) => b.rate - a.rate);
  const highestProtection = protectionRows[0];
  const lowestProtection = protectionRows[protectionRows.length - 1];

  const lenderOfferDays = averageOfferDays(lenderRows);
  const lenderEligibleSubmitted = lenderRows.filter((row) => row.firstSubmittedDate);
  const lenderResubRate = lenderEligibleSubmitted.length
    ? lenderEligibleSubmitted.filter((row) => row.lastSubmittedDate && row.lastSubmittedDate > row.firstSubmittedDate!).length /
      lenderEligibleSubmitted.length
    : 0;

  const recommendations: InsightRecommendation[] = [];
  if (stalledInsights.stalledCount > 0) {
    recommendations.push({
      text: `You have ${stalledInsights.stalledCount} cases stalled in Submitted for an average of ${Math.round(
        stalledInsights.avgDaysStalled,
      )} days - £${Math.round(
        stalledInsights.mortgageValueAtRisk,
      ).toLocaleString('en-GB')} in mortgage value at risk.`,
      tone: 'amber',
      href: '#revenue-at-risk',
    });
  }
  if (lenderNotProceedingRate > marketNotProceedingRate) {
    recommendations.push({
      text: `Your not-proceeding rate (${Math.round(lenderNotProceedingRate * 100)}%) is above the market average (${Math.round(
        marketNotProceedingRate * 100,
      )}%) - review top drop-off reasons below.`,
      tone: 'red',
      href: '#drop-off-reasons',
    });
  }
  if (
    lowestProtection &&
    highestProtection &&
    highestProtection.rate > 0 &&
    lowestProtection.rate < highestProtection.rate / 2
  ) {
    recommendations.push({
      text: `Your ${lowestProtection.label} protection attach rate (${Math.round(
        lowestProtection.rate * 100,
      )}%) is significantly lower than your ${highestProtection.label} rate (${Math.round(
        highestProtection.rate * 100,
      )}%) - a potential revenue opportunity.`,
      tone: 'amber',
      href: '#protection-attach',
    });
  }
  if (lenderOfferDays > marketStats.avgDaysToOffer) {
    recommendations.push({
      text: `Your submission-to-offer speed (${Math.round(lenderOfferDays)} days) is slower than the market average (${Math.round(
        marketStats.avgDaysToOffer,
      )} days).`,
      tone: 'amber',
      href: '#conversion-velocity',
    });
  }
  if (lenderResubRate > marketStats.resubmissionRate + 0.05) {
    recommendations.push({
      text: `Your resubmission rate (${Math.round(lenderResubRate * 100)}%) is above the market average (${Math.round(
        marketStats.resubmissionRate * 100,
      )}%) - first-submission quality may be improvable.`,
      tone: 'red',
      href: '#resubmission-analysis',
    });
  }

  const alertMessages = [];
  if (stalledInsights.stalledCount > 0) {
    alertMessages.push(
      `You have ${stalledInsights.stalledCount} cases stalled in Submitted for ${stalledThresholdLabel} days or more`,
    );
  }
  if (lenderOfferDays > marketStats.avgDaysToOffer) {
    alertMessages.push('Submission-to-offer speed is slower than market average');
  }
  if (lenderNotProceedingRate > marketNotProceedingRate) {
    alertMessages.push('Not-proceeding rate is above market average');
  }
  return {
    alertMessages,
    recommendations: recommendations.slice(0, 5),
  };
}

export function evaluateLtvOpportunityGaps(
  allRows: MortgageCase[],
  periodData: MortgageCase[],
  selectedLender: string,
  period: TimePeriod,
): LtvOpportunityGap[] {
  const previousPeriod = priorPeriod(period);
  if (!previousPeriod) {
    return [];
  }
  const previousRows = filterByPeriod(allRows, previousPeriod);
  if (previousRows.length === 0) {
    return [];
  }

  const currentMarketBands = ltvDistribution(periodData);
  const previousMarketBands = ltvDistribution(previousRows);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  const currentLenderBands = ltvDistribution(lenderRows);

  const previousMarketMap = new Map(previousMarketBands.map((row) => [row.label, row.percentage]));
  const currentLenderMap = new Map(currentLenderBands.map((row) => [row.label, row.percentage]));

  return currentMarketBands
    .map((row) => {
      const previousMarketShare = previousMarketMap.get(row.label) ?? 0;
      const marketGrowthRate = row.percentage - previousMarketShare;
      const lenderShare = currentLenderMap.get(row.label) ?? 0;
      const shareGap = row.percentage - lenderShare;
      return {
        label: row.label,
        marketGrowthRate,
        lenderShare,
        marketShare: row.percentage,
        shareGap,
        opportunityScore: marketGrowthRate * Math.max(shareGap, 0),
      };
    })
    .filter((row) => row.marketGrowthRate > 0 && row.lenderShare < row.marketShare)
    .sort((a, b) => b.opportunityScore - a.opportunityScore || b.shareGap - a.shareGap || a.label.localeCompare(b.label))
    .slice(0, 2);
}
