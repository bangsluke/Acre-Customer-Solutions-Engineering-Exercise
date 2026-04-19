import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MortgageCase } from '../../types/mortgage';
import { InternalProductAnalysisTab } from './InternalProductAnalysisTab';

function buildCase(overrides: Partial<MortgageCase>): MortgageCase {
  return {
    caseId: 'case-id',
    lender: 'Halifax',
    lenderId: 'halifax',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt: new Date('2025-01-10'),
    firstSubmittedDate: new Date('2025-01-11'),
    lastSubmittedDate: new Date('2025-01-12'),
    firstOfferDate: new Date('2025-01-20'),
    completionDate: new Date('2025-01-30'),
    mortgageAmount: 200000,
    propertyValue: 250000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1400,
    netCaseRevenue: 1200,
    initialPayRate: 0.045,
    initialRateType: 'fixed',
    term: 360,
    termUnit: 'TERM_MONTHS',
    regulated: true,
    consumerBtl: false,
    furtherAdvance: false,
    pt: false,
    porting: false,
    clubName: 'Right Mortgage Network',
    ...overrides,
  };
}

describe('InternalProductAnalysisTab', () => {
  it('renders requested product analysis sections and columns', () => {
    const periodData: MortgageCase[] = [
      buildCase({ caseId: '1', caseType: 'REASON_FTB', initialRateType: 'fixed', regulated: true, pt: true, linkedProtection: true }),
      buildCase({
        caseId: '2',
        caseType: 'REASON_REMORTGAGE',
        caseStatus: 'NOT_PROCEEDING',
        netCaseRevenue: 800,
        initialRateType: 'tracker',
        regulated: false,
        consumerBtl: true,
        clubName: 'Primis',
      }),
      buildCase({
        caseId: '3',
        caseType: 'REASON_FTB',
        caseStatus: 'COMPLETE',
        linkedProtection: true,
        netCaseRevenue: 2000,
        initialRateType: 'stepped',
        furtherAdvance: true,
        porting: true,
        clubName: '',
      }),
    ];

    render(<InternalProductAnalysisTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByRole('heading', { name: 'Product Analysis' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Case type performance' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By club / network' })).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'Case type' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Completion rate' })).toHaveLength(2);
    expect(screen.getByRole('columnheader', { name: 'Not-proceeding rate' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Avg net revenue by case type' })).toBeInTheDocument();

    expect(screen.getByText('REGULATED CASES')).toBeInTheDocument();
    expect(screen.getByText('67% of total')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED CASES WITH LINKED PROTECTION')).toBeInTheDocument();
    expect(screen.getByText('100% of completed')).toBeInTheDocument();
    expect(screen.getByText('HIGHEST AVG NET REVENUE CASE TYPE')).toBeInTheDocument();
    expect(screen.getByText('Remortgage')).toBeInTheDocument();
    expect(screen.getByText('Excludes Other case type.')).toBeInTheDocument();
    expect(screen.getByText('Product transfer')).toBeInTheDocument();
    expect(screen.getByText('Consumer BTL')).toBeInTheDocument();
    expect(screen.getByText('Further advance')).toBeInTheDocument();
    expect(screen.getByText('Porting')).toBeInTheDocument();

    expect(screen.getByRole('columnheader', { name: 'Club name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cases' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total loan value' })).toBeInTheDocument();
    expect(screen.getByLabelText('Exclude blank club')).toBeChecked();
    expect(screen.getByText(/blank club cases/i)).toBeInTheDocument();
    expect(screen.getByText('Stepped')).toBeInTheDocument();
    expect(screen.getByText(/Stepped: 33\.3% \| \(1\)/)).toBeInTheDocument();
  });

  it('sorts case type performance by avg net revenue descending by default', () => {
    const periodData: MortgageCase[] = [
      buildCase({ caseId: '1', caseType: 'REASON_FTB', netCaseRevenue: 600 }),
      buildCase({ caseId: '2', caseType: 'REASON_REMORTGAGE', netCaseRevenue: 1800 }),
      buildCase({ caseId: '3', caseType: 'REASON_BTL', netCaseRevenue: 1200 }),
    ];

    render(<InternalProductAnalysisTab periodData={periodData} period={{ type: 'this_year' }} />);

    const caseTypeTable = screen.getByRole('columnheader', { name: 'Avg net revenue by case type' }).closest('table');
    if (!caseTypeTable) {
      throw new Error('Case type table not found');
    }
    const rows = within(caseTypeTable).getAllByRole('row');
    expect(within(rows[1]).getByText('Remortgage')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Buy-to-let')).toBeInTheDocument();
    expect(within(rows[3]).getByText('First-time buyer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Avg net revenue by case type' }));
    const ascendingRows = within(caseTypeTable).getAllByRole('row');
    expect(within(ascendingRows[1]).getByText('First-time buyer')).toBeInTheDocument();
  });

  it('expands grouped other case types in case type performance table', () => {
    const periodData: MortgageCase[] = [
      buildCase({ caseId: '1', caseType: 'REASON_FTB', netCaseRevenue: 800 }),
      buildCase({ caseId: '2', caseType: 'REASON_EQUITY_RELEASE', netCaseRevenue: 1300 }),
    ];

    render(<InternalProductAnalysisTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText('Other')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Other' }));
    expect(screen.getAllByText('Equity Release').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Group Other' })).toBeInTheDocument();
  });
});
