import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/shell/AppShell';

vi.mock('../utils/lenderInsights', () => ({
  evaluateLenderInsights: () => ({
    alerts: [],
    alertMessages: ['One alert'],
    recommendations: [],
    stalledCases: [],
  }),
}));

vi.mock('../context/useDataContext', () => ({
  useDataContext: () => ({
    status: 'all-ready',
    progress: 100,
    error: null,
    activePeriod: { type: 'this_year' },
    setActivePeriod: vi.fn(),
    allRows: [],
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
          { status: 'RECOMMENDATION', count: 8, percentage: 0.8 },
          { status: 'APPLICATION', count: 7, percentage: 0.7 },
          { status: 'OFFER', count: 6, percentage: 0.6 },
          { status: 'COMPLETION', count: 5, percentage: 0.5 },
          { status: 'NOT_PROCEEDING', count: 2, percentage: 0.2 },
        ],
        excludedSystemStateCount: 0,
        monthlyVolume: [{ key: '2025-01', month: '01', count: 10 }],
        dailyVolume: [{ key: '2025-01-01', day: '01', count: 1 }],
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
              { status: 'RECOMMENDATION', count: 8, percentage: 0.8 },
              { status: 'APPLICATION', count: 7, percentage: 0.7 },
              { status: 'OFFER', count: 6, percentage: 0.6 },
              { status: 'COMPLETION', count: 5, percentage: 0.5 },
              { status: 'NOT_PROCEEDING', count: 2, percentage: 0.2 },
            ],
            excludedSystemStateCount: 0,
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
    expect(screen.queryByRole('tab', { name: 'Pipeline' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Data Quality' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Product Analysis' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Lender dashboard' }));
    expect(screen.getByRole('tab', { name: 'Lender dashboard' })).toBeInTheDocument();
    expect(screen.getByText('1 alert')).toBeInTheDocument();
  });
});
