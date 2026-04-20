import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MortgageCase } from '../types/mortgage';
import { InternalRiskLtvTab } from '../components/internal/InternalRiskLtvTab';

function buildCase(caseId: string, lender: string, ltv: number, createdAt: string): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase().replaceAll(' ', '-'),
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt: new Date(createdAt),
    recommendationDate: new Date('2025-01-10'),
    firstSubmittedDate: new Date('2025-01-11'),
    lastSubmittedDate: new Date('2025-01-11'),
    firstOfferDate: new Date('2025-01-20'),
    completionDate: new Date('2025-01-31'),
    mortgageAmount: 250000,
    propertyValue: 300000,
    ltv,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1500,
    initialPayRate: 4.5,
  };
}

describe('InternalRiskLtvTab', () => {
  it('shows directional LTV trend text with matching sign and arrow', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'Lender A', 0.7, '2025-01-05'),
      buildCase('case-2', 'Lender A', 0.8, '2025-07-10'),
      buildCase('case-3', 'Blank lender', 0.9, '2025-07-15'),
    ];

    render(<InternalRiskLtvTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText(/↑ \+15\.0% vs prev half/i)).toBeInTheDocument();
    expect(screen.getByText('Risk mix is moving upward.')).toBeInTheDocument();
  });

  it('excludes blank lender rows by default and includes them when toggled', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'Lender A', 0.7, '2025-01-05'),
      buildCase('case-2', 'Lender A', 0.8, '2025-07-10'),
      buildCase('case-4', 'Lender B', 0.92, '2025-07-11'),
      buildCase('case-3', 'Blank lender', 0.9, '2025-07-15'),
    ];

    const { container } = render(<InternalRiskLtvTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByRole('checkbox', { name: /Exclude blank lender/i })).toBeChecked();
    expect(screen.queryByRole('cell', { name: 'Blank lender' })).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /High-LTV share vs market avg/i })).toBeInTheDocument();
    const firstLenderCell = container.querySelector('tbody tr td');
    expect(firstLenderCell).toHaveTextContent('Lender B');

    await user.click(screen.getByRole('checkbox', { name: /Exclude blank lender/i }));
    expect(screen.getByRole('cell', { name: 'Blank lender' })).toBeInTheDocument();
  });

  it('shows no data trend badges on key KPI cards for this year', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'Lender A', 0.72, '2025-01-05'),
      buildCase('case-2', 'Lender B', 0.88, '2025-07-10'),
      buildCase('case-3', 'Lender C', 0.96, '2025-08-10'),
    ];

    render(<InternalRiskLtvTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText('AVERAGE LTV').closest('article')).toHaveTextContent('No data');
    expect(screen.getByText('HIGH-LTV CASES (85%+)').closest('article')).toHaveTextContent('No data');
    expect(screen.getByText('VERY HIGH-LTV CASES (95%+)').closest('article')).toHaveTextContent('No data');
  });

  it('shows previous-period trend badges on key KPI cards for non-year periods', () => {
    const previousPeriodRows: MortgageCase[] = [
      buildCase('prev-1', 'Lender A', 0.65, '2025-09-05'),
      buildCase('prev-2', 'Lender A', 0.7, '2025-09-10'),
    ];
    const periodData: MortgageCase[] = [
      buildCase('curr-1', 'Lender A', 0.85, '2025-12-05'),
      buildCase('curr-2', 'Lender B', 0.95, '2025-12-10'),
    ];

    render(
      <InternalRiskLtvTab
        periodData={periodData}
        period={{ type: 'this_quarter' }}
        allRows={[...previousPeriodRows, ...periodData]}
      />,
    );

    expect(screen.getByText('AVERAGE LTV').closest('article')).toHaveTextContent('vs prev period');
    expect(screen.getByText('HIGH-LTV CASES (85%+)').closest('article')).toHaveTextContent('vs prev period');
    expect(screen.getByText('VERY HIGH-LTV CASES (95%+)').closest('article')).toHaveTextContent('vs prev period');
  });

  it('expands grouped other case types in average LTV distribution', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      { ...buildCase('case-1', 'Lender A', 0.7, '2025-01-05'), caseType: 'REASON_FTB' },
      { ...buildCase('case-2', 'Lender B', 0.82, '2025-01-12'), caseType: 'REASON_EQUITY_RELEASE' },
    ];

    render(<InternalRiskLtvTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText('Other')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getByText('Equity Release')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Group Other' })).toBeInTheDocument();
  });
});
