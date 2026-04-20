import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import type { FunnelMode, MarketStats, MortgageCase, TimePeriod } from '../../types/mortgage';
import { OTHER_CASE_TYPE_TOOLTIP, toPipelineStage } from '../../utils/constants';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercentage, formatSignedDaysDelta } from '../../utils/formatters';
import { caseTypeBreakdown, computeMarketStats, filterByPeriod, monthlyCompletedVolume } from '../../utils/aggregations';
import { priorPeriod, resolvePeriodBounds } from '../../utils/dateUtils';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { FunnelPanel } from '../shared/FunnelPanel';
import { VolumeChartCard } from '../shared/VolumeChartCard';
import { AppTooltip } from '../shared/AppTooltip';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DROP_OFF_REASON_RECOMMENDATIONS: Record<string, string> = {
  NO_RESPONSE: 'Attempt multi-channel re-contact and time-box closure if no reply.',
  CLIENT_DECLINED_PRODUCT: 'Schedule a product-fit review with revised options and affordability scenarios.',
  CLIENT_NO_LONGER_REQUIRES_PRODUCT: 'Confirm objectives have changed and close with a clear reason and re-contact trigger date.',
  CLIENT_OBTAINED_PRODUCT_ELSEWHERE: 'Capture competitor outcome and run a short loss review to improve earlier positioning.',
  INCORRECT_CONTACT_DETAILS: 'Verify contact details through an alternate channel before case closure.',
  DUPLICATE_CASE: 'Merge duplicate records, keep one active owner, and close the extra case with a linked reference.',
  NO_PRODUCT_AVAILABLE: 'Re-check sourcing criteria and provide alternate products that fit key requirements.',
  PROPERTY_NOT_FOUND: 'Confirm property details and coordinate with lender support to unblock valuation lookup.',
  ADVERSE_CREDIT: 'Review credit file issues and route to adverse-friendly options with a specialist broker.',
  FEE_CONCERNS: 'Share a transparent cost breakdown and discuss lower-fee structures or payment options.',
  LENDER_DECLINED_APPLICATION: 'Review decline reasons quickly and pivot to suitable lenders with revised packaging.',
  INVALID_CANCELLATION_REASON: 'Correct the cancellation code and capture accurate closure notes before finalising the case.',
  OTHER: 'Capture detailed context and route to a manager for manual review.',
  UNKNOWN: 'Run a quick triage and add a clear reason code before final closure.',
};
const GROUPED_OTHER_REASON_KEYS = new Set<string>([
  'INCORRECT_CONTACT_DETAILS',
  'NO_PRODUCT_AVAILABLE',
  'PROPERTY_NOT_FOUND',
  'ADVERSE_CREDIT',
  'FEE_CONCERNS',
  'LENDER_DECLINED_APPLICATION',
  'OTHER',
]);

interface DropOffRow {
  reasonKey: string;
  label: string;
  count: number;
  totalNotProceeding: number;
  revenueAtRisk: number;
  recommendation: string;
}

function toMonthLabel(month: string): string {
  const index = Number(month) - 1;
  return MONTH_ABBR[index] ?? month;
}

