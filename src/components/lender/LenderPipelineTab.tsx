import { Fragment, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { FunnelMode, MarketStats, MortgageCase, TimePeriod } from '../../types/mortgage';
import { computeConversionVelocityRanking, computeNotProceedingRate, monthlySubmissionToOfferDays } from '../../utils/aggregations';
import { CASE_TYPE_LABELS, toPipelineStage } from '../../utils/constants';
import { formatCurrency, formatDirectionalDaysVsMarket, formatDays, formatPercentage } from '../../utils/formatters';
import { monthLabelFromKey, resolvePeriodBounds } from '../../utils/dateUtils';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { FunnelPanel } from '../shared/FunnelPanel';
import { AppTooltip } from '../shared/AppTooltip';
import {
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
} from '../shared/tooltipStyles';

interface LenderPipelineTabProps {
  periodData: MortgageCase[];
  selectedLender: string;
  marketStats: MarketStats;
  period: TimePeriod;
  typicalLifecycleDays?: number | null;
}

type StalledSortField = 'caseId' | 'daysStalled' | 'caseType' | 'mortgageAmount' | 'revenueAtRisk';

const DROP_OFF_REASON_RECOMMENDATIONS: Record<string, string> = {
  NO_RESPONSE: 'Attempt multi-channel re-contact and set a clear close-by date if no reply.',
  CLIENT_DECLINED_PRODUCT: 'Arrange a product-fit review with updated affordability and options.',
  CLIENT_OBTAINED_PRODUCT_ELSEWHERE: 'Run a quick loss review and share competitive alternatives sooner.',
  INCORRECT_CONTACT_DETAILS: 'Confirm and update contact details, then retry outreach with a named owner.',
  NO_PRODUCT_AVAILABLE: 'Re-run criteria with broadened options and present nearest-fit alternatives quickly.',
  LENDER_DECLINED_APPLICATION: 'Review decline drivers and route to an underwriter for salvage assessment.',
  PROPERTY_NOT_FOUND: 'Reconfirm property search criteria and provide guided next-property support.',
  ADVERSE_CREDIT: 'Check adverse credit drivers and route to specialist lenders with realistic next steps.',
  FEE_CONCERNS: 'Break down fee value transparently and offer staged or lower-cost options where possible.',
  OTHER: 'Capture missing context and assign a named owner for follow-up before closure.',
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

interface DropOffReasonRow {
  reasonKey: string;
  label: string;
  count: number;
  totalNotProceeding: number;
  percentage: number;
  value: string;
  revenueAtRisk: number;
  recommendation: string;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function toTitleCaseLabel(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function topDropOffReasons(rows: MortgageCase[]): DropOffReasonRow[] {
  const counts = new Map<string, number>();
  const revenueTotals = new Map<string, number>();
  const notProceedingRows = rows.filter((row) => toPipelineStage(row.caseStatus) === 'NOT_PROCEEDING');
  for (const row of notProceedingRows) {
    const key = row.notProceedingReason ?? 'OTHER';
    counts.set(key, (counts.get(key) ?? 0) + 1);
    revenueTotals.set(key, (revenueTotals.get(key) ?? 0) + Math.max(0, row.totalCaseRevenue ?? 0));
  }
  const total = Math.max(notProceedingRows.length, 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reasonKey, count]) => ({
      reasonKey,
      label: toTitleCaseLabel(reasonKey),
      count,
      totalNotProceeding: total,
      percentage: count / total,
      value: formatPercentage(count / total, 1),
      revenueAtRisk: revenueTotals.get(reasonKey) ?? 0,
      recommendation:
        DROP_OFF_REASON_RECOMMENDATIONS[reasonKey] ??
        'Run a quick triage and assign a concrete follow-up owner before closure.',
    }));
}

function groupDropOffReasonRows(rows: DropOffReasonRow[]): DropOffReasonRow[] {
  let groupedCount = 0;
  let groupedRevenue = 0;
  let totalNotProceeding = 1;
  const groupedRows: DropOffReasonRow[] = [];
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
    const percentage = groupedCount / totalNotProceeding;
    groupedRows.push({
      reasonKey: 'OTHER_GROUPED',
      label: 'Other',
      count: groupedCount,
      totalNotProceeding,
      percentage,
      value: formatPercentage(percentage, 1),
      revenueAtRisk: groupedRevenue,
      recommendation: DROP_OFF_REASON_RECOMMENDATIONS.OTHER,
    });
  }
  return groupedRows.sort((a, b) => b.count - a.count);
}

function stalledRows(rows: MortgageCase[], marketMedianDaysToOffer: number) {
  const now = new Date(2025, 11, 31);
  return rows
    .filter((row) => toPipelineStage(row.caseStatus) === 'APPLICATION')
    .map((row) => {
      const daysStalled = daysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now) ?? 0;
      return {
        caseId: row.caseId,
        daysStalled,
        stallStartDate: row.lastSubmittedDate ?? row.firstSubmittedDate,
        caseType: CASE_TYPE_LABELS[row.caseType] ?? 'Other',
        mortgageAmount: row.mortgageAmount ?? 0,
        revenueAtRisk: row.totalCaseRevenue ?? 0,
        timeline: {
          created: row.createdAt,
          recommended: row.recommendationDate ?? null,
          submitted: row.firstSubmittedDate,
          offer: row.firstOfferDate,
          complete: row.completionDate,
        },
      };
    })
    .filter((row) => row.daysStalled > marketMedianDaysToOffer)
    .sort((a, b) => b.daysStalled - a.daysStalled)
    .slice(0, 10);
}

