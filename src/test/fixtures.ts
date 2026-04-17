import type { MortgageCase } from '../types/mortgage';

function row(overrides: Partial<MortgageCase>): MortgageCase {
  return {
    caseId: String(Math.random()),
    lender: 'Halifax',
    lenderId: '1',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'LEAD',
    notProceedingReason: null,
    createdAt: new Date('2025-01-15T00:00:00.000Z'),
    firstSubmittedDate: null,
    lastSubmittedDate: null,
    firstOfferDate: null,
    completionDate: null,
    mortgageAmount: 200_000,
    propertyValue: 250_000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 1_000,
    totalCaseRevenue: 1_500,
    initialPayRate: 0.0454,
    ...overrides,
  };
}

export const fixtureRows: MortgageCase[] = [
  row({
    caseId: 'a',
    caseStatus: 'COMPLETE',
    lender: 'Halifax',
    firstSubmittedDate: new Date('2025-01-01'),
    lastSubmittedDate: new Date('2025-01-01'),
    firstOfferDate: new Date('2025-01-10'),
    completionDate: new Date('2025-01-20'),
    linkedProtection: true,
  }),
  row({
    caseId: 'b',
    lender: 'Halifax',
    caseStatus: 'APPLICATION_SUBMITTED',
    firstSubmittedDate: new Date('2025-02-01'),
    lastSubmittedDate: new Date('2025-02-15'),
    firstOfferDate: null,
    completionDate: null,
  }),
  row({
    caseId: 'c',
    lender: 'Nationwide',
    caseStatus: 'NOT_PROCEEDING',
    createdAt: new Date('2025-02-03'),
    firstSubmittedDate: new Date('2025-01-03'),
    lastSubmittedDate: new Date('2025-01-05'),
    firstOfferDate: new Date('2025-01-18'),
    completionDate: null,
    ltv: 1.7,
  }),
];