function buildMarketShareRows(periodData: MortgageCase[]) {
  const completed = periodData.filter((row) => toPipelineStage(row.caseStatus) === 'COMPLETION');
  const total = Math.max(completed.length, 1);
  const counts = new Map<string, number>();
  for (const row of completed) {
    counts.set(row.lender, (counts.get(row.lender) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([lender, count]) => ({ lender, count, percentage: count / total }))
    .sort((a, b) => b.count - a.count);
}

function toTitleCaseLabel(reason: string): string {
  return reason
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildDropOffRows(periodData: MortgageCase[]) {
  const notProceedingRows = periodData.filter((row) => row.caseStatus === 'NOT_PROCEEDING');
  const totalNotProceeding = notProceedingRows.length;
  const counts = new Map<string, number>();
  const revenueTotals = new Map<string, number>();

  for (const row of notProceedingRows) {
    const reasonKey = row.notProceedingReason ?? 'UNKNOWN';
    counts.set(reasonKey, (counts.get(reasonKey) ?? 0) + 1);
    revenueTotals.set(reasonKey, (revenueTotals.get(reasonKey) ?? 0) + Math.max(0, row.totalCaseRevenue ?? 0));
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reasonKey, count]) => {
      const revenueAtRisk = revenueTotals.get(reasonKey) ?? 0;
      return {
        reasonKey,
        label: toTitleCaseLabel(reasonKey),
        count,
        totalNotProceeding,
        revenueAtRisk,
        recommendation:
          DROP_OFF_REASON_RECOMMENDATIONS[reasonKey] ??
          'Run a quick triage and assign a concrete follow-up owner before closure.',
      };
    });
}

function groupDropOffRows(rows: DropOffRow[]) {
  let groupedCount = 0;
  let groupedRevenue = 0;
  let totalNotProceeding = 0;
  const groupedRows: DropOffRow[] = [];
  for (const row of rows) {
    totalNotProceeding = row.totalNotProceeding;
    if (GROUPED_OTHER_REASON_KEYS.has(row.reasonKey)) {
      groupedCount += row.count;
      groupedRevenue += row.revenueAtRisk;
      continue;
    }
    groupedRows.push(row);
  }
  if (groupedCount > 0) {
    groupedRows.push({
      reasonKey: 'OTHER_GROUPED',
      label: 'Other',
      count: groupedCount,
      totalNotProceeding,
      revenueAtRisk: groupedRevenue,
      recommendation: DROP_OFF_REASON_RECOMMENDATIONS.OTHER,
    });
  }
  return groupedRows.sort((a, b) => b.count - a.count);
}

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
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

function buildVolumeTrendBadge(
  current: number,
  previous: number | null,
  period: TimePeriod,
): { text: string; tone: 'muted' | 'positive' | 'negative' } {
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
    text: `${delta > 0 ? '↑' : '↓'} ${delta > 0 ? '+' : ''}${formatPercentage(delta, 1)} vs prev period`,
    tone: delta > 0 ? 'positive' : 'negative',
  };
}

