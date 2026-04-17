import { useState } from 'react';
import type { MortgageCase } from '../../types/mortgage';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderRow {
  lender: string;
  caseCount: number;
  share: number;
  completionRate: number;
  avgRevenue: number;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildLenderRows(periodData: MortgageCase[]): LenderRow[] {
  const totalCases = Math.max(periodData.length, 1);
  const byLender = new Map<string, MortgageCase[]>();

  for (const row of periodData) {
    const lenderRows = byLender.get(row.lender) ?? [];
    lenderRows.push(row);
    byLender.set(row.lender, lenderRows);
  }

  return [...byLender.entries()]
    .map(([lender, rows]) => {
      const completed = rows.filter((item) => item.caseStatus === 'COMPLETE').length;
      const validRevenue = rows
        .map((item) => item.totalCaseRevenue)
        .filter((value): value is number => value !== null && value >= 0);
      return {
        lender,
        caseCount: rows.length,
        share: rows.length / totalCases,
        completionRate: rows.length ? completed / rows.length : 0,
        avgRevenue: average(validRevenue),
      };
    })
    .sort((a, b) => b.caseCount - a.caseCount);
}

function buildSwitchRows(periodData: MortgageCase[]) {
  const transitions = new Map<string, number>();
  for (const row of periodData) {
    if (!row.prevLender || row.prevLender === row.lender) {
      continue;
    }
    const key = `${row.prevLender} -> ${row.lender}`;
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
  }

  return [...transitions.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([route, count]) => ({ route, count }));
}

export function InternalLenderShareTab({ periodData }: { periodData: MortgageCase[] }) {
  const [selectedLenderRow, setSelectedLenderRow] = useState<string | null>(null);

  if (periodData.length === 0) {
    return <EmptyState title="No lender-share data in this period" />;
  }

  const lenderRows = buildLenderRows(periodData);
  const switchRows = buildSwitchRows(periodData);

  const numberOfLenders = lenderRows.length;
  const topFiveConcentration = lenderRows.slice(0, 5).reduce((sum, row) => sum + row.share, 0);
  const bestCompletion = lenderRows
    .filter((row) => row.caseCount >= 100)
    .sort((a, b) => b.completionRate - a.completionRate)[0];

  return (
    <section className="mt-8">
      <PageHeader title="Lender share" subtitle="Market concentration and lender-level performance" />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3">
        <KpiCard label="Number of lenders" value={numberOfLenders.toLocaleString('en-GB')} />
        <KpiCard label="Top 5 concentration" value={formatPercentage(topFiveConcentration)} />
        <KpiCard
          label="Best completion rate"
          value={bestCompletion ? `${bestCompletion.lender}` : 'N/A'}
          subtitle={bestCompletion ? formatPercentage(bestCompletion.completionRate) : 'Insufficient volume'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Top lenders by case volume"
          subtitle="Share of cases in active period"
          rows={lenderRows.slice(0, 10).map((row) => ({
            label: row.lender,
            value: formatPercentage(row.share),
            percentage: row.share,
            accent: '#7D6CF1',
          }))}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Switching patterns</h3>
          <p className="mt-1 text-sm text-acre-muted">Top previous-lender to current-lender transitions</p>
          <div className="mt-4 space-y-2">
            {switchRows.length ? (
              switchRows.map((row) => (
                <div key={row.route} className="flex items-center justify-between border-b border-acre-border py-2 text-sm">
                  <span className="text-acre-text">{row.route}</span>
                  <span className="font-medium text-acre-purple">{row.count.toLocaleString('en-GB')}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-acre-muted">No lender switching records in this period.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">All lenders</h3>
        <p className="mt-1 text-sm text-acre-muted">Case count, market share, completion rate, and average broker revenue</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">Lender</th>
                <th className="py-2 pr-4 font-medium">Cases</th>
                <th className="py-2 pr-4 font-medium">Share</th>
                <th className="py-2 pr-4 font-medium">Completion rate</th>
                <th className="py-2 pr-4 font-medium">Avg broker revenue</th>
              </tr>
            </thead>
            <tbody>
              {lenderRows.map((row) => (
                <tr
                  key={row.lender}
                  className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                    selectedLenderRow === row.lender ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedLenderRow(row.lender)}
                >
                  <td className="py-2 pr-4 text-acre-text">{row.lender}</td>
                  <td className="py-2 pr-4 text-acre-text">{row.caseCount.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.share)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.completionRate)}</td>
                  <td className="py-2 pr-4 text-acre-purple">{formatCurrency(row.avgRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

