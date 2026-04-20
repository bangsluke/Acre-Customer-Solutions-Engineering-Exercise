import { describe, expect, it } from 'vitest';
import type { DateRange, MortgageCase } from '../types/mortgage';
import { computePipelineFunnel, computeStageDistribution } from '../utils/funnelMetrics';

const dateRange: DateRange = {
  start: new Date('2025-01-01T00:00:00Z'),
  end: new Date('2025-12-31T23:59:59Z'),
};

function buildCase(overrides: Partial<MortgageCase>): MortgageCase {
  return {
    caseId: 'case-1',
    lender: 'Halifax',
    lenderId: 'hfx',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'LEAD',
    notProceedingReason: null,
    notProceedingDate: null,
    createdAt: new Date('2025-02-01T00:00:00Z'),
    recommendationDate: null,
    firstSubmittedDate: null,
    lastSubmittedDate: null,
    firstOfferDate: null,
    completionDate: null,
    mortgageAmount: 250_000,
    propertyValue: 300_000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 700,
    totalCaseRevenue: 1_200,
    netCaseRevenue: 1_200,
    initialPayRate: 0.045,
    initialRateType: 'fixed',
    term: 30,
    termUnit: 'TERM_YEARS',
    regulated: true,
    consumerBtl: false,
    furtherAdvance: false,
    pt: false,
    porting: false,
    clubName: null,
    ...overrides,
  };
}

describe('funnelMetrics', () => {
  it('computes stage distribution with shares summing to ~100%', () => {
    const rows: MortgageCase[] = [
      buildCase({ caseId: 'lead-1', caseStatus: 'LEAD' }),
      buildCase({ caseId: 'rec-1', caseStatus: 'PRE_RECOMMENDATION', recommendationDate: new Date('2025-02-03') }),
      buildCase({ caseId: 'app-1', caseStatus: 'APPLICATION_SUBMITTED', firstSubmittedDate: new Date('2025-02-05') }),
      buildCase({ caseId: 'drop-1', caseStatus: 'NOT_PROCEEDING', notProceedingDate: new Date('2025-02-12') }),
      buildCase({ caseId: 'sys-1', caseStatus: 'IMPORTING' }),
    ];
    const result = computeStageDistribution(rows, dateRange);
    const shareSum = result.rows.reduce((sum, row) => sum + row.shareOfTotal, 0);
    const countSum = result.rows.reduce((sum, row) => sum + row.count, 0);

    expect(Math.round(shareSum * 1000) / 1000).toBeCloseTo(1, 3);
    expect(countSum).toBe(result.totalIncludedCases);
    expect(result.excludedSystemStateCount).toBe(1);
  });

  it('computes pipeline cohort and conversion invariants', () => {
    const rows: MortgageCase[] = [
      buildCase({
        caseId: 'c-1',
        recommendationDate: new Date('2025-02-02'),
        firstSubmittedDate: new Date('2025-02-03'),
        firstOfferDate: new Date('2025-02-04'),
        completionDate: new Date('2025-02-05'),
      }),
      buildCase({
        caseId: 'c-2',
        recommendationDate: new Date('2025-02-02'),
        firstSubmittedDate: new Date('2025-02-03'),
      }),
      buildCase({
        caseId: 'c-3',
        recommendationDate: null,
        firstSubmittedDate: null,
      }),
      buildCase({
        caseId: 'c-4',
        caseStatus: 'IMPORTING',
      }),
      buildCase({
        caseId: 'c-5',
        ltv: 1.8,
      }),
      buildCase({
        caseId: 'c-6',
        pt: true,
      }),
    ];

    const withPt = computePipelineFunnel(rows, dateRange, { excludeProductTransfers: false });
    const withoutPt = computePipelineFunnel(rows, dateRange, { excludeProductTransfers: true });

    expect(withoutPt.cohortCount).toBeLessThanOrEqual(withPt.cohortCount);
    expect(withoutPt.excludedSystemStateCount).toBe(1);
    expect(withoutPt.excludedLtvCount).toBe(1);
    expect(withoutPt.rows[0]?.medianDaysFromPrev).toBeNull();

    for (let i = 1; i < withoutPt.rows.length; i += 1) {
      expect(withoutPt.rows[i]?.count ?? 0).toBeLessThanOrEqual(withoutPt.rows[i - 1]?.count ?? 0);
    }

    for (const row of withoutPt.rows) {
      expect(row.cumulativeConversion).toBeGreaterThanOrEqual(0);
      expect(row.cumulativeConversion).toBeLessThanOrEqual(1);
      if (row.stageConversion !== null) {
        expect(row.stageConversion).toBeGreaterThanOrEqual(0);
        expect(row.stageConversion).toBeLessThanOrEqual(1);
      }
    }
  });
});
