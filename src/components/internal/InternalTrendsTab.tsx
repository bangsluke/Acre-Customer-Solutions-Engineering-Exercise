import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MortgageCase, TimePeriod } from '../../types/mortgage';
import { formatCompactCurrency, formatDays, formatNumber, formatPercentage, formatSignedDaysDelta } from '../../utils/formatters';
import { filterByPeriod, monthlyCompletedVolume } from '../../utils/aggregations';
import { OTHER_CASE_TYPE_TOOLTIP, sortCaseTypeLabels, toCaseTypeLabel } from '../../utils/constants';
import { priorPeriod } from '../../utils/dateUtils';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { VolumeChartCard } from '../shared/VolumeChartCard';
import {
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
} from '../shared/tooltipStyles';

const SHARED_CHART_MARGIN = { top: 8, right: 16, left: 20, bottom: 30 };
const SHARED_Y_AXIS_WIDTH = 64;

interface TrendPoint {
  key: string;
  label: string;
  monthLabel: string;
  volume: number;
  completionDays: number;
  netRevenue: number;
}

const SHORT_CASE_TYPE_LABELS: Record<string, string> = {
  'First-time buyer': 'FTB',
  'House move': 'House Move',
  'Buy-to-let': 'BTL',
};

function caseTypeDisplayLabel(label: string): string {
  return SHORT_CASE_TYPE_LABELS[label] ?? label;
}

function toCanonicalCaseTypeLabel(label: string): string {
  if (label === 'FTB') {
    return 'First-time buyer';
  }
  if (label === 'House Move') {
    return 'House move';
  }
  if (label === 'BTL') {
    return 'Buy-to-let';
  }
  return label;
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

function monthShortLabelFromKey(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleString('en-GB', { month: 'short' });
}

export function trendNetRevenueValue(row: MortgageCase): number {
  return Math.max(0, row.netCaseRevenue ?? row.totalCaseRevenue ?? 0);
}

export function buildMonthlyTrends(periodData: MortgageCase[]): TrendPoint[] {
  const buckets = new Map<string, { volume: number; completionValues: number[]; netRevenue: number }>();

  for (const row of periodData) {
    if (!row.createdAt) {
      continue;
    }
    const key = monthKey(row.createdAt);
    const bucket = buckets.get(key) ?? { volume: 0, completionValues: [], netRevenue: 0 };
    bucket.volume += 1;
    bucket.netRevenue += trendNetRevenueValue(row);
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
      monthLabel: new Date(`${key}-01T00:00:00`).toLocaleString('en-GB', { month: 'short' }),
      volume: value.volume,
      completionDays: average(value.completionValues),
      netRevenue: value.netRevenue,
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

  const weeklyCounts = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ week: key, count }));

  return weeklyCounts.map((item, index) => {
    if (index === 0) {
      return { ...item, wowChange: null as number | null };
    }
    const previousWeekCount = weeklyCounts[index - 1].count;
    if (previousWeekCount <= 0) {
      return { ...item, wowChange: null as number | null };
    }
    return {
      ...item,
      wowChange: (item.count - previousWeekCount) / previousWeekCount,
    };
  });
}

function buildCaseMixShift(periodData: MortgageCase[], groupOther: boolean) {
  const sorted = [...periodData]
    .filter((row) => row.createdAt !== null)
    .sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstHalfCounts = new Map<string, number>();
  const secondHalfCounts = new Map<string, number>();
  for (const row of firstHalf) {
    const label = toCaseTypeLabel(row.caseType, groupOther);
    firstHalfCounts.set(label, (firstHalfCounts.get(label) ?? 0) + 1);
  }
  for (const row of secondHalf) {
    const label = toCaseTypeLabel(row.caseType, groupOther);
    secondHalfCounts.set(label, (secondHalfCounts.get(label) ?? 0) + 1);
  }

  const allLabels = sortCaseTypeLabels([...new Set([...firstHalfCounts.keys(), ...secondHalfCounts.keys()])]);

  return allLabels.map((label) => {
    const firstShare = firstHalf.length
      ? (firstHalfCounts.get(label) ?? 0) / firstHalf.length
      : 0;
    const secondShare = secondHalf.length
      ? (secondHalfCounts.get(label) ?? 0) / secondHalf.length
      : 0;
    const shift = secondShare - firstShare;
    return {
      label: caseTypeDisplayLabel(label),
      value: `${shift >= 0 ? '+' : ''}${(shift * 100).toFixed(1)}%`,
      percentage: Math.min(1, Math.abs(shift) * 4),
      shift,
      accent: shift >= 0 ? '#1D9E75' : '#E24B4A',
    };
  });
}

function trendToneClass(tone: 'muted' | 'positive' | 'negative'): string {
  if (tone === 'positive') {
    return 'text-green-700';
  }
  if (tone === 'negative') {
    return 'text-amber-700';
  }
  return 'text-acre-muted';
}

