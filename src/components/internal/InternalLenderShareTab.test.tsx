import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MortgageCase } from '../../types/mortgage';
import { buildTopLenderMix, InternalLenderShareTab, renderCaseMixLegendLabel } from './InternalLenderShareTab';

function buildCase(
  caseId: string,
  lender: string,
  ltv: number,
  overrides: Partial<Pick<MortgageCase, 'caseStatus' | 'mortgageAmount' | 'prevLender' | 'totalCaseRevenue' | 'caseType'>> = {},
): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase(),
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'COMPLETE',
    notProceedingReason: null,
    createdAt: new Date('2025-01-10'),
    recommendationDate: new Date('2025-01-11'),
    firstSubmittedDate: new Date('2025-01-12'),
    lastSubmittedDate: new Date('2025-01-12'),
    firstOfferDate: new Date('2025-01-20'),
    completionDate: new Date('2025-02-02'),
    mortgageAmount: 250000,
    propertyValue: 300000,
    ltv,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1000,
    totalCaseRevenue: 1500,
    initialPayRate: 4.5,
    ...overrides,
  };
}

function firstLenderCell(container: HTMLElement): string {
  const firstCell = container.querySelector('tbody tr td');
  if (!firstCell) {
    throw new Error('Expected at least one lender row');
  }
  return firstCell.textContent ?? '';
}

