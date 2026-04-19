import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MortgageCase, ParseQualityReport } from '../../types/mortgage';
import { InternalDataQualityTab } from './InternalDataQualityTab';

function buildCase(
  caseId: string,
  lender: string,
  caseStatus: MortgageCase['caseStatus'],
  overrides: Partial<MortgageCase> = {},
): MortgageCase {
  return {
    caseId,
    lender,
    lenderId: lender.toLowerCase().replaceAll(' ', '-'),
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus,
    notProceedingReason: null,
    createdAt: new Date('2025-01-10'),
    recommendationDate: new Date('2025-01-11'),
    firstSubmittedDate: new Date('2025-01-12'),
    lastSubmittedDate: new Date('2025-01-12'),
    firstOfferDate: new Date('2025-01-20'),
    completionDate: new Date('2025-01-30'),
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

const quality: ParseQualityReport = {
  dateParseFailures: {
    created_at: 3,
    first_submitted_date: 2,
  },
  degradedColumns: [],
  criticalFailure: false,
};

describe('InternalDataQualityTab', () => {
  it('shows blank lender totals and blank lender rows beyond application stage totals', () => {
    const periodData: MortgageCase[] = [
      buildCase('case-1', 'Blank lender', 'APPLICATION_SUBMITTED'),
      buildCase('case-2', 'Blank lender', 'REFERRED'),
      buildCase('case-3', 'Blank lender', 'PRE_APPLICATION'),
      buildCase('case-4', 'Blank lender', 'REVIEW'),
      buildCase('case-5', 'Unknown lender', 'COMPLETE'),
      buildCase('case-6', 'Halifax', 'COMPLETE', { initialRateTypeRaw: 'INVALID_MORTGAGE_CLASS' }),
      buildCase('case-7', 'Halifax', 'NOT_PROCEEDING', { notProceedingReason: 'INVALID_CANCELLATION_REASON' }),
    ];

    render(<InternalDataQualityTab periodData={periodData} quality={quality} period={{ type: 'this_year' }} />);

    expect(screen.getByText('Data Quality')).toBeInTheDocument();
    const blankLenderCard = screen.getByText('ROWS WITH BLANK LENDER').closest('article');
    const blankLenderBeyondApplicationCard = screen.getByText('BLANK LENDER ROWS BEYOND APPLICATION STAGE').closest('article');
    if (!blankLenderCard || !blankLenderBeyondApplicationCard) {
      throw new Error('Expected KPI cards to render');
    }

    expect(blankLenderCard).toHaveTextContent('5');
    expect(blankLenderBeyondApplicationCard).toHaveTextContent('5');
    expect(blankLenderCard).toHaveTextContent('71.4%');
    expect(blankLenderBeyondApplicationCard).toHaveTextContent('71.4%');
    const invalidMortgageClassCard = screen.getByText(/INVALID_MORTGAGE_CLASS/).closest('div');
    expect(invalidMortgageClassCard).toBeTruthy();
    expect(invalidMortgageClassCard).toHaveTextContent('1');
    const invalidCancellationReasonCard = screen.getByText(/INVALID_CANCELLATION_REASON/).closest('div');
    expect(invalidCancellationReasonCard).toBeTruthy();
    expect(invalidCancellationReasonCard).toHaveTextContent('1');
  });
});
