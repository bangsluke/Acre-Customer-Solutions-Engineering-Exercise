import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../types/mortgage';
import { computeStalledSubmittedInsights, evaluateLenderInsights, evaluateLtvOpportunityGaps } from '../utils/lenderInsights';

const marketStats: MarketStats = {
  totalCases: 4,
  totalLoanValue: 1_000_000,
  completedCases: 2,
  avgCompletionDays: 20,
  avgLtv: 0.75,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 10,
  avgDaysToComplete: 18,
  resubmissionRate: 0.1,
  stalledSubmittedRate: 0.1,
  pipeline: [],
  excludedSystemStateCount: 0,
  monthlyVolume: [],
  dailyVolume: [],
  caseMix: [],
  marketShare: [],
  ltvDistribution: [],
  mortgageAmountDistribution: [],
};

const baseCase: MortgageCase = {
  caseId: 'case-1',
  lender: 'Halifax',
  lenderId: 'halifax',
  prevLender: null,
  caseType: 'REASON_FTB',
  caseStatus: 'APPLICATION_SUBMITTED',
  notProceedingReason: null,
  createdAt: new Date('2025-01-01'),
  recommendationDate: new Date('2025-01-03'),
  firstSubmittedDate: new Date('2025-01-05'),
  lastSubmittedDate: new Date('2025-01-05'),
  firstOfferDate: new Date('2025-01-30'),
  completionDate: null,
  mortgageAmount: 300000,
  propertyValue: 350000,
  ltv: 0.86,
  linkedProtection: false,
  totalBrokerFees: 0,
  grossMortgageProcFee: 0,
  totalCaseRevenue: 0,
  initialPayRate: 4.5,
};

describe('evaluateLenderInsights', () => {
  it('treats stalled submitted cases as 14 days or more', () => {
    const rows: MortgageCase[] = [
      {
        ...baseCase,
        caseId: 'stalled-14',
        lender: 'Halifax',
        lastSubmittedDate: new Date('2025-12-17'),
      },
      {
        ...baseCase,
        caseId: 'not-stalled-13',
        lender: 'Halifax',
        lastSubmittedDate: new Date('2025-12-18'),
      },
      {
        ...baseCase,
        caseId: 'other-lender',
        lender: 'Nationwide',
        lastSubmittedDate: new Date('2025-12-01'),
      },
    ];

    const stalled = computeStalledSubmittedInsights(rows, 'Halifax');
    expect(stalled.thresholdDays).toBe(14);
    expect(stalled.rows.map((row) => row.caseId)).toEqual(['stalled-14']);
  });

  it('returns actionable alerts and recommendations', () => {
    const rows: MortgageCase[] = [
      baseCase,
      {
        ...baseCase,
        caseId: 'case-2',
        caseType: 'REASON_REMORTGAGE',
        linkedProtection: false,
        notProceedingReason: 'LENDER_DECLINED_APPLICATION',
        caseStatus: 'NOT_PROCEEDING',
        mortgageAmount: 200000,
        firstOfferDate: null,
      },
      {
        ...baseCase,
        caseId: 'case-3',
        lender: 'Nationwide',
        firstOfferDate: new Date('2025-01-08'),
        caseStatus: 'COMPLETE',
        completionDate: new Date('2025-01-20'),
        linkedProtection: true,
      },
    ];

    const result = evaluateLenderInsights(rows, 'Halifax', marketStats);
    expect(result.alertMessages.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('returns top LTV capture opportunities when market share is growing and lender is under-indexed', () => {
    const periodData: MortgageCase[] = [
      {
        ...baseCase,
        caseId: 'current-1',
        createdAt: new Date('2025-12-10'),
        lender: 'Halifax',
        ltv: 0.88,
      },
      {
        ...baseCase,
        caseId: 'current-2',
        createdAt: new Date('2025-12-12'),
        lender: 'Other Lender',
        ltv: 0.88,
      },
      {
        ...baseCase,
        caseId: 'current-3',
        createdAt: new Date('2025-12-14'),
        lender: 'Other Lender',
        ltv: 0.93,
      },
      {
        ...baseCase,
        caseId: 'current-4',
        createdAt: new Date('2025-12-16'),
        lender: 'Other Lender',
        ltv: 0.93,
      },
      {
        ...baseCase,
        caseId: 'current-5',
        createdAt: new Date('2025-12-17'),
        lender: 'Halifax',
        ltv: 0.62,
      },
    ];
    const allRows: MortgageCase[] = [
      ...periodData,
      {
        ...baseCase,
        caseId: 'prev-1',
        createdAt: new Date('2025-11-10'),
        lender: 'Other Lender',
        ltv: 0.88,
      },
      {
        ...baseCase,
        caseId: 'prev-2',
        createdAt: new Date('2025-11-11'),
        lender: 'Other Lender',
        ltv: 0.62,
      },
      {
        ...baseCase,
        caseId: 'prev-3',
        createdAt: new Date('2025-11-12'),
        lender: 'Halifax',
        ltv: 0.62,
      },
      {
        ...baseCase,
        caseId: 'prev-4',
        createdAt: new Date('2025-11-13'),
        lender: 'Other Lender',
        ltv: 0.62,
      },
    ];

    const gaps = evaluateLtvOpportunityGaps(allRows, periodData, 'Halifax', { type: 'this_month' });
    expect(gaps.length).toBeGreaterThan(0);
    expect(['85-90%', '90-95%']).toContain(gaps[0]?.label);
    expect(gaps[0]?.marketGrowthRate).toBeGreaterThan(0);
    expect(gaps[0]?.marketShare).toBeGreaterThan(gaps[0]?.lenderShare ?? 0);
  });
});
