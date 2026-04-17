import { useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MarketStats } from '../../types/mortgage';
import { STATUS_LABELS } from '../../utils/constants';
import { formatCompactCurrency, formatNumber } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

export function InternalDashboard({ stats }: { stats: MarketStats }) {
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  if (stats.totalCases === 0) {
    return <EmptyState title="No market data in this period" description="Try selecting a wider date range in the time filter." />;
  }

  return (
    <section className="mt-8">
      <PageHeader title="Market overview" subtitle="Platform-wide activity across all lenders" />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label="Total cases" value={formatNumber(stats.totalCases)} />
        <KpiCard label="Total loan value" value={formatCompactCurrency(stats.totalLoanValue)} />
        <KpiCard label="Completed cases" value={formatNumber(stats.completedCases)} />
        <KpiCard label="Avg completion days" value={String(Math.round(stats.avgCompletionDays || 0))} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Pipeline funnel"
          subtitle="Case volumes by status"
          rows={stats.pipeline.map((row) => ({
            label: STATUS_LABELS[row.status],
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
            accent: row.status === 'NOT_PROCEEDING' ? '#E24B4A' : '#7D6CF1',
          }))}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Monthly volume</h3>
          <p className="mt-1 text-sm text-acre-muted">Case creation by month in 2025</p>
          <div className="mt-4 h-[220px]" role="img" aria-label="Monthly case volume chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.monthlyVolume}
                onMouseMove={(state) => {
                  setActiveBarIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveBarIndex(null)}
              >
                <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottom', offset: -6 }} />
                <YAxis label={{ value: 'Cases', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)), 'Cases']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E7E7E3' }}
                />
                <Bar dataKey="count" fill="#6C5CE7" radius={[4, 4, 0, 0]}>
                  {stats.monthlyVolume.map((entry, index) => (
                    <Cell
                      key={`${entry.month}-count`}
                      fillOpacity={activeBarIndex === null || activeBarIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Cases by type"
          subtitle="Share of all cases"
          rows={stats.caseMix.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
          }))}
        />
        <HorizontalDistribution
          title="Market share (completed cases)"
          subtitle="Top lenders by completed case share"
          rows={stats.marketShare.map((row) => ({
            label: row.lender,
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
          }))}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="LTV distribution"
          subtitle="Share of cases by LTV band"
          rows={stats.ltvDistribution.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
          }))}
        />
        <HorizontalDistribution
          title="Mortgage amount distribution"
          subtitle="Share of cases by loan size band"
          rows={stats.mortgageAmountDistribution.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
          }))}
        />
      </div>
    </section>
  );
}

