import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MortgageCase } from '../types/mortgage';
import { buildMonthlyTrends, InternalTrendsTab, trendNetRevenueValue } from '../components/internal/InternalTrendsTab';

function buildCase(
  caseId: string,
  caseType: MortgageCase['caseType'],
  createdAt: string,
  completionDate: string,
  overrides: Partial<MortgageCase> = {},
): MortgageCase {
  return {
    caseId,
    lender: 'Lender A',
    lenderId: 'lender-a',
    prevLender: null,
    caseType,
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt: new Date(createdAt),
    recommendationDate: new Date(createdAt),
    firstSubmittedDate: new Date(createdAt),
    lastSubmittedDate: new Date(createdAt),
    firstOfferDate: new Date(createdAt),
    completionDate: new Date(completionDate),
    mortgageAmount: 250000,
    propertyValue: 300000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1500,
    initialPayRate: 4.5,
    ...overrides,
  };
}

describe('InternalTrendsTab', () => {
  it('prefers net revenue and falls back to total when net is missing', () => {
    const netPreferred = buildCase('case-net', 'REASON_FTB', '2025-01-01', '2025-02-01', {
      totalCaseRevenue: 5000,
      netCaseRevenue: 1200,
    });
    const fallbackToTotal = buildCase('case-fallback', 'REASON_FTB', '2025-02-01', '2025-03-01', {
      totalCaseRevenue: 800,
      netCaseRevenue: null,
    });

    expect(trendNetRevenueValue(netPreferred)).toBe(1200);
    expect(trendNetRevenueValue(fallbackToTotal)).toBe(800);

    const monthly = buildMonthlyTrends([netPreferred, fallbackToTotal]);
    expect(monthly.find((item) => item.key === '2025-01')?.netRevenue).toBe(1200);
    expect(monthly.find((item) => item.key === '2025-02')?.netRevenue).toBe(800);
  });

  it('renders velocity trend direction KPI and keeps net revenue above case mix', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'REASON_FTB', '2025-01-01', '2025-02-01'),
      buildCase('case-2', 'REASON_FTB', '2025-01-08', '2025-02-10'),
      buildCase('case-3', 'REASON_FTB', '2025-01-15', '2025-02-14'),
      buildCase('case-4', 'REASON_BTL', '2025-01-22', '2025-03-05'),
      buildCase('case-5', 'REASON_BTL', '2025-02-01', '2025-03-30'),
      buildCase('case-6', 'REASON_BTL', '2025-02-08', '2025-04-01'),
      buildCase('case-7', 'REASON_BTL', '2025-02-15', '2025-04-05'),
      buildCase('case-8', 'REASON_FTB', '2025-02-22', '2025-04-08'),
    ];

    const { container } = render(<InternalTrendsTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText('VELOCITY TREND DIRECTION')).toBeInTheDocument();
    const netRevenueHeading = screen.getByRole('heading', { name: 'Net revenue trend' });
    const caseMixHeading = screen.getByRole('heading', { name: 'Case mix shift' });
    expect(netRevenueHeading.compareDocumentPosition(caseMixHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const caseMixSection = caseMixHeading.closest('section');
    if (!caseMixSection) {
      throw new Error('Expected Case mix section');
    }
    const firstDistributionLabel = within(caseMixSection).getAllByText(/FTB|BTL/)[0];
    expect(firstDistributionLabel).toHaveTextContent('BTL');
    expect(container).toHaveTextContent('Completion velocity over time');

    const periodVolumeCard = screen.getByText('PERIOD VOLUME').closest('article');
    const avgWeeklyVolumeCard = screen.getByText('AVG WEEKLY VOLUME').closest('article');
    const avgCompletionVelocityCard = screen.getByText('AVG COMPLETION VELOCITY').closest('article');
    if (!periodVolumeCard || !avgWeeklyVolumeCard || !avgCompletionVelocityCard) {
      throw new Error('Expected KPI cards for trends section');
    }
    expect(within(periodVolumeCard).getByText('No data')).toBeInTheDocument();
    expect(within(avgWeeklyVolumeCard).getByText('No data')).toBeInTheDocument();
    expect(within(avgCompletionVelocityCard).getByText('No data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Case creation by month in 2025')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly created case volume chart')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(screen.getByRole('button', { name: 'Created' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Completed' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Completed cases by month in 2025')).toBeInTheDocument();
    expect(screen.getByLabelText('Monthly completed case volume chart')).toBeInTheDocument();
  });

  it('shows only the last four weeks and includes week-on-week change column', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'REASON_FTB', '2025-01-01', '2025-01-15'),
      buildCase('case-2', 'REASON_FTB', '2025-01-08', '2025-01-21'),
      buildCase('case-3', 'REASON_FTB', '2025-01-15', '2025-01-30'),
      buildCase('case-4', 'REASON_FTB', '2025-01-22', '2025-02-07'),
      buildCase('case-5', 'REASON_FTB', '2025-02-01', '2025-02-18'),
      buildCase('case-6', 'REASON_FTB', '2025-02-08', '2025-02-24'),
    ];

    render(<InternalTrendsTab periodData={periodData} period={{ type: 'this_year' }} />);

    const weeklyHeading = screen.getByRole('heading', { name: 'Weekly volume trend' });
    const weeklySection = weeklyHeading.closest('section');
    if (!weeklySection) {
      throw new Error('Expected Weekly volume section');
    }

    expect(within(weeklySection).getByRole('columnheader', { name: /% change vs previous week/i })).toBeInTheDocument();
    const weeklyRows = within(weeklySection).getAllByRole('row');
    expect(weeklyRows.length - 1).toBe(4);
  });

  it('shows previous-period trend badges for non-year periods', () => {
    const previousPeriodRows: MortgageCase[] = [
      buildCase('prev-1', 'REASON_FTB', '2025-04-01', '2025-05-01'),
      buildCase('prev-2', 'REASON_FTB', '2025-04-08', '2025-05-15'),
      buildCase('prev-3', 'REASON_BTL', '2025-05-02', '2025-06-05'),
      buildCase('prev-4', 'REASON_BTL', '2025-05-09', '2025-06-12'),
    ];
    const currentPeriodRows: MortgageCase[] = [
      buildCase('curr-1', 'REASON_FTB', '2025-07-01', '2025-08-01'),
      buildCase('curr-2', 'REASON_FTB', '2025-07-08', '2025-08-15'),
      buildCase('curr-3', 'REASON_BTL', '2025-08-02', '2025-09-05'),
      buildCase('curr-4', 'REASON_BTL', '2025-08-09', '2025-09-12'),
      buildCase('curr-5', 'REASON_BTL', '2025-08-16', '2025-09-20'),
    ];

    render(
      <InternalTrendsTab
        periodData={currentPeriodRows}
        period={{ type: 'this_quarter' }}
        allRows={[...previousPeriodRows, ...currentPeriodRows]}
      />,
    );

    const periodVolumeCard = screen.getByText('PERIOD VOLUME').closest('article');
    const avgWeeklyVolumeCard = screen.getByText('AVG WEEKLY VOLUME').closest('article');
    const avgCompletionVelocityCard = screen.getByText('AVG COMPLETION VELOCITY').closest('article');
    if (!periodVolumeCard || !avgWeeklyVolumeCard || !avgCompletionVelocityCard) {
      throw new Error('Expected KPI cards for trends section');
    }
    expect(within(periodVolumeCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(avgWeeklyVolumeCard).getByText(/vs prev period/i)).toBeInTheDocument();
    expect(within(avgCompletionVelocityCard).getByText(/vs prev period/i)).toBeInTheDocument();
  });

  it('expands grouped other case types in case mix shift', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'REASON_FTB', '2025-01-01', '2025-02-01'),
      buildCase('case-2', 'REASON_EQUITY_RELEASE', '2025-02-01', '2025-03-01'),
      buildCase('case-3', 'REASON_EQUITY_RELEASE', '2025-03-01', '2025-04-01'),
      buildCase('case-4', 'REASON_FTB', '2025-04-01', '2025-05-01'),
    ];

    render(<InternalTrendsTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText('Other')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getByText('Equity Release')).toBeInTheDocument();
  });
});
