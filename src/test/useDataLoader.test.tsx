import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDataLoader } from '../hooks/useDataLoader';

vi.mock('../utils/csvParser', () => ({
  parseMortgageCsv: async () => ({
    rows: [
      {
        caseId: '1',
        lender: 'Halifax',
        lenderId: '1',
        prevLender: null,
        caseType: 'REASON_FTB',
        caseStatus: 'COMPLETE',
        notProceedingReason: null,
        createdAt: new Date('2025-01-10'),
        firstSubmittedDate: new Date('2025-01-12'),
        lastSubmittedDate: new Date('2025-01-12'),
        firstOfferDate: new Date('2025-01-15'),
        completionDate: new Date('2025-01-20'),
        mortgageAmount: 250000,
        propertyValue: 300000,
        ltv: 0.83,
        linkedProtection: true,
        totalBrokerFees: 500,
        grossMortgageProcFee: 1000,
        totalCaseRevenue: 1500,
        initialPayRate: 4.5,
      },
    ],
    quality: { dateParseFailures: {}, degradedColumns: [], criticalFailure: false },
  }),
}));

describe('useDataLoader', () => {
  it('transitions through progressive loading states', async () => {
    const period = { type: 'this_year' } as const;
    const { result } = renderHook(() => useDataLoader('/mortgage.csv', period));
    await waitFor(() => expect(result.current.status === 'internal-ready' || result.current.status === 'all-ready').toBe(true));
  });
});