describe('InternalLenderShareTab', () => {
  it('defaults to total loan value sorting and toggles from the new header', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('case-b-1', 'Lender B', 0.9, { mortgageAmount: 100000 }),
      buildCase('case-b-2', 'Lender B', 0.9, { caseStatus: 'APPLICATION_SUBMITTED', mortgageAmount: 900000 }),
      buildCase('case-a-1', 'Lender A', 0.7, { mortgageAmount: 200000 }),
      buildCase('case-c-1', 'Lender C', 0.8, { mortgageAmount: 300000 }),
    ];
    const { container } = render(<InternalLenderShareTab periodData={periodData} period={{ type: 'this_year' }} />);

    const headerTexts = Array.from(container.querySelectorAll('thead th')).map((header) => header.textContent ?? '');
    expect(headerTexts).toEqual([
      'Lender↕',
      'Cases↕',
      'Total Completed Loan Value↓',
      'Share↕',
      'Completion rate↕',
      'Avg broker revenue↕',
      'High-LTV share (85%+)↕',
    ]);
    expect(firstLenderCell(container)).toContain('Lender C');

    const totalLoanSortButton = screen.getByRole('button', { name: /Total Completed Loan Value/i });
    await user.click(totalLoanSortButton);
    expect(firstLenderCell(container)).toContain('Lender B');
    await user.click(totalLoanSortButton);
    expect(firstLenderCell(container)).toContain('Lender C');
  });

  it('sorts by lender and high-LTV share headers', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('case-b', 'Lender B', 0.9),
      buildCase('case-b-2', 'Lender B', 0.7),
      buildCase('case-a', 'Lender A', 0.7),
      buildCase('case-c', 'Lender C', 0.95),
    ];
    const { container } = render(<InternalLenderShareTab periodData={periodData} period={{ type: 'this_year' }} />);

    const lenderSortButton = (Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Lender')) ??
      null) as HTMLButtonElement | null;
    if (!lenderSortButton) {
      throw new Error('Expected lender sort button');
    }
    await user.click(lenderSortButton);
    expect(firstLenderCell(container)).toContain('Lender C');
    await user.click(lenderSortButton);
    expect(firstLenderCell(container)).toContain('Lender A');

    const highLtvSortButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('High-LTV share (85%+)'),
    ) as HTMLButtonElement | undefined;
    if (!highLtvSortButton) {
      throw new Error('Expected high LTV sort button');
    }
    await user.click(highLtvSortButton);
    expect(firstLenderCell(container)).toContain('Lender C');
  });

  it('renders avg revenue per lender KPI from total revenue over lender count', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-a-1', 'Lender A', 0.8, { totalCaseRevenue: 3000 }),
      buildCase('case-a-2', 'Lender A', 0.8, { totalCaseRevenue: 1500 }),
      buildCase('case-b-1', 'Lender B', 0.8, { totalCaseRevenue: 1500 }),
    ];

    render(<InternalLenderShareTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getByText(/Avg revenue per lender/i)).toBeInTheDocument();
    expect(screen.getByText('£3,000')).toBeInTheDocument();
  });

  it('applies a 100-case minimum volume threshold to best completion rate', () => {
    const highRateLowVolume = Array.from({ length: 10 }, (_, index) =>
      buildCase(`small-${index}`, 'Small Lender', 0.8, { caseStatus: 'COMPLETE' }),
    );
    const qualifiedLender = Array.from({ length: 100 }, (_, index) =>
      buildCase(`eligible-${index}`, 'Eligible Lender', 0.8, {
        caseStatus: index < 89 ? 'COMPLETE' : 'APPLICATION_SUBMITTED',
      }),
    );
    const periodData = [...highRateLowVolume, ...qualifiedLender];

    const { container } = render(<InternalLenderShareTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.getAllByText('Eligible Lender').length).toBeGreaterThan(0);
    expect(screen.getByText('89% (100+ cases)')).toBeInTheDocument();
    const bestCompletionCard = Array.from(container.querySelectorAll('article')).find((card) =>
      card.textContent?.includes('BEST COMPLETION RATE'),
    );
    expect(bestCompletionCard).toBeTruthy();
    expect(bestCompletionCard?.textContent).not.toContain('Small Lender');
  });

  it('shows switching transitions with route and count only', () => {
    const periodData: MortgageCase[] = [
      buildCase('switch-1', 'Lender A', 0.8, { prevLender: 'Halifax' }),
      buildCase('switch-2', 'Lender A', 0.8, { prevLender: 'Halifax' }),
      buildCase('switch-3', 'Lender B', 0.8, { prevLender: 'Halifax' }),
      buildCase('switch-4', 'Lender C', 0.8, { prevLender: 'NatWest' }),
    ];

    render(<InternalLenderShareTab periodData={periodData} period={{ type: 'this_year' }} />);

    expect(screen.queryByText('Share of Halifax outflows')).not.toBeInTheDocument();
    const switchingSectionHeading = screen.getByRole('heading', { name: 'Switching patterns' });
    const switchingSection = switchingSectionHeading.closest('section');
    if (!switchingSection) {
      throw new Error('Expected switching patterns section');
    }
    expect(within(switchingSection).getByText('Halifax -> Lender A')).toBeInTheDocument();
    expect(within(switchingSection).getByText('Halifax -> Lender B')).toBeInTheDocument();
    expect(within(switchingSection).getByText('NatWest -> Lender C')).toBeInTheDocument();
    expect(within(switchingSection).getByText('2')).toBeInTheDocument();
    expect(within(switchingSection).getAllByText('1').length).toBeGreaterThan(0);
  });

  it('groups non-core case types into Other and shows the inclusion tooltip', async () => {
    const user = userEvent.setup();
    const periodData: MortgageCase[] = [
      buildCase('mix-1', 'Lender A', 0.8, { caseType: 'REASON_FTB' }),
      buildCase('mix-2', 'Lender A', 0.8, { caseType: 'REASON_BRIDGING' }),
      buildCase('mix-3', 'Lender A', 0.8, { caseType: 'REASON_EQUITY_RELEASE' }),
    ];

    const mixRows = buildTopLenderMix(periodData, true);
    expect(mixRows).toHaveLength(1);
    expect(mixRows[0].lender).toBe('Lender A');
    expect(mixRows[0]['First-time buyer']).toBeCloseTo(33.333, 2);
    expect(mixRows[0].Other).toBeCloseTo(66.666, 2);

    render(<>{renderCaseMixLegendLabel('Other')}</>);
    const otherLegendLabel = screen.getByText('Other');
    await user.hover(otherLegendLabel);
    expect(await screen.findByText(/Includes Buy-to-let Remortgage/i)).toBeInTheDocument();
  });
});
