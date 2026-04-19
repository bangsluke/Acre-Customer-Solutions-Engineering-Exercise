import { describe, expect, it } from 'vitest';
import {
  buildCaseCompositionRows,
  buildCaseTypePerformanceRows,
  buildClubNetworkRows,
  buildProductMixKpi,
  buildRegulatedCasesKpi,
  caseTypeBreakdown,
  computeLenderStats,
  computeMarketStats,
  initialRateTypeShare,
  monthlySubmissionToOfferDays,
  monthlyCompletedVolume,
} from './aggregations';
import { fixtureRows } from '../test/fixtures';
import type { MortgageCase } from '../types/mortgage';

describe('metrics calculations', () => {
  it('computes resubmission and cycle-time metrics', () => {
    const market = computeMarketStats(fixtureRows);
    const halifax = computeLenderStats(fixtureRows, 'Halifax', market);

    expect(market.resubmissionRate).toBeGreaterThan(0);
    expect(halifax.resubmissionRate).toBeGreaterThan(0);
    expect(market.avgDaysToOffer).toBeGreaterThan(0);
  });

  it('guards against invalid ltv outliers in averages', () => {
    const market = computeMarketStats(fixtureRows);
    expect(market.avgLtv).toBeLessThan(1);
  });

  it('builds daily volume buckets from created dates', () => {
    const rows: MortgageCase[] = [
      {
        ...fixtureRows[0],
        caseId: 'm-1',
        createdAt: new Date('2025-01-05'),
        mortgageAmount: 100000,
      },
      {
        ...fixtureRows[0],
        caseId: 'm-2',
        createdAt: new Date('2025-01-05'),
        mortgageAmount: 0,
      },
      {
        ...fixtureRows[0],
        caseId: 'm-3',
        createdAt: new Date('2025-01-20'),
        mortgageAmount: null,
      },
      {
        ...fixtureRows[0],
        caseId: 'm-4',
        createdAt: new Date('2025-02-01'),
        mortgageAmount: 300000,
      },
    ];
    const market = computeMarketStats(rows);

    expect(market.dailyVolume).toEqual([
      { key: '2025-01-05', day: '05', count: 2 },
      { key: '2025-01-20', day: '20', count: 1 },
      { key: '2025-02-01', day: '01', count: 1 },
    ]);
  });

  it('orders case type breakdown by configured case-type label order', () => {
    const rows: MortgageCase[] = [
      { ...fixtureRows[0], caseId: 'mix-1', caseType: 'REASON_REMORTGAGE' },
      { ...fixtureRows[0], caseId: 'mix-2', caseType: 'REASON_REMORTGAGE' },
      { ...fixtureRows[0], caseId: 'mix-3', caseType: 'REASON_REMORTGAGE' },
      { ...fixtureRows[0], caseId: 'mix-4', caseType: 'REASON_FTB' },
      { ...fixtureRows[0], caseId: 'mix-5', caseType: 'REASON_BTL' },
    ];

    const breakdown = caseTypeBreakdown(rows);

    expect(breakdown.map((row) => row.label)).toEqual(['First-time buyer', 'Remortgage', 'Buy-to-let']);
    expect(breakdown.map((row) => row.percentage)).toEqual([0.2, 0.6, 0.2]);
  });

  it('can expand grouped other case types', () => {
    const rows: MortgageCase[] = [
      { ...fixtureRows[0], caseId: 'other-1', caseType: 'REASON_EQUITY_RELEASE' },
      { ...fixtureRows[0], caseId: 'other-2', caseType: 'REASON_BRIDGING' },
      { ...fixtureRows[0], caseId: 'other-3', caseType: 'REASON_COMMERCIAL' },
    ];

    const grouped = caseTypeBreakdown(rows, true);
    const expanded = caseTypeBreakdown(rows, false);

    expect(grouped.map((row) => row.label)).toEqual(['Other']);
    expect(expanded.map((row) => row.label)).toEqual(['Equity Release', 'Bridging', 'Commercial']);
  });

  it('builds monthly completed volume from completion dates only', () => {
    const rows: MortgageCase[] = [
      {
        ...fixtureRows[0],
        caseId: 'c-1',
        caseStatus: 'COMPLETE',
        completionDate: new Date('2025-02-05'),
      },
      {
        ...fixtureRows[0],
        caseId: 'c-2',
        caseStatus: 'EXCHANGE',
        completionDate: new Date('2025-02-16'),
      },
      {
        ...fixtureRows[0],
        caseId: 'c-3',
        caseStatus: 'OFFER_RECEIVED',
        completionDate: new Date('2025-02-18'),
      },
      {
        ...fixtureRows[0],
        caseId: 'c-4',
        caseStatus: 'COMPLETE',
        completionDate: null,
      },
      {
        ...fixtureRows[0],
        caseId: 'c-5',
        caseStatus: 'COMPLETE',
        completionDate: new Date('2025-03-02'),
      },
    ];

    expect(monthlyCompletedVolume(rows)).toEqual([
      { key: '2025-02', month: '02', count: 2 },
      { key: '2025-03', month: '03', count: 1 },
    ]);
  });

  it('builds submission-month timeline for average submission-to-offer days', () => {
    const rows: MortgageCase[] = [
      {
        ...fixtureRows[0],
        caseId: 't-1',
        firstSubmittedDate: new Date('2025-01-02'),
        firstOfferDate: new Date('2025-01-10'),
      },
      {
        ...fixtureRows[0],
        caseId: 't-2',
        firstSubmittedDate: new Date('2025-01-04'),
        firstOfferDate: new Date('2025-01-14'),
      },
      {
        ...fixtureRows[0],
        caseId: 't-3',
        firstSubmittedDate: new Date('2025-02-01'),
        firstOfferDate: new Date('2025-02-04'),
      },
      {
        ...fixtureRows[0],
        caseId: 't-4',
        firstSubmittedDate: null,
        firstOfferDate: new Date('2025-02-05'),
      },
    ];

    expect(monthlySubmissionToOfferDays(rows)).toEqual([
      { key: '2025-01', month: '01', avgDays: 9 },
      { key: '2025-02', month: '02', avgDays: 3 },
    ]);
  });

  it('builds product analysis aggregations from parsed product fields', () => {
    const rows: MortgageCase[] = [
      {
        ...fixtureRows[0],
        caseId: 'p-1',
        caseType: 'REASON_FTB',
        caseStatus: 'COMPLETE',
        netCaseRevenue: 1000,
        totalCaseRevenue: 900,
        initialRateType: 'fixed',
        term: 300,
        termUnit: 'TERM_MONTHS',
        regulated: true,
        pt: true,
        clubName: 'Right Mortgage Network',
      },
      {
        ...fixtureRows[0],
        caseId: 'p-2',
        caseType: 'REASON_FTB',
        caseStatus: 'NOT_PROCEEDING',
        netCaseRevenue: 500,
        totalCaseRevenue: 400,
        initialRateType: 'tracker',
        term: 25,
        termUnit: 'TERM_YEARS',
        regulated: false,
        consumerBtl: true,
        furtherAdvance: true,
        porting: true,
        clubName: 'Primis',
      },
      {
        ...fixtureRows[0],
        caseId: 'p-3',
        caseType: 'REASON_REMORTGAGE',
        caseStatus: 'COMPLETE',
        netCaseRevenue: null,
        totalCaseRevenue: 1200,
        initialRateType: 'stepped',
        term: 180,
        termUnit: 'TERM_MONTHS',
        regulated: true,
        clubName: '',
      },
    ];

    const caseTypePerformance = buildCaseTypePerformanceRows(rows);
    const ftb = caseTypePerformance.find((row) => row.caseType === 'First-time buyer');
    expect(ftb?.volume).toBe(2);
    expect(ftb?.completionRate).toBe(0.5);
    expect(ftb?.notProceedingRate).toBe(0.5);
    expect(ftb?.avgNetRevenue).toBe(750);

    const rateMix = initialRateTypeShare(rows);
    expect(rateMix).toEqual([
      { label: 'Fixed', count: 1, percentage: 1 / 3 },
      { label: 'Tracker', count: 1, percentage: 1 / 3 },
      { label: 'Discount', count: 0, percentage: 0 },
      { label: 'Variable', count: 0, percentage: 0 },
      { label: 'Stepped', count: 1, percentage: 1 / 3 },
    ]);

    expect(buildProductMixKpi(rows).averageTermYears).toBeCloseTo(21.6666, 3);
    expect(buildRegulatedCasesKpi(rows)).toEqual({ count: 2, percentage: 2 / 3 });
    expect(buildCaseCompositionRows(rows)).toEqual([
      { label: 'Product transfer', count: 1, percentage: 1 / 3 },
      { label: 'Consumer BTL', count: 1, percentage: 1 / 3 },
      { label: 'Further advance', count: 1, percentage: 1 / 3 },
      { label: 'Porting', count: 1, percentage: 1 / 3 },
    ]);

    expect(buildClubNetworkRows(rows)).toEqual([
      { clubName: 'Blank', cases: 1, completionRate: 1, totalLoanValue: 200000 },
      { clubName: 'Right Mortgage Network', cases: 1, completionRate: 1, totalLoanValue: 200000 },
      { clubName: 'Primis', cases: 1, completionRate: 0, totalLoanValue: 0 },
    ]);
  });
});