function buildDaysTrendBadge(
  current: number,
  previous: number | null,
  period: TimePeriod,
): { text: string; tone: 'muted' | 'positive' | 'negative' } {
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

export function InternalDashboard({
  stats,
  period,
  periodData,
  allRows,
  typicalLifecycleDays = null,
}: {
  stats: MarketStats;
  period: TimePeriod;
  periodData: MortgageCase[];
  allRows: MortgageCase[];
  typicalLifecycleDays?: number | null;
}) {
  const [activeMarketShareLender, setActiveMarketShareLender] = useState<string | null>(null);
  const [showAllMarketShare, setShowAllMarketShare] = useState(false);
  const [activeDropOffReason, setActiveDropOffReason] = useState<string | null>(null);
  const [groupOtherDropOffReasons, setGroupOtherDropOffReasons] = useState(true);
  const [monthlyVolumeMetric, setMonthlyVolumeMetric] = useState<'created' | 'completed'>('created');
  const [funnelMode, setFunnelMode] = useState<FunnelMode | undefined>(undefined);
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);

  const isShortCustomRange =
    period.type === 'custom' && period.start && period.end && differenceInCalendarDays(period.end, period.start) + 1 <= 31;
  const showDailyVolume = period.type === 'this_month' || isShortCustomRange;
  const fullMarketShareRows = useMemo(() => buildMarketShareRows(periodData), [periodData]);
  const marketShareRows = showAllMarketShare ? fullMarketShareRows : fullMarketShareRows.slice(0, 5);
  const dropOffRows = useMemo(() => buildDropOffRows(periodData), [periodData]);
  const groupedDropOffRows = useMemo(() => groupDropOffRows(dropOffRows), [dropOffRows]);
  const displayDropOffRows = groupOtherDropOffReasons ? groupedDropOffRows : dropOffRows;
  const hasGroupableDropOffReasons = dropOffRows.some((row) => GROUPED_OTHER_REASON_KEYS.has(row.reasonKey));
  const groupedDropOffReasonLabels = useMemo(
    () =>
      [...GROUPED_OTHER_REASON_KEYS]
        .filter((reasonKey) => reasonKey !== 'OTHER')
        .map((reasonKey) => toTitleCaseLabel(reasonKey))
        .join(', '),
    [],
  );
  const monthlyCreatedData = useMemo(
    () =>
      stats.monthlyVolume.map((row) => ({
        key: row.key,
        label: toMonthLabel(row.month),
        count: row.count,
      })),
    [stats.monthlyVolume],
  );
  const monthlyCompletedData = useMemo(
    () =>
      monthlyCompletedVolume(periodData).map((row) => ({
        key: row.key,
        label: toMonthLabel(row.month),
        count: row.count,
      })),
    [periodData],
  );
  const dailyData = useMemo(
    () =>
      stats.dailyVolume.map((row) => ({
        key: row.key,
        label: format(new Date(`${row.key}T00:00:00`), 'd MMM'),
        count: row.count,
      })),
    [stats.dailyVolume],
  );
  const monthlyData = monthlyVolumeMetric === 'created' ? monthlyCreatedData : monthlyCompletedData;
  const volumeData = showDailyVolume ? dailyData : monthlyData;
  const caseMixRows = useMemo(
    () =>
      caseTypeBreakdown(periodData, groupOtherCaseTypes).map((row) => ({
        label: row.label,
        value: `${formatPercentage(row.percentage, 1)} | (${formatNumber(row.count)})`,
        percentage: row.percentage,
        casesCount: row.count,
      })),
    [groupOtherCaseTypes, periodData],
  );
  const totalNetRevenue = periodData.reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);
  const completedRows = periodData.filter((row) => row.caseStatus === 'EXCHANGE' || row.caseStatus === 'COMPLETE');
  const totalCompletedLoanValue = completedRows.reduce((sum, row) => sum + Math.max(0, row.mortgageAmount ?? 0), 0);
  const completedRevenue = completedRows.reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);
  const averageNetRevenuePerCompletedCase = completedRows.length > 0 ? completedRevenue / completedRows.length : 0;
  const completionRate = stats.totalCases > 0 ? stats.completedCases / stats.totalCases : 0;
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
  const dateRange = resolvePeriodBounds(period, latestCreatedAt ?? undefined);
  const previousPeriodData = previousPeriod ? filterByPeriod(allRows, previousPeriod) : [];
  const previousStats = previousPeriodData.length > 0 ? computeMarketStats(previousPeriodData) : null;
  const previousCompletedRows = previousPeriodData.filter((row) => row.caseStatus === 'EXCHANGE' || row.caseStatus === 'COMPLETE');
  const previousTotalCompletedLoanValue =
    previousCompletedRows.length > 0
      ? previousCompletedRows.reduce((sum, row) => sum + Math.max(0, row.mortgageAmount ?? 0), 0)
      : null;
  const previousTotalRevenue =
    previousPeriodData.length > 0
      ? previousPeriodData.reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0)
      : null;
  const previousCompletedRevenue = previousCompletedRows.reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);
  const previousAverageNetRevenuePerCompletedCase =
    previousCompletedRows.length > 0 ? previousCompletedRevenue / previousCompletedRows.length : null;
  const previousAvgCompletionDays =
    previousStats && Number.isFinite(previousStats.avgCompletionDays) ? previousStats.avgCompletionDays : null;

  const totalCasesTrend = buildVolumeTrendBadge(stats.totalCases, previousStats?.totalCases ?? null, period);
  const totalCompletedLoanValueTrend = buildVolumeTrendBadge(
    totalCompletedLoanValue,
    previousTotalCompletedLoanValue,
    period,
  );
  const completedCasesTrend = buildVolumeTrendBadge(stats.completedCases, previousStats?.completedCases ?? null, period);
  const totalRevenueTrend = buildVolumeTrendBadge(totalNetRevenue, previousTotalRevenue, period);
  const averageRevenueTrend = buildVolumeTrendBadge(
    averageNetRevenuePerCompletedCase,
    previousAverageNetRevenuePerCompletedCase,
    period,
  );
  const avgCompletionDaysTrend = buildDaysTrendBadge(stats.avgCompletionDays || 0, previousAvgCompletionDays, period);
  const now = new Date(2025, 11, 31);
  const submittedRows = periodData.filter((row) => toPipelineStage(row.caseStatus) === 'APPLICATION');
  const submittedAges = submittedRows
    .map((row) => {
      const submittedAt = row.lastSubmittedDate ?? row.firstSubmittedDate;
      if (!submittedAt) {
        return null;
      }
      return Math.max(0, differenceInCalendarDays(now, submittedAt));
    })
    .filter((value): value is number => value !== null);
  const stallThreshold = median(submittedAges);
  const stalledSubmittedRows = submittedRows.filter((row) => {
    const submittedAt = row.lastSubmittedDate ?? row.firstSubmittedDate;
    if (!submittedAt) {
      return false;
    }
    return Math.max(0, differenceInCalendarDays(now, submittedAt)) > stallThreshold;
  });
  const stalledRevenueAtRisk = stalledSubmittedRows.reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);

  if (stats.totalCases === 0) {
    return <EmptyState title="No market data in this period" description="Try selecting a wider date range in the time filter." />;
  }

  return (
    <section className="mt-3">
      <PageHeader title="Market overview" subtitle="Platform-wide activity across all lenders" />
      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3 desktop-lg:grid-cols-6">
        <KpiCard
          label={withTimeFrameLabel('Total cases', period)}
          value={formatNumber(stats.totalCases)}
          rightBadge={<span className={`text-xs font-medium ${trendToneClass(totalCasesTrend.tone)}`}>{totalCasesTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('Total completed loan value', period)}
          value={formatCompactCurrency(totalCompletedLoanValue)}
          rightBadge={
            <span className={`text-xs font-medium ${trendToneClass(totalCompletedLoanValueTrend.tone)}`}>
              {totalCompletedLoanValueTrend.text}
            </span>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Completed cases', period)}
          value={formatNumber(stats.completedCases)}
          rightBadge={
            <span className={`text-xs font-medium ${trendToneClass(completedCasesTrend.tone)}`}>{completedCasesTrend.text}</span>
          }
          subtitle={`Completion rate: ${formatPercentage(completionRate)}`}
        />
        <KpiCard
          label={withTimeFrameLabel('Total revenue', period)}
          value={formatCompactCurrency(totalNetRevenue)}
          rightBadge={<span className={`text-xs font-medium ${trendToneClass(totalRevenueTrend.tone)}`}>{totalRevenueTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('Avg net revenue per completed case', period)}
          value={formatCompactCurrency(averageNetRevenuePerCompletedCase)}
          rightBadge={<span className={`text-xs font-medium ${trendToneClass(averageRevenueTrend.tone)}`}>{averageRevenueTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('Avg completion days', period)}
          value={String(Math.round(stats.avgCompletionDays || 0))}
          subtitle={`Avg days to offer: ${Math.round(stats.avgDaysToOffer || 0)}`}
          rightBadge={
            <span className={`text-xs font-medium ${trendToneClass(avgCompletionDaysTrend.tone)}`}>
              {avgCompletionDaysTrend.text}
            </span>
          }
        />
      </div>

      <div className="mt-6">
        <VolumeChartCard
          title={showDailyVolume ? 'Daily volume' : 'Monthly volume'}
          subtitle={
            showDailyVolume
              ? 'Case creation by day in selected period'
              : monthlyVolumeMetric === 'created'
                ? 'Case creation by month in 2025'
                : 'Completed cases by month in 2025'
          }
          ariaLabel={
            showDailyVolume
              ? 'Daily case volume chart'
              : monthlyVolumeMetric === 'created'
                ? 'Monthly created case volume chart'
                : 'Monthly completed case volume chart'
          }
          xAxisLabel={showDailyVolume ? 'Day' : 'Month'}
          data={volumeData}
          headerActions={
            !showDailyVolume ? (
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
            ) : null
          }
        />
      </div>

      <div className="mt-4">
        <FunnelPanel
          cases={periodData}
          title="Pipeline funnel"
          scope="internal"
          mode={funnelMode}
          onModeChange={setFunnelMode}
          dateRange={dateRange}
          typicalLifecycleDays={typicalLifecycleDays}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Cases by type"
          subtitle="Share of all cases"
          rows={caseMixRows}
          valueColumnPx={128}
          singleLineValue
          otherDisclosure={{
            tooltip: OTHER_CASE_TYPE_TOOLTIP,
            expanded: !groupOtherCaseTypes,
            onToggle: () => setGroupOtherCaseTypes((current) => !current),
          }}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Market share (completed cases)</h3>
          <p className="mt-1 text-sm text-acre-muted">Top lenders by completed case share</p>
          <div className={`mt-5 space-y-3 overflow-hidden transition-all duration-300 ${showAllMarketShare ? 'max-h-[720px]' : 'max-h-[220px]'}`}>
            {marketShareRows.map((row) => (
              <AppTooltip
                key={row.lender}
                content={`${row.lender}: ${formatPercentage(row.percentage)} | (${formatNumber(row.count)})`}
                wrapperClassName="!block w-full"
                side="bottom"
              >
                <div
                  className={`relative grid items-center gap-3 rounded-md text-sm transition ${
                    activeMarketShareLender && activeMarketShareLender !== row.lender ? 'opacity-45' : 'opacity-100'
                  }`}
                  style={{ gridTemplateColumns: '220px minmax(0, 1fr) 128px' }}
                  onMouseEnter={() => setActiveMarketShareLender(row.lender)}
                  onMouseLeave={() => setActiveMarketShareLender(null)}
                  onFocus={() => setActiveMarketShareLender(row.lender)}
                  onBlur={() => setActiveMarketShareLender(null)}
                  tabIndex={0}
                >
                  <span className="whitespace-nowrap text-acre-text">{row.lender}</span>
                  <div className="h-4 rounded-full bg-acre-panel">
                    <div className="h-4 rounded-full bg-acre-purple" style={{ width: `${Math.round(row.percentage * 100)}%` }} />
                  </div>
                  <span className="whitespace-nowrap text-right text-acre-muted">{`${formatPercentage(row.percentage)} | (${formatNumber(row.count)})`}</span>
                  <span className="sr-only">
                    {row.lender}: {formatPercentage(row.percentage)} | ({formatNumber(row.count)})
                  </span>
                </div>
              </AppTooltip>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 text-sm font-medium text-acre-purple underline-offset-2 hover:underline"
            onClick={() => setShowAllMarketShare((current) => !current)}
          >
            {showAllMarketShare ? 'Show less' : 'See more'}
          </button>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="LTV distribution"
          subtitle="Share of cases by LTV band"
          rows={stats.ltvDistribution.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}% | (${formatNumber(row.count)})`,
            percentage: row.percentage,
            casesCount: row.count,
          }))}
          valueColumnPx={128}
          singleLineValue
        />
        <HorizontalDistribution
          title="Mortgage amount distribution"
          subtitle="Share of cases by loan size band"
          rows={stats.mortgageAmountDistribution.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}% | (${formatNumber(row.count)})`,
            percentage: row.percentage,
            casesCount: row.count,
          }))}
          valueColumnPx={128}
          singleLineValue
        />
      </div>

      <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
        <p className="text-sm font-semibold text-amber-900">
          {formatCurrency(stalledRevenueAtRisk)} of revenue is at risk from {formatNumber(stalledSubmittedRows.length)} stalled submitted
          {' '}
          {stalledSubmittedRows.length === 1 ? 'case' : 'cases'}
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Drop-off reasons</h3>
        <p className="mt-1 text-sm text-acre-muted">Top not proceeding reasons with recommended follow-up actions</p>
        <div
          className="mt-5 mb-2 hidden items-end gap-2 border-b border-acre-border pb-2 text-xs font-semibold uppercase tracking-wide text-acre-muted desktop-md:grid"
          style={{ gridTemplateColumns: 'minmax(220px, 280px) 210px 200px minmax(420px, 1fr)' }}
        >
          <span>Drop-off reason</span>
          <span>Share of drop-offs</span>
          <span className="text-right desktop-md:pr-8">Revenue at risk</span>
          <span className="desktop-md:pl-10">Recommended Follow Up Actions</span>
        </div>
        <div className="mt-3 space-y-3">
          {(displayDropOffRows.length
            ? displayDropOffRows
            : [{ reasonKey: 'BLANK', label: 'Blank', count: 0, totalNotProceeding: 0, revenueAtRisk: 0, recommendation: 'No drop-off reasons found in this period.' }]).map((row) => (
            (() => {
              const percentage = row.totalNotProceeding > 0 ? row.count / row.totalNotProceeding : 0;
              const value = `${formatPercentage(percentage, 1)} | ${formatCurrency(row.revenueAtRisk)} revenue at risk`;
              const showGroupedOtherTooltip = groupOtherDropOffReasons && row.reasonKey === 'OTHER_GROUPED';
              return (
            <AppTooltip
              key={row.reasonKey}
              content={`${row.label}: ${value}`}
              wrapperClassName="!block w-full"
              side="bottom"
            >
              <div
                className={`relative grid gap-2 rounded-md text-sm transition desktop-md:items-start ${
                  activeDropOffReason && activeDropOffReason !== row.reasonKey ? 'opacity-45' : 'opacity-100'
                }`}
                style={{ gridTemplateColumns: 'minmax(220px, 280px) 210px 200px minmax(420px, 1fr)' }}
                onMouseEnter={() => setActiveDropOffReason(row.reasonKey)}
                onMouseLeave={() => setActiveDropOffReason(null)}
                onFocus={() => setActiveDropOffReason(row.reasonKey)}
                onBlur={() => setActiveDropOffReason(null)}
                tabIndex={0}
              >
                <span className="text-acre-text desktop-md:pr-2">
                  {showGroupedOtherTooltip ? (
                    <AppTooltip
                      content={`Other includes: ${groupedDropOffReasonLabels}.`}
                      side="bottom"
                    >
                      <span className="cursor-help underline decoration-dotted underline-offset-2">{row.label}</span>
                    </AppTooltip>
                  ) : (
                    row.label
                  )}
                </span>
                <div className="relative h-4 rounded-full bg-acre-panel desktop-md:mr-2 desktop-md:mt-1">
                  <div
                    className="h-4 rounded-full bg-[#E24B4A]"
                    style={{ width: `${(percentage * 100).toFixed(1)}%` }}
                  />
                </div>
                <span className="text-right whitespace-nowrap text-acre-muted desktop-md:mt-0.5 desktop-md:pr-8">{value}</span>
                <span className="text-acre-muted desktop-md:pl-10">{row.recommendation}</span>
              </div>
            </AppTooltip>
              );
            })()
          ))}
        </div>
        {hasGroupableDropOffReasons ? (
          <button
            type="button"
            className="mt-4 text-sm font-medium text-acre-purple underline-offset-2 hover:underline"
            onClick={() => setGroupOtherDropOffReasons((current) => !current)}
          >
            {groupOtherDropOffReasons ? 'Expand Other' : 'Group Other'}
          </button>
        ) : null}
      </section>
    </section>
  );
}