function formatPercentageDelta(delta: number): string {
  return `${delta > 0 ? '+' : ''}${formatPercentage(delta, 1)}`;
}

function buildVolumeTrendBadge(current: number, previous: number | null, period: TimePeriod): { text: string; tone: 'muted' | 'positive' | 'negative' } {
  if (period.type === 'this_year') {
    return { text: 'No data', tone: 'muted' };
  }
  if (previous === null || previous <= 0) {
    return { text: 'No previous period data', tone: 'muted' };
  }
  const delta = (current - previous) / previous;
  if (delta === 0) {
    return { text: '→ 0.0% vs prev period', tone: 'muted' };
  }
  return {
    text: `${delta > 0 ? '↑' : '↓'} ${formatPercentageDelta(delta)} vs prev period`,
    tone: delta > 0 ? 'positive' : 'negative',
  };
}

function buildVelocityTrendBadge(current: number, previous: number | null, period: TimePeriod): { text: string; tone: 'muted' | 'positive' | 'negative' } {
  if (period.type === 'this_year') {
    return { text: 'No data', tone: 'muted' };
  }
  if (previous === null || previous <= 0) {
    return { text: 'No previous period data', tone: 'muted' };
  }
  const delta = current - previous;
  if (delta === 0) {
    return { text: '→ 0d vs prev period', tone: 'muted' };
  }
  return {
    text: `${delta > 0 ? '↑' : '↓'} ${formatSignedDaysDelta(delta)} vs prev period`,
    tone: delta < 0 ? 'positive' : 'negative',
  };
}

