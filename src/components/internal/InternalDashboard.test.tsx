import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { computeLinearTrend } from '../../utils/trendLine';
import { InternalDashboard } from './InternalDashboard';

const stats: MarketStats = {
  totalCases: 12,
  totalLoanValue: 2_400_000,
  completedCases: 4,
  avgCompletionDays: 24,
  avgLtv: 0.78,
  protectionAttachRate: 0.2,
  avgDaysToOffer: 11,
  avgDaysToComplete: 24,
  resubmissionRate: 0.08,
  stalledSubmittedRate: 0.1,
  pipeline: [
    { status: 'LEAD', count: 12, percentage: 1 },
    { status: 'RECOMMENDATION', count: 10, percentage: 0.83 },
    { status: 'APPLICATION', count: 8, percentage: 0.67 },
    { status: 'OFFER', count: 6, percentage: 0.5 },
    { status: 'COMPLETION', count: 4, percentage: 0.33 },
    { status: 'NOT_PROCEEDING', count: 2, percentage: 0.17 },
  ],
  excludedSystemStateCount: 0,
  monthlyVolume: [
    { key: '2025-01', month: '01', count: 36_000 },
    { key: '2025-02', month: '02', count: 25_000 },
  ],
  dailyVolume: [
    { key: '2025-12-01', day: '01', count: 500 },
    { key: '2025-12-02', day: '02', count: 800 },
  ],
  caseMix: [{ label: 'First-time buyer', count: 12, percentage: 1 }],
  marketShare: [{ lender: 'Halifax', count: 4, percentage: 1 }],
  ltvDistribution: [{ label: '75-85%', count: 12, percentage: 1 }],
  mortgageAmountDistribution: [{ label: '£200-350k', count: 12, percentage: 1 }],
};

const row: MortgageCase = {
  caseId: 'case-1',
  lender: 'Halifax',
  lenderId: 'hfx',
  prevLender: null,
  caseType: 'REASON_FTB',
  caseStatus: 'APPLICATION_SUBMITTED',
  notProceedingReason: null,
  createdAt: new Date('2025-12-02'),
  recommendationDate: null,
  firstSubmittedDate: new Date('2025-12-03'),
  lastSubmittedDate: new Date('2025-12-04'),
  firstOfferDate: null,
  completionDate: null,
  mortgageAmount: 250000,
  propertyValue: 300000,
  ltv: 0.83,
  linkedProtection: false,
  totalBrokerFees: 500,
  grossMortgageProcFee: 1000,
  totalCaseRevenue: 1500,
  initialPayRate: 4.5,
};

const completedRow: MortgageCase = {
  ...row,
  caseId: 'case-2',
  caseStatus: 'COMPLETE',
  createdAt: new Date('2025-11-20'),
  completionDate: new Date('2025-12-20'),
};

const notProceedingRow: MortgageCase = {
  ...row,
  caseId: 'case-3',
  caseStatus: 'NOT_PROCEEDING',
  notProceedingReason: 'NO_RESPONSE',
};

const notProceedingRowHighMortgageLowRevenue: MortgageCase = {
  ...row,
  caseId: 'case-4',
  caseStatus: 'NOT_PROCEEDING',
  notProceedingReason: 'NO_RESPONSE',
  mortgageAmount: 500000000,
  totalCaseRevenue: 1200,
};

const notProceedingRowVeryHighMortgageLowRevenue: MortgageCase = {
  ...row,
  caseId: 'case-5',
  caseStatus: 'NOT_PROCEEDING',
  notProceedingReason: 'NO_RESPONSE',
  mortgageAmount: 750000000,
  totalCaseRevenue: 800,
};

const stalledApplicationRow: MortgageCase = {
  ...row,
  caseId: 'case-stalled',
  caseStatus: 'APPLICATION_SUBMITTED',
  firstSubmittedDate: new Date('2025-07-01'),
  lastSubmittedDate: new Date('2025-07-01'),
  totalCaseRevenue: 2500,
};

const recentApplicationRow: MortgageCase = {
  ...row,
  caseId: 'case-recent',
  caseStatus: 'APPLICATION_SUBMITTED',
  firstSubmittedDate: new Date('2025-12-28'),
  lastSubmittedDate: new Date('2025-12-28'),
  totalCaseRevenue: 500,
};

const groupedDropOffReasonRow: MortgageCase = {
  ...row,
  caseId: 'case-grouped-reason',
  caseStatus: 'NOT_PROCEEDING',
  notProceedingReason: 'FEE_CONCERNS',
  totalCaseRevenue: 700,
};

