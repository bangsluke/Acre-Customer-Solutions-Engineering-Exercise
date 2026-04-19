import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { LenderPipelineTab } from './LenderPipelineTab';

const marketStats: MarketStats = {
  totalCases: 10,
  totalLoanValue: 1_000_000,
  completedCases: 2,
  avgCompletionDays: 20,
  avgLtv: 0.8,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 5,
  avgDaysToComplete: 20,
  resubmissionRate: 0.1,
  stalledSubmittedRate: 0.1,
  pipeline: [
    { status: 'LEAD', count: 10, percentage: 1 },
    { status: 'RECOMMENDATION', count: 8, percentage: 0.8 },
    { status: 'APPLICATION', count: 5, percentage: 0.5 },
    { status: 'OFFER', count: 3, percentage: 0.3 },
    { status: 'COMPLETION', count: 2, percentage: 0.2 },
    { status: 'NOT_PROCEEDING', count: 1, percentage: 0.1 },
  ],
  excludedSystemStateCount: 0,
  monthlyVolume: [{ key: '2025-01', month: '01', count: 10 }],
  dailyVolume: [{ key: '2025-01-01', day: '01', count: 1 }],
  caseMix: [{ label: 'First-time buyer', count: 10, percentage: 1 }],
  marketShare: [{ lender: 'Lender A', count: 10, percentage: 1 }],
  ltvDistribution: [{ label: '75-85%', count: 10, percentage: 1 }],
  mortgageAmountDistribution: [{ label: '£200-350k', count: 10, percentage: 1 }],
};

function buildCase(caseId: string, submittedDate: string, mortgageAmount: number, overrides: Partial<MortgageCase> = {}): MortgageCase {
  return {
    caseId,
    lender: 'Lender A',
    lenderId: 'lender-a',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'APPLICATION_SUBMITTED',
    notProceedingReason: null,
    createdAt: new Date('2025-01-01'),
    recommendationDate: new Date('2025-01-02'),
    firstSubmittedDate: new Date(submittedDate),
    lastSubmittedDate: new Date(submittedDate),
    firstOfferDate: null,
    completionDate: null,
    mortgageAmount,
    propertyValue: 300000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1500,
    initialPayRate: 4.2,
    ...overrides,
  };
}

function firstCaseId(container: HTMLElement): string {
  const firstCell = container.querySelector('tbody tr td');
  if (!firstCell) {
    throw new Error('Expected stalled case row');
  }
  return firstCell.textContent ?? '';
}

describe('LenderPipelineTab', () => {
  it('sorts stalled list by mortgage amount', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('low001', '2025-10-01', 150000),
      buildCase('high001', '2025-08-01', 350000),
    ];

    const { container } = render(
      <LenderPipelineTab
        periodData={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    const mortgageAmountButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Mortgage amount'),
    ) as HTMLButtonElement | undefined;
    if (!mortgageAmountButton) {
      throw new Error('Expected mortgage amount sort button');
    }

    await user.click(mortgageAmountButton);
    expect(firstCaseId(container)).toContain('high001');
    await user.click(mortgageAmountButton);
    expect(firstCaseId(container)).toContain('low001');
    expect(screen.getByText('Stall start date')).toBeInTheDocument();
    expect(screen.getAllByText('Revenue at risk').length).toBeGreaterThan(0);
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conversion velocity timeline' })).toBeInTheDocument();
  });

  it('groups selected drop-off reasons into Other, expands grouped values, and shows revenue-at-risk', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('np-1', '2025-10-01', 150000, {
        caseStatus: 'NOT_PROCEEDING',
        notProceedingReason: 'NO_RESPONSE',
        totalCaseRevenue: 1000,
      }),
      buildCase('np-2', '2025-10-01', 150000, {
        caseStatus: 'NOT_PROCEEDING',
        notProceedingReason: 'FEE_CONCERNS',
        totalCaseRevenue: 1200,
      }),
      buildCase('np-3', '2025-10-01', 150000, {
        caseStatus: 'NOT_PROCEEDING',
        notProceedingReason: 'LENDER_DECLINED_APPLICATION',
        totalCaseRevenue: 800,
      }),
    ];

    render(
      <LenderPipelineTab
        periodData={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    expect(screen.getByText('Drop-off reasons')).toBeInTheDocument();
    const dropOffSection = screen.getByRole('heading', { name: 'Drop-off reasons' }).closest('section');
    if (!dropOffSection) {
      throw new Error('Expected drop-off section');
    }
    expect(within(dropOffSection).getByText('Revenue at risk')).toBeInTheDocument();
    expect(within(dropOffSection).getByRole('button', { name: 'Expand Other' })).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();
    expect(screen.getByText('£2,000')).toBeInTheDocument();
    expect(screen.queryByText('Fee Concerns')).not.toBeInTheDocument();

    await user.click(within(dropOffSection).getByRole('button', { name: 'Expand Other' }));

    expect(within(dropOffSection).getByRole('button', { name: 'Group Other' })).toBeInTheDocument();
    expect(screen.getByText('Fee Concerns')).toBeInTheDocument();
    expect(screen.getByText('Break down fee value transparently and offer staged or lower-cost options where possible.')).toBeInTheDocument();
  });
});
