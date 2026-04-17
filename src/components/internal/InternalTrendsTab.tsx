import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Cell } from 'recharts';
import type { MortgageCase } from '../../types/mortgage';
import { formatDays, formatNumber, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface TrendPoint {
  key: string;
  label: string;
  volume: number;
  completionDays: number;
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

function weekKey(date: Date) {
  const oneJan = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - oneJan.getTime()) / 86_400_000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function buildMonthlyTrends(periodData: MortgageCase[]): TrendPoint[] {
  const buckets = new Map<string, { volume: number; completionValues: number[] }>();

  for (const row of periodData) {
    if (!row.createdAt) {
      continue;
    }
    const key = monthKey(row.createdAt);
    const bucket = buckets.get(key) ?? { volume: 0, completionValues: [] };
    bucket.volume += 1;
    if (row.firstSubmittedDate && row.completionDate) {
      const days = Math.max(
        0,
        Math.round((row.completionDate.getTime() - row.firstSubmittedDate.getTime()) / 86_400_000),
      );
      bucket.completionValues.push(days);
    }
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      key,
      label: key.slice(5, 7),
      volume: value.volume,
      completionDays: average(value.completionValues),
    }));
}

function buildWeeklyTrends(periodData: MortgageCase[]) {
  const buckets = new Map<string, number>();
  for (const row of periodData) {
    if (!row.createdAt) {
      continue;
    }
    const key = weekKey(row.createdAt);
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ week: key, count }));
}

function buildCaseMixShift(periodData: MortgageCase[]) {
  const sorted = [...periodData]
    .filter((row) => row.createdAt !== null)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const allTypes = new Set<string>(sorted.map((row) => row.caseType));
  return [...allTypes].map((type) => {
    const firstShare = firstHalf.length
      ? firstHalf.filter((row) => row.caseType === type).length / firstHalf.length
      : 0;
    const secondShare = secondHalf.length
      ? secondHalf.filter((row) => row.caseType === type).length / secondHalf.length
      : 0;
    const shift = secondShare - firstShare;
    return {
      label: type.replace('REASON_', '').toLowerCase().replace('_', ' '),
      value: `${shift >= 0 ? '+' : ''}${(shift * 100).toFixed(1)}pp`,
      percentage: Math.min(1, Math.abs(shift) * 4),
      accent: shift >= 0 ? '#1D9E75' : '#E24B4A',
    };
  });
}

export function InternalTrendsTab({ periodData }: { periodData: MortgageCase[] }) {
  const [activeMonthlyIndex, setActiveMonthlyIndex] = useState<number | null>(null);
  const [activeVelocityIndex, setActiveVelocityIndex] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  if (periodData.length === 0) {
    return <EmptyState title="No trends data in this period" />;
  }

  const monthly = buildMonthlyTrends(periodData);
  const weekly = buildWeeklyTrends(periodData);
  const mixShift = buildCaseMixShift(periodData);

  const totalVolume = periodData.length;
  const avgWeeklyVolume = average(weekly.map((item) => item.count));
  const avgCompletionVelocity = average(monthly.map((item) => item.completionDays).filter((v) => v > 0));
  const peakMonth = monthly.slice().sort((a, b) => b.volume - a.volume)[0];

  return (
    <section className="mt-8">
      <PageHeader
        title="Trends"
        subtitle="Monthly and weekly trend views with case-mix and completion velocity shifts"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label="Period volume" value={formatNumber(totalVolume)} />
        <KpiCard label="Avg weekly volume" value={formatNumber(avgWeeklyVolume)} />
        <KpiCard label="Avg completion velocity" value={formatDays(avgCompletionVelocity)} />
        <KpiCard
          label="Peak month volume"
          value={peakMonth ? formatNumber(peakMonth.volume) : '0'}
          subtitle={peakMonth ? `Month ${peakMonth.label}` : 'No data'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Monthly volume trend</h3>
          <p className="mt-1 text-sm text-acre-muted">Case creation trend by month</p>
          <div className="mt-4 h-[260px]" role="img" aria-label="Monthly case volume trend chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthly}
                onMouseMove={(state) => {
                  setActiveMonthlyIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveMonthlyIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Cases', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [formatNumber(Number(value)), 'Cases']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E7E7E3' }}
                />
                <Bar dataKey="volume" fill="#6C5CE7" radius={[4, 4, 0, 0]}>
                  {monthly.map((entry, index) => (
                    <Cell
                      key={`${entry.key}-volume`}
                      fillOpacity={activeMonthlyIndex === null || activeMonthlyIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Completion velocity over time</h3>
          <p className="mt-1 text-sm text-acre-muted">Average days from submission to completion by month</p>
          <div className="mt-4 h-[260px]" role="img" aria-label="Completion velocity line chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthly}
                onMouseMove={(state) => {
                  setActiveVelocityIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveVelocityIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" label={{ value: 'Month', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={(value) => [formatDays(Number(value)), 'Completion time']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E7E7E3' }}
                />
                <Line
                  type="monotone"
                  dataKey="completionDays"
                  stroke="#1D9E75"
                  strokeWidth={2}
                  strokeOpacity={activeVelocityIndex === null ? 1 : 0.6}
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
          title="Case mix shift"
          subtitle="Change in share from first half to second half of active period"
          rows={mixShift}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Weekly volume trend</h3>
          <p className="mt-1 text-sm text-acre-muted">Last 12 weeks in period (or fewer if unavailable)</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-acre-border text-left text-acre-muted">
                  <th className="py-2 pr-4 font-medium">Week</th>
                  <th className="py-2 pr-4 font-medium">Volume</th>
                  <th className="py-2 pr-4 font-medium">Share of period</th>
                </tr>
              </thead>
              <tbody>
                {weekly.slice(-12).map((item) => (
                  <tr
                    key={item.week}
                    className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                      selectedWeek === item.week ? 'bg-gray-200' : ''
                    }`}
                    onClick={() => setSelectedWeek(item.week)}
                  >
                    <td className="py-2 pr-4 text-acre-text">{item.week}</td>
                    <td className="py-2 pr-4 text-acre-text">{formatNumber(item.count)}</td>
                    <td className="py-2 pr-4 text-acre-purple">
                      {formatPercentage(totalVolume ? item.count / totalVolume : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