export function InternalTrendsTab({
  periodData,
  period,
  allRows = periodData,
}: {
  periodData: MortgageCase[];
  period: TimePeriod;
  allRows?: MortgageCase[];
}) {
  const [activeVelocityIndex, setActiveVelocityIndex] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [monthlyVolumeMetric, setMonthlyVolumeMetric] = useState<'created' | 'completed'>('created');
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);

  if (periodData.length === 0) {
    return <EmptyState title="No trends data in this period" />;
  }

  const monthly = buildMonthlyTrends(periodData);
  const weekly = buildWeeklyTrends(periodData);
  const mixShift = buildCaseMixShift(periodData, groupOtherCaseTypes)
    .slice()
    .sort(
      (a, b) =>
        Math.abs(b.shift) - Math.abs(a.shift) ||
        toCanonicalCaseTypeLabel(a.label).localeCompare(toCanonicalCaseTypeLabel(b.label), 'en-GB'),
    );

  const totalVolume = periodData.length;
  const avgWeeklyVolume = average(weekly.map((item) => item.count));
  const avgCompletionVelocity = average(
    periodData
      .map((row) => {
        if (!row.firstSubmittedDate || !row.completionDate) {
          return null;
        }
        return Math.max(0, Math.round((row.completionDate.getTime() - row.firstSubmittedDate.getTime()) / 86_400_000));
      })
      .filter((value): value is number => value !== null),
  );
  const latestCreatedAt = allRows.reduce<Date | null>((latest, row) => {
    if (!row.createdAt) {
      return latest;
    }
    if (!latest || row.createdAt.getTime() > latest.getTime()) {
      return row.createdAt;
    }
    return latest;
  }, null);
  const previousPeriod = priorPeriod(period, latestCreatedAt ?? undefined);
  const previousPeriodData = previousPeriod ? filterByPeriod(allRows, previousPeriod) : [];
  const previousWeekly = buildWeeklyTrends(previousPeriodData);
  const previousTotalVolume = previousPeriodData.length > 0 ? previousPeriodData.length : null;
  const previousAvgWeeklyVolume =
    previousWeekly.length > 0 ? average(previousWeekly.map((item) => item.count)) : null;
  const previousAvgCompletionVelocityValues = previousPeriodData
    .map((row) => {
      if (!row.firstSubmittedDate || !row.completionDate) {
        return null;
      }
      return Math.max(0, Math.round((row.completionDate.getTime() - row.firstSubmittedDate.getTime()) / 86_400_000));
    })
    .filter((value): value is number => value !== null);
  const previousAvgCompletionVelocity =
    previousAvgCompletionVelocityValues.length > 0 ? average(previousAvgCompletionVelocityValues) : null;
  const totalVolumeTrend = buildVolumeTrendBadge(totalVolume, previousTotalVolume, period);
  const avgWeeklyVolumeTrend = buildVolumeTrendBadge(avgWeeklyVolume, previousAvgWeeklyVolume, period);
  const avgCompletionVelocityTrend = buildVelocityTrendBadge(avgCompletionVelocity, previousAvgCompletionVelocity, period);
  const monthlyCompletionSeries = monthly.filter((item) => item.completionDays > 0);
  const completionMidpoint = Math.floor(monthlyCompletionSeries.length / 2);
  const previousCompletionHalf = monthlyCompletionSeries.slice(0, completionMidpoint);
  const currentCompletionHalf = monthlyCompletionSeries.slice(completionMidpoint);
  const previousHalfCompletionDays = average(previousCompletionHalf.map((item) => item.completionDays));
  const currentHalfCompletionDays = average(currentCompletionHalf.map((item) => item.completionDays));
  const velocityDelta = currentHalfCompletionDays - previousHalfCompletionDays;
  const velocityDirection = velocityDelta > 0 ? '↑' : velocityDelta < 0 ? '↓' : '→';
  const velocityTrendText = `${velocityDirection} ${formatSignedDaysDelta(velocityDelta)} vs prev half`;
  const velocityImproving = velocityDelta < 0;
  const velocityDaysValue = Math.round(currentHalfCompletionDays || avgCompletionVelocity);
  const peakMonth = monthly.slice().sort((a, b) => b.volume - a.volume)[0];
  const averageMonthlyRevenue = average(monthly.map((item) => item.netRevenue));
  const monthlyVolumeData = monthly.map((item) => ({
    key: item.key,
    label: item.monthLabel,
    count: item.volume,
  }));
  const monthlyCompletedData = monthlyCompletedVolume(periodData).map((item) => ({
    key: item.key,
    label: monthShortLabelFromKey(item.key),
    count: item.count,
  }));
  const volumeData = monthlyVolumeMetric === 'created' ? monthlyVolumeData : monthlyCompletedData;

  const positiveShift = mixShift.slice().sort((a, b) => b.shift - a.shift)[0];
  const negativeShift = mixShift.slice().sort((a, b) => a.shift - b.shift)[0];
  const caseMixAnnotation =
    positiveShift && negativeShift
      ? `${positiveShift.label} share is growing while ${negativeShift.label} share is declining based on the selected period.`
      : 'Mix change requires more period data.';
  const partialWeeks = new Set(
    weekly
      .filter((item, index) => (index === 0 || index === weekly.length - 1) && item.count < avgWeeklyVolume * 0.5)
      .map((item) => item.week),
  );

  return (
    <section className="mt-3">
      <PageHeader
        title="Trends"
        subtitle="Monthly and weekly trend views with case-mix and completion velocity shifts"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3">
        <KpiCard
          label={withTimeFrameLabel('Period volume', period)}
          value={formatNumber(totalVolume)}
          rightBadge={<span className={`text-xs font-medium ${trendToneClass(totalVolumeTrend.tone)}`}>{totalVolumeTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('Avg weekly volume', period)}
          value={formatNumber(avgWeeklyVolume)}
          rightBadge={
            <span className={`text-xs font-medium ${trendToneClass(avgWeeklyVolumeTrend.tone)}`}>{avgWeeklyVolumeTrend.text}</span>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Velocity trend direction', period)}
          value={
            <span>
              {velocityDaysValue}{' '}
              <span className="text-base font-medium text-acre-muted desktop-md:text-lg">days</span>
            </span>
          }
          valueClassName="flex items-baseline gap-1"
          rightBadge={
            <span
              className={`text-xs font-medium ${
                velocityDelta === 0 ? 'text-acre-muted' : velocityImproving ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {velocityTrendText}
            </span>
          }
          subtitle="Compared with previous half-period average"
          subtitleClassName="mt-1 text-xs text-acre-muted"
          meta={
            <p
              className={`text-xs font-medium ${
                velocityDelta === 0 ? 'text-acre-muted' : velocityDelta > 0 ? 'text-amber-700' : 'text-green-700'
              }`}
            >
              {velocityDelta === 0
                ? 'Completion speed is stable.'
                : velocityDelta > 0
                  ? 'Completion speed is slowing.'
                  : 'Completion speed is improving.'}
            </p>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Avg completion velocity', period)}
          value={formatDays(avgCompletionVelocity)}
          rightBadge={
            <span className={`text-xs font-medium ${trendToneClass(avgCompletionVelocityTrend.tone)}`}>
              {avgCompletionVelocityTrend.text}
            </span>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Peak month volume', period)}
          value={peakMonth ? formatNumber(peakMonth.volume) : '0'}
          subtitle={peakMonth ? `Month ${peakMonth.monthLabel}` : 'No data'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <VolumeChartCard
          title="Monthly volume"
          subtitle={monthlyVolumeMetric === 'created' ? 'Case creation by month in 2025' : 'Completed cases by month in 2025'}
          ariaLabel={monthlyVolumeMetric === 'created' ? 'Monthly created case volume chart' : 'Monthly completed case volume chart'}
          xAxisLabel="Month"
          data={volumeData}
          headerActions={
            <div className="inline-flex rounded-md border border-acre-border bg-acre-panel p-0.5" role="group" aria-label="Volume metric">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  monthlyVolumeMetric === 'created' ? 'bg-white text-acre-text shadow-sm' : 'text-acre-muted hover:text-acre-text'
                }`}
                onClick={() => setMonthlyVolumeMetric('created')}
                aria-pressed={monthlyVolumeMetric === 'created'}
              >
                Created
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  monthlyVolumeMetric === 'completed' ? 'bg-white text-acre-text shadow-sm' : 'text-acre-muted hover:text-acre-text'
                }`}
                onClick={() => setMonthlyVolumeMetric('completed')}
                aria-pressed={monthlyVolumeMetric === 'completed'}
              >
                Completed
              </button>
            </div>
          }
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Completion velocity over time</h3>
          <p className="mt-1 text-sm text-acre-muted">Average days from submission to completion by month</p>
          <div className="mt-4 h-[260px]" role="img" aria-label="Completion velocity line chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
              <LineChart
                data={monthly}
                margin={SHARED_CHART_MARGIN}
                onMouseMove={(state) => {
                  setActiveVelocityIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveVelocityIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="monthLabel"
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  tickMargin={10}
                  label={{ value: 'Month', position: 'bottom', offset: 10, fill: '#374151', fontSize: 12 }}
                />
                <YAxis
                  domain={[0, 'dataMax + 10']}
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  width={SHARED_Y_AXIS_WIDTH}
                  allowDecimals={false}
                  tickMargin={8}
                  label={{ value: 'Days', angle: -90, position: 'insideLeft', offset: 0, fill: '#374151', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => [formatDays(Number(value)), 'Completion time']}
                  contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                  itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="completionDays"
                  stroke="#3D4CF9"
                  strokeWidth={2}
                  strokeOpacity={activeVelocityIndex === null ? 1 : 0.6}
                  dot={{ r: 3, fill: '#3D4CF9', fillOpacity: 0.65 }}
                  activeDot={{ r: 5, fill: '#3D4CF9' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Net revenue trend</h3>
        <p className="mt-1 text-sm text-acre-muted">Monthly net case revenue across the platform</p>
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            <AreaChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis tickFormatter={(value) => formatCompactCurrency(Number(value))} />
              <ReferenceLine y={averageMonthlyRevenue} stroke="#3D4CF9" strokeDasharray="4 4" label={{ value: 'Period avg', position: 'right' }} />
              <Tooltip
                formatter={(value) => [formatCompactCurrency(Number(value)), 'Net revenue']}
                contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
              />
              <Area type="monotone" dataKey="netRevenue" stroke="#3D4CF9" fill="#3D4CF9" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Case mix shift"
          subtitle="How business mix changed across the year"
          rows={mixShift}
          otherDisclosure={{
            tooltip: OTHER_CASE_TYPE_TOOLTIP,
            expanded: !groupOtherCaseTypes,
            onToggle: () => setGroupOtherCaseTypes((current) => !current),
          }}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Weekly volume trend</h3>
          <p className="mt-1 text-sm text-acre-muted">Last 4 weeks in period (or fewer if unavailable)</p>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-acre-border text-left text-acre-muted">
                  <th className="py-2 pr-4 font-medium">Week</th>
                  <th className="py-2 pr-4 font-medium">Volume</th>
                  <th className="py-2 pr-4 font-medium">Share of period</th>
                  <th className="py-2 pr-4 font-medium">% change vs previous week</th>
                </tr>
              </thead>
              <tbody>
                {weekly.slice(-4).map((item) => (
                  <tr
                    key={item.week}
                    className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                      selectedWeek === item.week ? 'bg-gray-200' : ''
                    } ${partialWeeks.has(item.week) ? 'text-acre-muted' : ''}`}
                    onClick={() => setSelectedWeek(item.week)}
                  >
                    <td className="py-2 pr-4 text-acre-text">{partialWeeks.has(item.week) ? `${item.week} *` : item.week}</td>
                    <td className="py-2 pr-4 text-acre-text">{formatNumber(item.count)}</td>
                    <td className="py-2 pr-4 text-acre-purple">
                      {formatPercentage(totalVolume ? item.count / totalVolume : 0)}
                    </td>
                    <td
                      className={`py-2 pr-4 ${
                        item.wowChange === null ? 'text-acre-muted' : item.wowChange > 0 ? 'text-amber-700' : item.wowChange < 0 ? 'text-green-700' : 'text-acre-muted'
                      }`}
                    >
                      {item.wowChange === null ? '—' : formatPercentage(item.wowChange, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-acre-muted">* Partial week - may not reflect full trading activity.</p>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-acre-panel p-4">
        <p className="text-sm text-acre-muted">{caseMixAnnotation}</p>
      </section>
    </section>
  );
}

