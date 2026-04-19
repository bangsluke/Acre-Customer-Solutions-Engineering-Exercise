import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { formatCurrency, formatDays } from '../../utils/formatters';
import { computeStalledSubmittedInsights } from '../../utils/lenderInsights';
import { LenderInsightsTab } from './LenderInsightsTab';

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
  submittedDate: string,
  mortgageAmount: number,
  revenueAtRisk: number,
  overrides: Partial<MortgageCase> = {},
): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase(),
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
    ltv: 0.82,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: revenueAtRisk,
    initialPayRate: 4.5,
    ...overrides,
  };
}

function firstRevenueRiskCaseId(container: HTMLElement): string {
  const tableSection = container.querySelector('#revenue-at-risk');
  const firstCell = tableSection?.querySelector('tbody tr td');
  if (!firstCell) {
    throw new Error('Expected revenue risk row');
  }
  return firstCell.textContent ?? '';
}

describe('LenderInsightsTab', () => {
  it('shows market ranking as a top-percent value and renders what-if modelling', () => {
    const periodData: MortgageCase[] = [
      buildCase('lender-a-1', 'Lender A', '2025-01-01', 200000, 500),
      {
        ...buildCase('lender-a-2', 'Lender A', '2025-01-02', 200000, 600),
        firstOfferDate: new Date('2025-01-18'),
      },
      {
        ...buildCase('lender-a-3', 'Lender A', '2025-01-03', 200000, 700),
        firstOfferDate: new Date('2025-01-20'),
      },
      {
        ...buildCase('lender-a-4', 'Lender A', '2025-01-04', 200000, 800),
        firstOfferDate: new Date('2025-01-22'),
      },
      {
        ...buildCase('lender-a-5', 'Lender A', '2025-01-05', 200000, 900),
        firstOfferDate: new Date('2025-01-24'),
      },
      {
        ...buildCase('lender-b-1', 'Lender B', '2025-01-01', 200000, 300),
        firstOfferDate: new Date('2025-01-10'),
      },
      {
        ...buildCase('lender-b-2', 'Lender B', '2025-01-02', 200000, 300),
        firstOfferDate: new Date('2025-01-11'),
      },
      {
        ...buildCase('lender-b-3', 'Lender B', '2025-01-03', 200000, 300),
        firstOfferDate: new Date('2025-01-12'),
      },
      {
        ...buildCase('lender-b-4', 'Lender B', '2025-01-04', 200000, 300),
        firstOfferDate: new Date('2025-01-13'),
      },
      {
        ...buildCase('lender-b-5', 'Lender B', '2025-01-05', 200000, 300),
        firstOfferDate: new Date('2025-01-14'),
      },
    ];

    render(
      <LenderInsightsTab
        periodData={periodData}
        allRows={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_quarter' }}
      />,
    );

    expect(screen.getByText(/Top 100% of platform lenders by conversion speed/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Lender A is currently 8d slower than market\. Slide left to model improvement; slide right to test slower scenarios\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'LTV opportunity gaps' })).toBeInTheDocument();
    const slider = screen.getByRole('slider', { name: /Target submission-to-offer days/i });
    expect((slider as HTMLInputElement).value).toBe('18');
    fireEvent.change(slider, { target: { value: Number((slider as HTMLInputElement).value) - 1 } });
    expect(screen.getByText(/Modeled incremental revenue this quarter:/i)).toBeInTheDocument();
  });

  it('sorts revenue-at-risk table by revenue column', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('low001', 'Lender A', '2025-10-01', 220000, 100),
      buildCase('high001', 'Lender A', '2025-08-01', 240000, 900),
      buildCase('market-1', 'Other Lender', '2025-12-31', 180000, 200),
      buildCase('market-2', 'Other Lender', '2025-12-30', 170000, 200),
      buildCase('market-3', 'Other Lender', '2025-12-29', 160000, 200),
    ];

    const { container } = render(
      <LenderInsightsTab
        periodData={periodData}
        allRows={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    const revenueSortButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Revenue at risk'),
    ) as HTMLButtonElement | undefined;
    if (!revenueSortButton) {
      throw new Error('Expected revenue-at-risk sort button');
    }

    await user.click(revenueSortButton);
    expect(firstRevenueRiskCaseId(container)).toContain('high001');
    await user.click(revenueSortButton);
    expect(firstRevenueRiskCaseId(container)).toContain('low001');
  });

  it('shows stalled KPIs from full set and toggles Show more rows', async () => {
    const user = userEvent.setup();
    const lenderCases = Array.from({ length: 12 }, (_, index) =>
      buildCase(`lender-${String(index + 1).padStart(2, '0')}`, 'Lender A', '2025-09-01', 200000 + index * 1000, 300 + index * 10),
    );
    const marketCases = Array.from({ length: 30 }, (_, index) =>
      buildCase(`market-recent-${index + 1}`, 'Other Lender', `2025-12-${String(30 - (index % 10)).padStart(2, '0')}`, 180000, 100),
    );
    const periodData: MortgageCase[] = [...lenderCases, ...marketCases];

    const { container, getByRole } = render(
      <LenderInsightsTab
        periodData={periodData}
        allRows={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    const revenueSection = container.querySelector('#revenue-at-risk');
    if (!revenueSection) {
      throw new Error('Expected revenue-at-risk section');
    }

    expect(revenueSection.textContent).toContain('12');
    expect(revenueSection.querySelectorAll('tbody tr')).toHaveLength(10);

    await user.click(getByRole('button', { name: 'Show more' }));
    expect(revenueSection.querySelectorAll('tbody tr')).toHaveLength(12);

    await user.click(getByRole('button', { name: 'Show less' }));
    expect(revenueSection.querySelectorAll('tbody tr')).toHaveLength(10);
  });

  it('keeps stalled banner and KPI metrics aligned', () => {
    const periodData: MortgageCase[] = [
      buildCase('lender-1', 'Lender A', '2025-08-01', 400000, 1000),
      buildCase('lender-2', 'Lender A', '2025-08-15', 350000, 900),
      buildCase('lender-3', 'Lender A', '2025-12-30', 300000, 800),
      buildCase('market-1', 'Other Lender', '2025-12-31', 180000, 200),
      buildCase('market-2', 'Other Lender', '2025-12-30', 170000, 200),
      buildCase('market-3', 'Other Lender', '2025-12-29', 160000, 200),
    ];
    const stalledInsights = computeStalledSubmittedInsights(periodData, 'Lender A');

    const { container } = render(
      <LenderInsightsTab
        periodData={periodData}
        allRows={periodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    const revenueSection = container.querySelector('#revenue-at-risk');
    if (!revenueSection) {
      throw new Error('Expected revenue-at-risk section');
    }

    const expectedRecommendation = `You have ${stalledInsights.stalledCount} cases stalled in Submitted for an average of ${Math.round(
      stalledInsights.avgDaysStalled,
    )} days - £${Math.round(stalledInsights.mortgageValueAtRisk).toLocaleString('en-GB')} in mortgage value at risk.`;
    expect(screen.getByText(expectedRecommendation)).toBeInTheDocument();
    expect(revenueSection.textContent).toContain(stalledInsights.stalledCount.toLocaleString('en-GB'));
    expect(revenueSection.textContent).toContain(formatCurrency(stalledInsights.mortgageValueAtRisk));
    expect(revenueSection.textContent).toContain(formatDays(stalledInsights.avgDaysStalled));
  });

  it('shows high further advances badge when further advance share is at least 20%', () => {
    const highFurtherAdvancePeriodData: MortgageCase[] = [
      buildCase('high-fa-1', 'Lender A', '2025-10-01', 220000, 100, { furtherAdvance: true }),
      buildCase('high-fa-2', 'Lender A', '2025-09-01', 240000, 120),
      buildCase('high-fa-3', 'Lender A', '2025-08-01', 260000, 140),
      buildCase('high-fa-4', 'Lender A', '2025-07-01', 280000, 160),
      buildCase('high-fa-5', 'Lender A', '2025-06-01', 300000, 180),
      buildCase('high-fa-market-1', 'Other Lender', '2025-10-01', 180000, 90),
    ];
    const lowFurtherAdvancePeriodData: MortgageCase[] = [
      buildCase('low-fa-1', 'Lender A', '2025-10-01', 220000, 100),
      buildCase('low-fa-2', 'Lender A', '2025-09-01', 240000, 120),
      buildCase('low-fa-3', 'Lender A', '2025-08-01', 260000, 140),
      buildCase('low-fa-4', 'Lender A', '2025-07-01', 280000, 160),
      buildCase('low-fa-5', 'Lender A', '2025-06-01', 300000, 180),
      buildCase('low-fa-market-1', 'Other Lender', '2025-10-01', 180000, 90),
    ];

    const { rerender } = render(
      <LenderInsightsTab
        periodData={highFurtherAdvancePeriodData}
        allRows={highFurtherAdvancePeriodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    expect(screen.getByText('High further advances')).toBeInTheDocument();

    rerender(
      <LenderInsightsTab
        periodData={lowFurtherAdvancePeriodData}
        allRows={lowFurtherAdvancePeriodData}
        selectedLender="Lender A"
        marketStats={marketStats}
        period={{ type: 'this_year' }}
      />,
    );

    expect(screen.queryByText('High further advances')).not.toBeInTheDocument();
  });
});
