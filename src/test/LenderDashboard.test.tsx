import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LenderStats, MarketStats, MortgageCase } from '../types/mortgage';
import { LenderDashboard } from '../components/lender/LenderDashboard';

const marketStats: MarketStats = {
  totalCases: 30_000,
  totalLoanValue: 6_000_000,
  completedCases: 18_708,
  avgCompletionDays: 20,
  avgLtv: 0.79,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 13,
  avgDaysToComplete: 22,
  resubmissionRate: 0.08,
  stalledSubmittedRate: 0.1,
  pipeline: [
    { status: 'LEAD', count: 30_000, percentage: 1 },
    { status: 'RECOMMENDATION', count: 25_000, percentage: 0.83 },
    { status: 'APPLICATION', count: 19_000, percentage: 0.63 },
    { status: 'OFFER', count: 14_000, percentage: 0.47 },
    { status: 'COMPLETION', count: 9_000, percentage: 0.3 },
    { status: 'NOT_PROCEEDING', count: 2_000, percentage: 0.07 },
  ],
  excludedSystemStateCount: 0,
  monthlyVolume: [{ key: '2025-01', month: '01', count: 100 }],
  dailyVolume: [{ key: '2025-01-01', day: '01', count: 5 }],
  caseMix: [{ label: 'First-time buyer', count: 100, percentage: 1 }],
  marketShare: [{ lender: 'Halifax', count: 18_708, percentage: 0.137 }],
  ltvDistribution: [{ label: '75-85%', count: 100, percentage: 1 }],
  mortgageAmountDistribution: [{ label: '£200-350k', count: 100, percentage: 1 }],
};

const lenderStats: LenderStats = {
  lender: 'Halifax',
  totalCases: 18_708,
  marketShare: 0.137,
  avgLoanSize: 239_660,
  completionRate: 0.81,
  avgDaysToOffer: 8,
  avgLtv: 0.78,
  brokerRevenuePerCase: 890,
  protectionAttachRate: 0.27,
  avgDaysToComplete: 18,
  resubmissionRate: 0.06,
  caseMix: [{ label: 'First-time buyer', count: 100, percentage: 1 }],
  pipeline: [
    { status: 'LEAD', count: 18_708, percentage: 1 },
    { status: 'RECOMMENDATION', count: 15_300, percentage: 0.82 },
    { status: 'APPLICATION', count: 11_200, percentage: 0.6 },
    { status: 'OFFER', count: 9_000, percentage: 0.48 },
    { status: 'COMPLETION', count: 6_100, percentage: 0.33 },
    { status: 'NOT_PROCEEDING', count: 1_400, percentage: 0.07 },
  ],
  excludedSystemStateCount: 0,
};

function buildCase(
  caseId: string,
  lender: string,
  totalCaseRevenue: number,
  createdAt = new Date('2025-01-01'),
  caseStatus: MortgageCase['caseStatus'] = 'LEAD',
  netCaseRevenue = totalCaseRevenue,
): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase(),
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus,
    notProceedingReason: null,
    createdAt,
    recommendationDate: null,
    firstSubmittedDate: null,
    lastSubmittedDate: null,
    firstOfferDate: null,
    completionDate: null,
    mortgageAmount: 220_000,
    propertyValue: 300_000,
    ltv: 0.73,
    linkedProtection: false,
    totalBrokerFees: 300,
    grossMortgageProcFee: 500,
    totalCaseRevenue,
    netCaseRevenue,
    initialPayRate: 0.0454,
  };
}

