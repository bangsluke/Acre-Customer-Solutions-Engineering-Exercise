import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DateRange, MortgageCase } from '../../types/mortgage';
import { FunnelPanel } from './FunnelPanel';

const dateRange: DateRange = {
  start: new Date('2025-01-01T00:00:00Z'),
  end: new Date('2025-12-31T23:59:59Z'),
};

function buildCase(): MortgageCase {
  return {
    caseId: 'case-1',
    lender: 'Halifax',
    lenderId: 'hfx',
    prevLender: null,
    caseType: 'REASON_FTB',
    caseStatus: 'LEAD',
    notProceedingReason: null,
    createdAt: new Date('2025-02-01T00:00:00Z'),
    recommendationDate: null,
    firstSubmittedDate: null,
    lastSubmittedDate: null,
    firstOfferDate: null,
    completionDate: null,
    mortgageAmount: 200000,
    propertyValue: 250000,
    ltv: 0.8,
    linkedProtection: false,
    totalBrokerFees: 500,
    grossMortgageProcFee: 700,
    totalCaseRevenue: 1200,
    initialPayRate: 0.045,
  };
}

describe('FunnelPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to funnel mode when local storage is empty', () => {
    render(
      <FunnelPanel
        cases={[buildCase()]}
        title="Pipeline funnel"
        scope="internal"
        dateRange={dateRange}
      />,
    );

    expect(screen.getByText(/Cohort: cases created in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pipeline funnel' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('persists selected mode by scope in localStorage', () => {
    render(
      <FunnelPanel
        cases={[buildCase()]}
        title="Pipeline funnel"
        scope="lender"
        dateRange={dateRange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stage distribution' }));

    expect(window.localStorage.getItem('funnel-mode:lender')).toBe('distribution');
  });

  it('renames the section heading when switched to stage distribution', () => {
    render(
      <FunnelPanel
        cases={[buildCase()]}
        title="Pipeline funnel"
        scope="internal"
        dateRange={dateRange}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Pipeline funnel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Stage distribution' }));

    expect(screen.getByRole('heading', { name: 'Stage Distribution' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pipeline funnel' })).not.toBeInTheDocument();
  });

  it('switching mode does not invoke unrelated filter handlers', () => {
    const onStagesSkippedChange = vi.fn();
    render(
      <FunnelPanel
        cases={[buildCase()]}
        title="Pipeline funnel"
        scope="internal"
        dateRange={dateRange}
        onStagesSkippedChange={onStagesSkippedChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stage distribution' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pipeline funnel' }));

    expect(onStagesSkippedChange).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pipeline funnel' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows stage labels with dotted underline and stage-group tooltip text', () => {
    render(
      <FunnelPanel
        cases={[buildCase()]}
        title="Pipeline funnel"
        scope="internal"
        dateRange={dateRange}
      />,
    );

    const leadLabel = screen.getAllByText('Lead')[0];
    expect(leadLabel).toHaveClass('underline');
    expect(leadLabel).toHaveClass('decoration-dotted');
    expect(leadLabel).not.toHaveAttribute('title');

    fireEvent.mouseEnter(leadLabel);
    const leadTooltip = screen.getByRole('tooltip');
    expect(leadTooltip).toHaveTextContent('Stage 1');
    expect(leadTooltip).toHaveTextContent('Lead: 1');
    expect(leadTooltip.querySelectorAll('div').length).toBeGreaterThanOrEqual(2);
    fireEvent.mouseLeave(leadLabel);

    fireEvent.click(screen.getByRole('button', { name: 'Stage distribution' }));
    const recommendationLabel = screen.getByText('Recommendation');
    fireEvent.mouseEnter(recommendationLabel);
    const recommendationTooltip = screen.getByRole('tooltip');
    expect(recommendationTooltip).toHaveTextContent('Stage 2');
    expect(recommendationTooltip).toHaveTextContent('Recommendation: 0');
  });
});