function getKpiCard(label: string): HTMLElement {
  const card = screen.getByText(label).closest('article');
  if (!card) {
    throw new Error(`Expected KPI card for ${label}`);
  }
  return card;
}

describe('InternalDashboard', () => {
  it('renders volume cards before the pipeline funnel', () => {
    const { container } = render(
      <InternalDashboard stats={stats} period={{ type: 'this_year' }} periodData={[row, completedRow]} allRows={[row, completedRow]} />,
    );

    expect(screen.getByText('Monthly volume')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pipeline funnel' })).toBeInTheDocument();

    const monthlyHeading = screen.getByText('Monthly volume');
    const funnelHeading = screen.getByRole('heading', { name: 'Pipeline funnel' });
    expect(
      monthlyHeading.compareDocumentPosition(funnelHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Case creation by month in 2025')).toBeInTheDocument();
    expect(container).toHaveTextContent('Peak:');
    expect(screen.getByText(/Cohort: cases created in/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Completed cases by month in 2025')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly completed case volume chart')).toBeInTheDocument();
  });

  it('switches monthly volume card into daily mode for this month', () => {
    render(<InternalDashboard stats={stats} period={{ type: 'this_month' }} periodData={[row]} allRows={[row]} />);

    expect(screen.getByText('Daily volume')).toBeInTheDocument();
    expect(screen.getByText('Case creation by day in selected period')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Created' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completed' })).not.toBeInTheDocument();
  });

  it('shows percentage and count labels across overview distributions', () => {
    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[row, completedRow]}
        allRows={[row, completedRow]}
      />,
    );

    expect(screen.getAllByText('100.0% | (2)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Halifax: 100% | (1)')).toBeInTheDocument();
  });

  it('shows completion rate beneath completed cases KPI value', () => {
    render(<InternalDashboard stats={stats} period={{ type: 'this_year' }} periodData={[row, completedRow]} allRows={[row, completedRow]} />);

    expect(screen.getByText('Completion rate: 33%')).toBeInTheDocument();
  });

  it('shows avg days to offer beneath avg completion days KPI value', () => {
    render(<InternalDashboard stats={stats} period={{ type: 'this_year' }} periodData={[row, completedRow]} allRows={[row, completedRow]} />);

    expect(screen.getByText('Avg days to offer: 11')).toBeInTheDocument();
  });

  it('shows no-data previous-period trends on all overview KPI cards for this year', () => {
    render(<InternalDashboard stats={stats} period={{ type: 'this_year' }} periodData={[row, completedRow]} allRows={[row, completedRow]} />);

    const totalCasesCard = getKpiCard('TOTAL CASES');
    const totalCompletedLoanValueCard = getKpiCard('TOTAL COMPLETED LOAN VALUE');
    const completedCasesCard = getKpiCard('COMPLETED CASES');
    const totalRevenueCard = getKpiCard('TOTAL REVENUE');
    const avgRevenueCard = getKpiCard('AVG NET REVENUE PER COMPLETED CASE');
    const avgCompletionDaysCard = getKpiCard('AVG COMPLETION DAYS');

    expect(within(totalCasesCard).getByText('No data')).toBeInTheDocument();
    expect(within(totalCompletedLoanValueCard).getByText('No data')).toBeInTheDocument();
    expect(within(completedCasesCard).getByText('No data')).toBeInTheDocument();
    expect(within(totalRevenueCard).getByText('No data')).toBeInTheDocument();
    expect(within(avgRevenueCard).getByText('No data')).toBeInTheDocument();
    expect(within(avgCompletionDaysCard).getByText('No data')).toBeInTheDocument();
    expect(screen.queryByText('-2 days vs prev period')).not.toBeInTheDocument();
    expect(screen.queryByText('Representative data')).not.toBeInTheDocument();
  });

  it('shows previous-period trend badges on all overview KPI cards for non-year periods', () => {
    const previousMonthRow: MortgageCase = {
      ...completedRow,
      caseId: 'case-6',
      createdAt: new Date('2025-11-10'),
      firstSubmittedDate: new Date('2025-11-10'),
      completionDate: new Date('2025-11-22'),
    };

    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_month' }}
        periodData={[row, completedRow]}
        allRows={[previousMonthRow, row, completedRow]}
      />,
    );

    const totalCasesCard = getKpiCard('TOTAL CASES');
    const totalCompletedLoanValueCard = getKpiCard('TOTAL COMPLETED LOAN VALUE');
    const completedCasesCard = getKpiCard('COMPLETED CASES');
    const totalRevenueCard = getKpiCard('TOTAL REVENUE');
    const avgRevenueCard = getKpiCard('AVG NET REVENUE PER COMPLETED CASE');
    const avgCompletionDaysCard = getKpiCard('AVG COMPLETION DAYS');

    expect(within(totalCasesCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(totalCompletedLoanValueCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(completedCasesCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(totalRevenueCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(avgRevenueCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(avgCompletionDaysCard).getByText(/vs prev period/i)).toBeInTheDocument();
  });

  it('renders title-cased drop-off reasons with follow-up recommendations', () => {
    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[row, completedRow, notProceedingRow]}
        allRows={[row, completedRow, notProceedingRow]}
      />,
    );

    expect(screen.getByText('Drop-off reasons')).toBeInTheDocument();
    expect(screen.getByText('No Response')).toBeInTheDocument();
    expect(screen.getByText(/Attempt multi-channel re-contact and time-box closure if no reply\./)).toBeInTheDocument();
  });

  it('uses broker revenue totals for drop-off revenue at risk', () => {
    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[
          row,
          completedRow,
          notProceedingRowHighMortgageLowRevenue,
          notProceedingRowVeryHighMortgageLowRevenue,
        ]}
        allRows={[
          row,
          completedRow,
          notProceedingRowHighMortgageLowRevenue,
          notProceedingRowVeryHighMortgageLowRevenue,
        ]}
      />,
    );

    expect(screen.getByText('Revenue at risk')).toBeInTheDocument();
    expect(screen.getByText('100.0% | £2,000 revenue at risk')).toBeInTheDocument();
    expect(screen.queryByText(/b at risk/i)).not.toBeInTheDocument();
  });

  it('groups selected drop-off reasons into Other and supports expanding', () => {
    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[row, completedRow, notProceedingRow, groupedDropOffReasonRow]}
        allRows={[row, completedRow, notProceedingRow, groupedDropOffReasonRow]}
      />,
    );

    expect(screen.getByText('Other')).toBeInTheDocument();
    const dropOffSection = screen.getByRole('heading', { name: 'Drop-off reasons' }).closest('section');
    if (!dropOffSection) {
      throw new Error('Expected drop-off section');
    }
    expect(within(dropOffSection).getByRole('button', { name: 'Expand Other' })).toBeInTheDocument();
    expect(screen.queryByText('Fee Concerns')).not.toBeInTheDocument();

    fireEvent.click(within(dropOffSection).getByRole('button', { name: 'Expand Other' }));

    expect(within(dropOffSection).getByRole('button', { name: 'Group Other' })).toBeInTheDocument();
    expect(screen.getByText('Fee Concerns')).toBeInTheDocument();
    expect(screen.getByText('Share a transparent cost breakdown and discuss lower-fee structures or payment options.')).toBeInTheDocument();
  });

  it('shows a platform-level stalled revenue-at-risk headline banner', () => {
    const { container } = render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[stalledApplicationRow, recentApplicationRow, completedRow]}
        allRows={[stalledApplicationRow, recentApplicationRow, completedRow]}
      />,
    );

    expect(screen.getByText('£2,500 of revenue is at risk from 1 stalled submitted case')).toBeInTheDocument();
    const banner = screen.getByText('£2,500 of revenue is at risk from 1 stalled submitted case');
    const dropOffHeading = screen.getByRole('heading', { name: 'Drop-off reasons' });
    expect(banner.compareDocumentPosition(dropOffHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container).toHaveTextContent('Top not proceeding reasons with recommended follow-up actions');
  });

  it('computes linear trend values across volume points', () => {
    const trend = computeLinearTrend([10, 20, 30]);

    expect(trend).toHaveLength(3);
    expect(trend.map((point) => Math.round(point))).toEqual([10, 20, 30]);
  });

  it('expands grouped other case types in cases-by-type distribution', () => {
    const equityReleaseCase: MortgageCase = {
      ...row,
      caseId: 'equity-release',
      caseType: 'REASON_EQUITY_RELEASE',
    };

    render(
      <InternalDashboard
        stats={stats}
        period={{ type: 'this_year' }}
        periodData={[row, equityReleaseCase]}
        allRows={[row, equityReleaseCase]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Expand Other' })).toBeInTheDocument();
    expect(screen.getByText('Other')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getByRole('button', { name: 'Group Other' })).toBeInTheDocument();
    expect(screen.getByText('Equity Release')).toBeInTheDocument();
  });
});
