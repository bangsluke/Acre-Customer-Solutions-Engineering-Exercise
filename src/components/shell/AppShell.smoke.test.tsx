import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('../../context/useDataContext', () => ({
  useDataContext: () => ({
    status: 'all-ready',
    progress: 100,
    error: null,
    activePeriod: { type: 'this_year' },
    setActivePeriod: vi.fn(),
    selectedLender: 'Halifax',
    setSelectedLender: vi.fn(),
    periodModel: {
      periodKey: 'this_year',
      periodData: [],
      quality: { dateParseFailures: {}, degradedColumns: [], criticalFailure: false },
      marketStats: {
        totalCases: 10,
        totalLoanValue: 1000000,
        completedCases: 5,
        avgCompletionDays: 20,
        avgLtv: 0.8,
        protectionAttachRate: 0.1,
        avgDaysToOffer: 12,
        avgDaysToComplete: 20,
        resubmissionRate: 0.1,
        stalledSubmittedRate: 0.05,
        pipeline: [
          { status: 'LEAD', count: 10, percentage: 1 },
          { status: 'PRE_RECOMMENDATION', count: 8, percentage: 0.8 },
          { status: 'APPLICATION_SUBMITTED', count: 7, percentage: 0.7 },
          { status: 'OFFER_RECEIVED', count: 6, percentage: 0.6 },
          { status: 'COMPLETE', count: 5, percentage: 0.5 },
          { status: 'NOT_PROCEEDING', count: 2, percentage: 0.2 },
        ],
        monthlyVolume: [{ month: '01', count: 10 }],
        caseMix: [{ label: 'First-time buyer', count: 10, percentage: 1 }],
        marketShare: [{ lender: 'Halifax', count: 5, percentage: 1 }],
        ltvDistribution: [{ label: '0-60%', count: 10, percentage: 1 }],
        mortgageAmountDistribution: [{ label: '< £100k', count: 10, percentage: 1 }],
      },
      lenderStats: new Map([
        [
          'Halifax',
          {
            lender: 'Halifax',
            totalCases: 10,
            marketShare: 1,
            avgLoanSize: 100000,
            completionRate: 0.5,
            avgDaysToOffer: 12,
            avgLtv: 0.8,
            brokerRevenuePerCase: 1500,
            protectionAttachRate: 0.1,
            avgDaysToComplete: 20,
            resubmissionRate: 0.1,
            caseMix: [{ label: 'First-time buyer', count: 10, percentage: 1 }],
            pipeline: [
              { status: 'LEAD', count: 10, percentage: 1 },
              { status: 'PRE_RECOMMENDATION', count: 8, percentage: 0.8 },
              { status: 'APPLICATION_SUBMITTED', count: 7, percentage: 0.7 },
              { status: 'OFFER_RECEIVED', count: 6, percentage: 0.6 },
              { status: 'COMPLETE', count: 5, percentage: 0.5 },
              { status: 'NOT_PROCEEDING', count: 2, percentage: 0.2 },
            ],
          },
        ],
      ]),
    },
  }),
}));

describe('AppShell', () => {
  it('renders and switches views without crashing', async () => {
    render(<AppShell />);
    expect(await screen.findByText(/Loading tab content/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Lender dashboard' }));
    expect(screen.getByRole('tab', { name: 'Lender dashboard' })).toBeInTheDocument();
  });
});