function truncateCaseId(caseId: string): string {
  return caseId.length > 8 ? `${caseId.slice(0, 8)}...` : caseId;
}

function copyToClipboard(value: string) {
  void navigator.clipboard?.writeText(value);
}

function urgencyLabel(daysStalled: number): { dot: string; text: string } {
  if (daysStalled >= 91) {
    return { dot: 'bg-red-600', text: 'Critical' };
  }
  if (daysStalled >= 31) {
    return { dot: 'bg-amber-500', text: 'Watch' };
  }
  return { dot: 'bg-transparent', text: '' };
}

export function LenderPipelineTab({
  periodData,
  selectedLender,
  marketStats,
  period,
  typicalLifecycleDays = null,
}: LenderPipelineTabProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [stalledSortField, setStalledSortField] = useState<StalledSortField>('daysStalled');
  const [stalledSortDirection, setStalledSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeDropOffReason, setActiveDropOffReason] = useState<string | null>(null);
  const [groupOtherDropOffReasons, setGroupOtherDropOffReasons] = useState(true);
  const [funnelMode, setFunnelMode] = useState<FunnelMode | undefined>(undefined);
  const [activeTimelineIndex, setActiveTimelineIndex] = useState<number | null>(null);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (lenderRows.length === 0) {
    return <EmptyState title="No pipeline data for selected lender" />;
  }
  const latestCreatedAt = lenderRows.reduce<Date | null>((latest, row) => {
    if (!row.createdAt) {
      return latest;
    }
    if (!latest || row.createdAt.getTime() > latest.getTime()) {
      return row.createdAt;
    }
    return latest;
  }, null);
  const dateRange = resolvePeriodBounds(period, latestCreatedAt ?? undefined);

  const submittedToOfferDays = lenderRows
    .map((row) => daysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((value): value is number => value !== null);
  const offerToCompleteDays = lenderRows
    .map((row) => daysBetween(row.firstOfferDate, row.completionDate))
    .filter((value): value is number => value !== null);
  const notProceedingRate = computeNotProceedingRate(lenderRows);
  const marketNotProceedingRate = computeNotProceedingRate(periodData);
  const conversionRank = computeConversionVelocityRanking(periodData, selectedLender);
  const lenderTimeline = monthlySubmissionToOfferDays(lenderRows);
  const marketTimeline = monthlySubmissionToOfferDays(periodData);
  const lenderTimelineMap = new Map(lenderTimeline.map((row) => [row.key, row.avgDays]));
  const marketTimelineMap = new Map(marketTimeline.map((row) => [row.key, row.avgDays]));
  const timelineData = [...new Set([...marketTimelineMap.keys(), ...lenderTimelineMap.keys()])]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      month: monthLabelFromKey(key),
      lenderAvgDays: lenderTimelineMap.get(key) ?? null,
      marketAvgDays: marketTimelineMap.get(key) ?? null,
    }));

  const marketMedianDaysToOffer = Math.max(1, Math.round(marketStats.avgDaysToOffer));
  const stalled = stalledRows(lenderRows, marketMedianDaysToOffer);
  const sortedStalled = stalled.slice().sort((a, b) => {
    const direction = stalledSortDirection === 'desc' ? 1 : -1;
    if (stalledSortField === 'caseId') {
      return direction * b.caseId.localeCompare(a.caseId, 'en-GB');
    }
    if (stalledSortField === 'caseType') {
      return direction * b.caseType.localeCompare(a.caseType, 'en-GB');
    }
    if (stalledSortField === 'mortgageAmount') {
      return direction * (b.mortgageAmount - a.mortgageAmount);
    }
    if (stalledSortField === 'revenueAtRisk') {
      return direction * (b.revenueAtRisk - a.revenueAtRisk);
    }
    return direction * (b.daysStalled - a.daysStalled);
  });
  const dropOffRowsLender = topDropOffReasons(lenderRows);
  const dropOffRowsMarket = topDropOffReasons(periodData);
  const displayedDropOffRowsLender = groupOtherDropOffReasons ? groupDropOffReasonRows(dropOffRowsLender) : dropOffRowsLender;
  const displayedDropOffRowsMarket = groupOtherDropOffReasons ? groupDropOffReasonRows(dropOffRowsMarket) : dropOffRowsMarket;
  const hasGroupableDropOffReasons = dropOffRowsLender.some((row) => GROUPED_OTHER_REASON_KEYS.has(row.reasonKey));
  const groupedDropOffReasonLabels = [...GROUPED_OTHER_REASON_KEYS]
    .filter((reasonKey) => reasonKey !== 'OTHER')
    .map((reasonKey) => toTitleCaseLabel(reasonKey))
    .join(', ');
  const dropOffRows = dropOffRowsLender.length
    ? displayedDropOffRowsLender.map((row) => {
        const marketRow = displayedDropOffRowsMarket.find((candidate) => candidate.reasonKey === row.reasonKey);
        return {
          ...row,
          marketPercentage: marketRow?.percentage ?? 0,
          marketValue: marketRow?.value ?? '0.0%',
        };
      })
    : [
        {
          reasonKey: 'OTHER',
          label: 'Other',
          count: 0,
          totalNotProceeding: 1,
          percentage: 0,
          value: '0.0%',
          revenueAtRisk: 0,
          marketPercentage: 0,
          marketValue: '0.0%',
          recommendation: 'No drop-off reasons found in this period.',
        },
      ];
  function toggleStalledSort(next: StalledSortField) {
    if (stalledSortField === next) {
      setStalledSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setStalledSortField(next);
    setStalledSortDirection('desc');
  }

  function sortMarker(field: StalledSortField): string {
    if (stalledSortField !== field) {
      return '↕';
    }
    return stalledSortDirection === 'desc' ? '↓' : '↑';
  }

  function ariaSortValue(field: StalledSortField): 'none' | 'ascending' | 'descending' {
    if (stalledSortField !== field) {
      return 'none';
    }
    return stalledSortDirection === 'desc' ? 'descending' : 'ascending';
  }

  return (
    <section className="mt-3">
      <PageHeader
        title="Pipeline"
        subtitle={`Pipeline speed and drop-off analysis for ${selectedLender}`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3">
        <KpiCard
          label={withTimeFrameLabel('Submission to offer speed', period)}
          value={formatDays(average(submittedToOfferDays))}
          subtitle={`Market avg: ${formatDays(marketStats.avgDaysToOffer)}`}
          meta={
            <AppTooltip content={`Rank ${conversionRank.rank} of ${conversionRank.total} lenders by this metric.`}>
              <p
                className={`text-xs font-medium ${
                  average(submittedToOfferDays) <= marketStats.avgDaysToOffer ? 'text-green-700' : 'text-amber-700'
                }`}
              >
                {formatDirectionalDaysVsMarket(average(submittedToOfferDays) - marketStats.avgDaysToOffer)}
              </p>
            </AppTooltip>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Offer to complete speed', period)}
          value={formatDays(average(offerToCompleteDays))}
          subtitle={`Market avg: ${formatDays(marketStats.avgDaysToComplete)}`}
          meta={
            <p
              className={`text-xs font-medium ${
                average(offerToCompleteDays) <= marketStats.avgDaysToComplete ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {formatDirectionalDaysVsMarket(average(offerToCompleteDays) - marketStats.avgDaysToComplete)}
            </p>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Not proceeding rate', period)}
          value={formatPercentage(notProceedingRate)}
          subtitle={`Market avg: ${formatPercentage(marketNotProceedingRate)}`}
        />
      </div>

      <div className="mt-6">
        <FunnelPanel
          cases={lenderRows}
          title="Pipeline funnel"
          scope="lender"
          mode={funnelMode}
          onModeChange={setFunnelMode}
          dateRange={dateRange}
          typicalLifecycleDays={typicalLifecycleDays}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Drop-off reasons</h3>
        <p className="mt-1 text-sm text-acre-muted">Top reasons for not proceeding with recommended follow-up actions</p>
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
          {dropOffRows.map((row) => (
            <AppTooltip
              key={row.reasonKey}
              content={`${row.label}: ${row.value} | Market: ${row.marketValue}`}
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
                  {groupOtherDropOffReasons && row.reasonKey === 'OTHER_GROUPED' ? (
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
                <div className="desktop-md:mr-2">
                  <div className="relative h-4 rounded-full bg-acre-panel desktop-md:mt-1">
                    <div
                      className="absolute h-4 rounded-full"
                      style={{
                        width: `${((row.marketPercentage ?? 0) * 100).toFixed(1)}%`,
                        background: 'rgba(226, 75, 74, 0.28)',
                      }}
                    />
                    <div
                      className="relative h-4 rounded-full bg-[#E24B4A]"
                      style={{ width: `${(row.percentage * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-acre-muted">
                    {row.value} | Mkt: {row.marketValue}
                  </p>
                </div>
                <span className="text-right whitespace-nowrap text-acre-muted desktop-md:mt-0.5 desktop-md:pr-8">
                  {formatCurrency(row.revenueAtRisk)}
                </span>
                <span className="text-acre-muted desktop-md:pl-10">{row.recommendation}</span>
              </div>
            </AppTooltip>
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

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Conversion velocity timeline</h3>
        <p className="mt-1 text-sm text-acre-muted">
          Monthly avg submission-to-offer days by submission month ({selectedLender} vs market)
        </p>
        <div className="mt-3 flex items-center gap-4 text-xs text-acre-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3D4CF9]" />
            {selectedLender}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#6B7280]" />
            Market avg
          </span>
        </div>
        <div className="mt-4 h-[280px]" role="img" aria-label="Conversion velocity timeline chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
            <LineChart
              data={timelineData}
              margin={{ top: 10, right: 20, left: 6, bottom: 24 }}
              onMouseMove={(state) => {
                setActiveTimelineIndex(
                  state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                );
              }}
              onMouseLeave={() => setActiveTimelineIndex(null)}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                stroke="#374151"
                tick={{ fill: '#374151', fontSize: 12 }}
                tickLine={{ stroke: '#374151' }}
                axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                tickMargin={10}
                label={{ value: 'Submission month', position: 'bottom', offset: 10, fill: '#374151', fontSize: 12 }}
              />
              <YAxis
                stroke="#374151"
                tick={{ fill: '#374151', fontSize: 12 }}
                tickLine={{ stroke: '#374151' }}
                axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                width={80}
                tickFormatter={(value) => `${Math.round(Number(value))}d`}
                tickMargin={8}
                label={{ value: 'Avg days', angle: -90, position: 'insideLeft', dx: -8, fill: '#374151', fontSize: 12 }}
              />
              <Tooltip
                formatter={(value, key) => [`${Math.round(Number(value))}d`, key === 'lenderAvgDays' ? selectedLender : 'Market avg']}
                contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
              />
              <Line
                type="monotone"
                dataKey="marketAvgDays"
                name="Market avg"
                stroke="#6B7280"
                strokeWidth={2}
                connectNulls
                strokeOpacity={activeTimelineIndex === null ? 1 : 0.55}
                dot={{ r: 3, fill: '#6B7280' }}
              />
              <Line
                type="monotone"
                dataKey="lenderAvgDays"
                name={selectedLender}
                stroke="#3D4CF9"
                strokeWidth={2}
                connectNulls
                strokeOpacity={activeTimelineIndex === null ? 1 : 0.75}
                dot={{ r: 3, fill: '#3D4CF9' }}
                activeDot={{ r: 5, fill: '#3D4CF9' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Stalled case list</h3>
        <p className="mt-1 text-sm text-acre-muted">
          Top 10 submitted cases with age above market median ({marketMedianDaysToOffer} days)
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('caseId')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleStalledSort('caseId')}
                  >
                    <span>Case ID</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('caseId')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <span>Stall start date</span>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('daysStalled')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleStalledSort('daysStalled')}
                  >
                    <span>Days stalled</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('daysStalled')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('caseType')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleStalledSort('caseType')}
                  >
                    <span>Case type</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('caseType')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('mortgageAmount')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleStalledSort('mortgageAmount')}
                  >
                    <span>Mortgage amount</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('mortgageAmount')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('revenueAtRisk')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleStalledSort('revenueAtRisk')}
                  >
                    <span>Revenue at risk</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('revenueAtRisk')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStalled.length ? (
                sortedStalled.map((row) => (
                  <Fragment key={row.caseId}>
                    <tr
                      className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                        selectedCaseId === row.caseId ? 'bg-gray-200' : ''
                      }`}
                      onClick={() => setSelectedCaseId(selectedCaseId === row.caseId ? null : row.caseId)}
                    >
                      <td className="py-2 pr-4 text-acre-text">
                        <AppTooltip content={`${row.caseId} (click to copy)`}>
                          <button
                            type="button"
                            className="text-left underline-offset-2 hover:underline"
                            onClick={(event) => {
                              event.stopPropagation();
                              copyToClipboard(row.caseId);
                            }}
                          >
                            {truncateCaseId(row.caseId)}
                          </button>
                        </AppTooltip>
                      </td>
                      <td className="py-2 pr-4 text-acre-purple">
                        {row.stallStartDate ? row.stallStartDate.toLocaleDateString('en-GB') : 'n/a'}
                      </td>
                      <td className="py-2 pr-4 text-acre-purple">
                        <button type="button" className="inline-flex items-center gap-2 text-left">
                          <span>{row.daysStalled.toLocaleString('en-GB')}</span>
                          {urgencyLabel(row.daysStalled).text ? (
                            <>
                              <span className={`h-2.5 w-2.5 rounded-full ${urgencyLabel(row.daysStalled).dot}`} />
                              <span className="text-xs font-medium text-red-600">{urgencyLabel(row.daysStalled).text}</span>
                            </>
                          ) : null}
                        </button>
                      </td>
                      <td className="py-2 pr-4 text-acre-text">{row.caseType}</td>
                      <td className="py-2 pr-4 text-acre-text">{formatCurrency(row.mortgageAmount)}</td>
                      <td className="py-2 pr-4 text-acre-text">
                        <AppTooltip
                          content={
                            row.revenueAtRisk === 0
                              ? 'Broker fee is paid on completion - this case represents revenue at risk if it does not proceed.'
                              : undefined
                          }
                        >
                          <span>{row.revenueAtRisk === 0 ? '—' : formatCurrency(row.revenueAtRisk)}</span>
                        </AppTooltip>
                      </td>
                    </tr>
                    {selectedCaseId === row.caseId ? (
                      <tr className="border-b border-acre-border bg-acre-panel">
                        <td colSpan={6} className="px-4 py-3 text-xs text-acre-muted">
                          Timeline: Created {row.timeline.created?.toLocaleDateString('en-GB') ?? 'n/a'} -&gt; Recommendation{' '}
                          {row.timeline.recommended?.toLocaleDateString('en-GB') ?? 'n/a'} -&gt; Submitted{' '}
                          {row.timeline.submitted?.toLocaleDateString('en-GB') ?? 'n/a'} -&gt; Offer{' '}
                          {row.timeline.offer?.toLocaleDateString('en-GB') ?? 'n/a'} -&gt; Complete{' '}
                          {row.timeline.complete?.toLocaleDateString('en-GB') ?? 'n/a'}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-3 text-acre-muted">
                    No stalled submitted cases for this lender in the active period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
