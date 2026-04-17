import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Cell } from 'recharts';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderPerformanceTabProps {
  periodData: MortgageCase[];
  selectedLender: string;
  marketStats: MarketStats;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildRevenueSeries(rows: MortgageCase[]) {
  const monthly = new Map<string, { brokerFee: number; procFee: number; count: number }>();
  for (const row of rows) {
    if (!row.createdAt) {
      continue;
    }
    const key = monthKey(row.createdAt);
    const value = monthly.get(key) ?? { brokerFee: 0, procFee: 0, count: 0 };
    value.brokerFee += row.totalBrokerFees ?? 0;
    value.procFee += row.grossMortgageProcFee ?? 0;
    value.count += 1;
    monthly.set(key, value);
  }
  return [...monthly.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      month: key.slice(5, 7),
      brokerFee: Math.round(value.brokerFee),
      procFee: Math.round(value.procFee),
      total: Math.round(value.brokerFee + value.procFee),
    }));
}

function buildProtectionByCaseType(rows: MortgageCase[]) {
  const byType = new Map<string, { protectedCount: number; total: number }>();
  for (const row of rows) {
    const key = row.caseType;
    const current = byType.get(key) ?? { protectedCount: 0, total: 0 };
    current.total += 1;
    if (row.linkedProtection) {
      current.protectedCount += 1;
    }
    byType.set(key, current);
  }
  return [...byType.entries()]
    .map(([type, value]) => ({
      label: type.replace('REASON_', '').toLowerCase().replace('_', ' '),
      percentage: value.total ? value.protectedCount / value.total : 0,
      value: formatPercentage(value.total ? value.protectedCount / value.total : 0),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

function buildResubmissionRows(rows: MortgageCase[]) {
  const eligible = rows.filter((row) => row.firstSubmittedDate !== null);
  const resubmitted = eligible.filter(
    (row) =>
      row.lastSubmittedDate !== null &&
      row.firstSubmittedDate !== null &&
      row.lastSubmittedDate.getTime() > row.firstSubmittedDate.getTime(),
  );
  return {
    eligible: eligible.length,
    resubmitted: resubmitted.length,
    rate: eligible.length ? resubmitted.length / eligible.length : 0,
  };
}

function averageInitialRate(rows: MortgageCase[]) {
  const rates = rows
    .map((row) => row.initialPayRate)
    .filter((rate): rate is number => rate !== null && rate > 0);
  return average(rates);
}

function formatCurrencyTick(value: number) {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

export function LenderPerformanceTab({ periodData, selectedLender, marketStats }: LenderPerformanceTabProps) {
  const [activeRevenueIndex, setActiveRevenueIndex] = useState<number | null>(null);
  const [activeTrendIndex, setActiveTrendIndex] = useState<number | null>(null);

  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (lenderRows.length === 0) {
    return <EmptyState title="No performance data for selected lender" />;
  }

  const lenderRevenuePerCase = average(
    lenderRows
      .map((row) => row.totalCaseRevenue)
      .filter((value): value is number => value !== null && value >= 0),
  );
  const marketRevenuePerCase = average(
    periodData
      .map((row) => row.totalCaseRevenue)
      .filter((value): value is number => value !== null && value >= 0),
  );
  const lenderProtectionAttach = lenderRows.length
    ? lenderRows.filter((row) => row.linkedProtection).length / lenderRows.length
    : 0;
  const lenderResubmission = buildResubmissionRows(lenderRows);
  const marketResubmission = marketStats.resubmissionRate;
  const lenderInitialRate = averageInitialRate(lenderRows);
  const marketInitialRate = averageInitialRate(periodData);

  const revenueSeries = buildRevenueSeries(lenderRows);
  const protectionRows = buildProtectionByCaseType(lenderRows);

  return (
    <section className="mt-8">
      <PageHeader
        title="Performance"
        subtitle={`Revenue, protection, and conversion quality for ${selectedLender}`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard
          label="Broker revenue per case"
          value={formatCurrency(lenderRevenuePerCase)}
          subtitle={`Market avg: ${formatCurrency(marketRevenuePerCase)}`}
        />
        <KpiCard
          label="Protection attach rate"
          value={formatPercentage(lenderProtectionAttach)}
          subtitle={`Market avg: ${formatPercentage(marketStats.protectionAttachRate)}`}
        />
        <KpiCard
          label="Resubmission rate"
          value={formatPercentage(lenderResubmission.rate)}
          subtitle={`Market avg: ${formatPercentage(marketResubmission)}`}
        />
        <KpiCard
          label="Avg initial rate"
          value={formatPercentage(lenderInitialRate)}
          subtitle={`Market avg: ${formatPercentage(marketInitialRate)}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Broker revenue breakdown</h3>
          <p className="mt-1 text-sm text-acre-muted">Total broker fee and procurement fee by month</p>
          <div className="mt-4 h-[260px]" role="img" aria-label="Broker revenue stacked bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueSeries}
                onMouseMove={(state) => {
                  setActiveRevenueIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveRevenueIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                <YAxis tickFormatter={formatCurrencyTick} label={{ value: 'Revenue (£)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E7E7E3' }}
                />
                <Bar dataKey="brokerFee" stackId="fees" fill="#6C5CE7">
                  {revenueSeries.map((entry, index) => (
                    <Cell
                      key={`${entry.month}-broker`}
                      fillOpacity={activeRevenueIndex === null || activeRevenueIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
                <Bar dataKey="procFee" stackId="fees" fill="#A29BFE">
                  {revenueSeries.map((entry, index) => (
                    <Cell
                      key={`${entry.month}-proc`}
                      fillOpacity={activeRevenueIndex === null || activeRevenueIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Total revenue trend</h3>
          <p className="mt-1 text-sm text-acre-muted">Monthly broker revenue trend for {selectedLender}</p>
          <div className="mt-4 h-[260px]" role="img" aria-label="Total broker revenue trend line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueSeries}
                onMouseMove={(state) => {
                  setActiveTrendIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveTrendIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                <YAxis tickFormatter={formatCurrencyTick} label={{ value: 'Revenue (£)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Total revenue']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E7E7E3' }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#1D9E75"
                  strokeWidth={2}
                  strokeOpacity={activeTrendIndex === null ? 1 : 0.6}
                  dot={{ r: 3, fill: '#1D9E75', fillOpacity: 0.65 }}
                  activeDot={{ r: 5, fill: '#1D9E75' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Protection attach by case type"
          subtitle="Share of cases with linked protection"
          rows={protectionRows}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Resubmission analysis</h3>
          <p className="mt-1 text-sm text-acre-muted">Submission quality and repeat submission levels</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-acre-border bg-acre-panel p-4">
              <p className="text-sm text-acre-muted">Eligible submitted cases</p>
              <p className="mt-1 text-3xl font-semibold text-acre-text">{formatNumber(lenderResubmission.eligible)}</p>
            </div>
            <div className="rounded-lg border border-acre-border bg-acre-panel p-4">
              <p className="text-sm text-acre-muted">Resubmitted cases</p>
              <p className="mt-1 text-3xl font-semibold text-acre-text">{formatNumber(lenderResubmission.resubmitted)}</p>
            </div>
            <div className="rounded-lg border border-acre-border bg-acre-panel p-4">
              <p className="text-sm text-acre-muted">Resubmission rate</p>
              <p className="mt-1 text-3xl font-semibold text-acre-purple">{formatPercentage(lenderResubmission.rate)}</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

