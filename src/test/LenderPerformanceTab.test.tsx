import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../types/mortgage';
import { LenderPerformanceTab } from '../components/lender/LenderPerformanceTab';

const marketStats: MarketStats = {
  totalCases: 12,
  totalLoanValue: 2_000_000,
  completedCases: 4,
  avgCompletionDays: 24,
  avgLtv: 0.79,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 10,
  avgDaysToComplete: 24,
  resubmissionRate: 0.09,
  stalledSubmittedRate: 0.12,
  pipeline: [
    { status: 'LEAD', count: 12, percentage: 1 },
    { status: 'RECOMMENDATION', count: 10, percentage: 0.83 },
    { status: 'APPLICATION', count: 7, percentage: 0.58 },
    { status: 'OFFER', count: 5, percentage: 0.42 },
    { status: 'COMPLETION', count: 4, percentage: 0.33 },
    { status: 'NOT_PROCEEDING', count: 2, percentage: 0.17 },
  ],
  excludedSystemStateCount: 0,
  monthlyVolume: [{ key: '2025-01', month: '01', count: 12 }],
  dailyVolume: [{ key: '2025-01-01', day: '01', count: 2 }],
  caseMix: [{ label: 'First-time buyer', count: 12, percentage: 1 }],
  marketShare: [{ lender: 'Lender A', count: 6, percentage: 0.5 }],
  ltvDistribution: [{ label: '75-85%', count: 12, percentage: 1 }],
  mortgageAmountDistribution: [{ label: '£200-350k', count: 12, percentage: 1 }],
};

function buildCase(
  caseId: string,
  lender: string,
  revenue: number,
  linkedProtection: boolean,
  caseType: MortgageCase['caseType'],
  createdAt = new Date('2025-12-01'),
): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase(),
    prevLender: null,
    caseType,
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt,
    recommendationDate: new Date('2025-01-02'),
    firstSubmittedDate: new Date('2025-01-05'),
    lastSubmittedDate: new Date('2025-01-05'),
    firstOfferDate: new Date('2025-01-10'),
    completionDate: new Date('2025-01-20'),
    mortgageAmount: 220_000,
    propertyValue: 300_000,
    ltv: 0.73,
    linkedProtection,
    totalBrokerFees: revenue,
    grossMortgageProcFee: 500,
    totalCaseRevenue: revenue,
    initialPayRate: 4.54,
  };
}

describe('LenderPerformanceTab', () => {
  it('shows normalized initial rate as percentage and styles positive revenue delta', () => {
    const periodData: MortgageCase[] = [
      buildCase('1', 'Lender A', 1_500, true, 'REASON_FTB'),
      buildCase('2', 'Lender A', 1_300, true, 'REASON_FTB'),
      buildCase('3', 'Lender A', 1_100, false, 'REASON_HOUSE_MOVE'),
      buildCase('4', 'Other', 1_000, false, 'REASON_FTB'),
      buildCase('5', 'Other', 900, false, 'REASON_HOUSE_MOVE'),
      buildCase('6', 'Other', 1_200, true, 'REASON_HOUSE_MOVE'),
    ];
    const allRows: MortgageCase[] = [
      ...periodData,
      buildCase('7', 'Lender A', 900, false, 'REASON_FTB', new Date('2025-11-01')),
      buildCase('8', 'Lender A', 850, false, 'REASON_HOUSE_MOVE', new Date('2025-11-10')),
    ];

    render(
      <LenderPerformanceTab
        periodData={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_month' }}
        allRows={allRows}
      />,
    );

    expect(screen.getByText('4.54%')).toBeInTheDocument();

    const deltaText = screen.getByText(/\+£\d+ vs prev period/);
    expect(deltaText.className).toContain('text-green-700');

    expect(screen.getByText('FTB')).toBeInTheDocument();
    expect(screen.getByText('House Move')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Case type performance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product mix vs market' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compliance composition' })).toBeInTheDocument();
  });

  it('expands grouped other case types in protection attach chart', () => {
    const periodData: MortgageCase[] = [
      buildCase('1', 'Lender A', 1_500, true, 'REASON_FTB'),
      buildCase('2', 'Lender A', 1_300, true, 'REASON_EQUITY_RELEASE'),
      buildCase('3', 'Other', 1_000, false, 'REASON_EQUITY_RELEASE'),
    ];

    render(
      <LenderPerformanceTab
        periodData={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
        allRows={periodData}
      />,
    );

    expect(screen.getAllByText('Other').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getAllByText('Equity Release').length).toBeGreaterThan(0);
  });
});
