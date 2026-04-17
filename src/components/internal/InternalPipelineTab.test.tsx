import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { InternalPipelineTab } from './InternalPipelineTab';

const marketStats: MarketStats = {
  totalCases: 10,
  totalLoanValue: 1_000_000,
  completedCases: 3,
  avgCompletionDays: 18,
  avgLtv: 0.78,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 9,
  avgDaysToComplete: 18,
  resubmissionRate: 0.1,
  stalledSubmittedRate: 0.15,
  pipeline: [
    { status: 'LEAD', count: 10, percentage: 1 },
    { status: 'PRE_RECOMMENDATION', count: 8, percentage: 0.8 },
    { status: 'APPLICATION_SUBMITTED', count: 6, percentage: 0.6 },
    { status: 'OFFER_RECEIVED', count: 4, percentage: 0.4 },
    { status: 'COMPLETE', count: 3, percentage: 0.3 },
    { status: 'NOT_PROCEEDING', count: 2, percentage: 0.2 },
  ],
  monthlyVolume: [{ month: '01', count: 10 }],
  caseMix: [{ label: 'First-time buyer', count: 10, percentage: 1 }],
  marketShare: [{ lender: 'Lender A', count: 10, percentage: 1 }],
  ltvDistribution: [{ label: '75-85%', count: 10, percentage: 1 }],
  mortgageAmountDistribution: [{ label: '£200-350k', count: 10, percentage: 1 }],
};

const periodData: MortgageCase[] = [
  {
    caseId: 'c-1',
    lender: 'Lender A',
    lenderId: '1',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt: new Date('2025-01-04'),
    firstSubmittedDate: new Date('2025-01-05'),
    lastSubmittedDate: new Date('2025-01-05'),
    firstOfferDate: new Date('2025-01-10'),
    completionDate: new Date('2025-01-20'),
    mortgageAmount: 250000,
    propertyValue: 300000,
    ltv: 0.83,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1500,
    initialPayRate: 4.5,
  },
];

describe('InternalPipelineTab', () => {
  it('adds hover and selected row styling for table rows', async () => {
    const user = userEvent.setup();
    const { container } = render(<InternalPipelineTab stats={marketStats} periodData={periodData} />);

    const row = container.querySelector('tbody tr');
    if (!row) {
      throw new Error('Expected conversion row to exist');
    }

    expect(row).toHaveClass('hover:bg-gray-100');
    expect(row).toHaveClass('cursor-pointer');
    expect(row).not.toHaveClass('bg-gray-200');

    await user.click(row);
    expect(row).toHaveClass('bg-gray-200');
  });
});