describe('LenderDashboard', () => {
  it('removes top badge text, updates KPI hierarchy, and includes NOT_PROCEEDING card tooltip', () => {
    const periodData: MortgageCase[] = [
      buildCase('1', 'Halifax', 900, new Date('2025-01-10'), 'LEAD'),
      buildCase('2', 'Halifax', 1000, new Date('2025-01-15'), 'PRE_RECOMMENDATION'),
      buildCase('3', 'Halifax', 1200, new Date('2025-02-10'), 'APPLICATION_SUBMITTED', 200),
      buildCase('4', 'Other', 800, new Date('2025-03-02'), 'LEAD'),
      buildCase('5', 'Other', 820, new Date('2025-03-08'), 'OFFER_RECEIVED'),
      {
        ...buildCase('6', 'Other', 780, new Date('2025-03-21'), 'COMPLETE'),
        completionDate: new Date('2025-03-26'),
      },
      {
        ...buildCase('7', 'Halifax', 980, new Date('2025-02-14'), 'COMPLETE'),
        completionDate: new Date('2025-03-02'),
      },
    ];

    render(
      <LenderDashboard
        selectedLender="Halifax"
        stats={lenderStats}
        marketStats={marketStats}
        periodData={periodData}
        period={{ type: 'this_year' }}
      />,
    );

    expect(screen.queryByText('Top lender by completed cases')).not.toBeInTheDocument();
    expect(screen.queryByText(/cases on Acre this period/i)).not.toBeInTheDocument();
    expect(screen.getByText('18,708 cases')).toBeInTheDocument();
    expect(screen.getByText('Market share: 13.7%')).toBeInTheDocument();
    expect(screen.getByText('£3.1k')).toBeInTheDocument();
    expect(screen.getByText('Total loan value: £880k')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Score Export' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Monthly volume' })).toBeInTheDocument();
    expect(screen.getByText('Case creation by month for Halifax')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly created case volume chart for selected lender')).toBeInTheDocument();
    expect(screen.getByText('Peak: 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(screen.getByText('Completed cases by month for Halifax')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly completed case volume chart for selected lender')).toBeInTheDocument();
    expect(screen.getByText('Peak: 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Pipeline funnel' })).toBeInTheDocument();

    const conversionVelocityLabel = screen.getByText('CONVERSION VELOCITY RANK');
    const yourCasesLabel = screen.getByText('YOUR CASES');
    expect(conversionVelocityLabel.compareDocumentPosition(yourCasesLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const monthlyVolumeHeading = screen.getByRole('heading', { name: 'Monthly volume' });
    const caseMixHeading = screen.getByRole('heading', { name: 'Your case mix vs market' });
    expect(monthlyVolumeHeading.compareDocumentPosition(caseMixHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mortgage amount distribution (you vs market)' })).toBeInTheDocument();

    const rankCard = screen.getByText('CONVERSION VELOCITY RANK').closest('article');
    if (!rankCard) {
      throw new Error('Expected conversion rank card');
    }
    expect(rankCard?.textContent).toContain('of');
    expect(rankCard?.textContent).not.toContain('Rank');
    expect(within(rankCard).getByLabelText('Conversion rank eligibility')).toBeInTheDocument();

    const pipelineHeading = screen.getByText('Your pipeline vs market conversion rates');
    const pipelineSection = pipelineHeading.closest('section');
    if (!pipelineSection) {
      throw new Error('Expected pipeline section');
    }

    expect(within(pipelineSection).getAllByText('Not proceeding').length).toBeGreaterThanOrEqual(1);
    expect(within(pipelineSection).queryByText(/Market:\s*\d/)).not.toBeInTheDocument();

    const notProceedingCard = within(pipelineSection).getAllByText('Not proceeding')[0]?.closest('article');
    if (!notProceedingCard) {
      throw new Error('Expected not proceeding card');
    }
    expect(within(notProceedingCard).getByText(/Lender conversion:/)).toBeInTheDocument();
    expect(within(notProceedingCard).getByText(/Market conversion:/)).toBeInTheDocument();
  }, 10000);

  it('expands grouped other case types in lender case mix', () => {
    const periodData: MortgageCase[] = [
      { ...buildCase('1', 'Halifax', 900, new Date('2025-01-10'), 'LEAD'), caseType: 'REASON_FTB' },
      { ...buildCase('2', 'Halifax', 1000, new Date('2025-01-15'), 'LEAD'), caseType: 'REASON_EQUITY_RELEASE' },
      { ...buildCase('3', 'Other', 800, new Date('2025-01-20'), 'LEAD'), caseType: 'REASON_EQUITY_RELEASE' },
    ];

    render(
      <LenderDashboard
        selectedLender="Halifax"
        stats={lenderStats}
        marketStats={marketStats}
        periodData={periodData}
        period={{ type: 'this_year' }}
      />,
    );

    expect(screen.getByText('Other')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getByText('Equity Release')).toBeInTheDocument();
  });
});
