import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Cell } from 'recharts';
import type { MarketStats, MortgageCase, TimePeriod } from '../../types/mortgage';
import { OTHER_CASE_TYPE_TOOLTIP, sortCaseTypeLabels, toCaseTypeLabel } from '../../utils/constants';
import {
  buildCaseCompositionRows,
  buildCaseTypePerformanceRows,
  buildProductMixKpi,
  buildRegulatedCasesKpi,
  filterByPeriod,
  initialRateTypeShare,
} from '../../utils/aggregations';
import { monthLabelFromKey, priorPeriod } from '../../utils/dateUtils';
import { formatCurrency, formatSignedCurrencyDelta, formatNumber, formatPercentage } from '../../utils/formatters';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { AppTooltip } from '../shared/AppTooltip';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import {
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
} from '../shared/tooltipStyles';

const SHARED_CHART_MARGIN = { top: 10, right: 24, left: 34, bottom: 32 };
const SHARED_Y_AXIS_WIDTH = 86;
type CaseTypeSortField = 'caseType' | 'completionRate' | 'notProceedingRate' | 'avgNetRevenue';

interface LenderPerformanceTabProps {
  periodData: MortgageCase[];
  selectedLender: string;
  marketStats: MarketStats;
  period: TimePeriod;
  allRows: MortgageCase[];
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
      month: monthLabelFromKey(key),
      monthKey: key,
      brokerFee: Math.round(value.brokerFee),
      procFee: Math.round(value.procFee),
      total: Math.round(value.brokerFee + value.procFee),
    }));
}

function buildProtectionByCaseType(rows: MortgageCase[], marketRows: MortgageCase[], groupOther: boolean) {
  const byType = new Map<string, { protectedCount: number; total: number }>();
  const byTypeMarket = new Map<string, { protectedCount: number; total: number }>();
  for (const row of rows) {
    const key = toCaseTypeLabel(row.caseType, groupOther);
    const current = byType.get(key) ?? { protectedCount: 0, total: 0 };
    current.total += 1;
    if (row.linkedProtection) {
      current.protectedCount += 1;
    }
    byType.set(key, current);
  }
  for (const row of marketRows) {
    const key = toCaseTypeLabel(row.caseType, groupOther);
    const current = byTypeMarket.get(key) ?? { protectedCount: 0, total: 0 };
    current.total += 1;
    if (row.linkedProtection) {
      current.protectedCount += 1;
    }
    byTypeMarket.set(key, current);
  }

  const labels = sortCaseTypeLabels([...new Set([...byType.keys(), ...byTypeMarket.keys()])]);
  return labels
    .map((type) => {
      const value = byType.get(type) ?? { protectedCount: 0, total: 0 };
      const marketValue = byTypeMarket.get(type) ?? { protectedCount: 0, total: 0 };
      const lenderPercentage = value.total ? value.protectedCount / value.total : 0;
      const marketPercentage = marketValue.total ? marketValue.protectedCount / marketValue.total : 0;
      const lenderCount = value.protectedCount;
      const marketCount = marketValue.protectedCount;
      return {
        label: type === 'First-time buyer' ? 'FTB' : type === 'Buy-to-let' ? 'BTL' : type === 'House move' ? 'House Move' : type,
        percentage: lenderPercentage,
        marketPercentage,
        value: `${formatPercentage(lenderPercentage, 1)} | (${formatNumber(lenderCount)})`,
        marketValue: `${formatPercentage(marketPercentage, 1)} | (${formatNumber(marketCount)})`,
        accent:
          lenderPercentage > marketPercentage
            ? '#1D9E75'
            : lenderPercentage < marketPercentage
              ? '#E24B4A'
              : '#3D4CF9',
      };
    })
    .filter((row) => row.percentage > 0 || row.marketPercentage > 0)
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
  const normalized = rates.map((rate) => (rate >= 1 ? rate / 100 : rate));
  return average(normalized);
}

function formatCurrencyTick(value: number) {
  return `£${Math.round(value).toLocaleString('en-GB')}`;
}

export function LenderPerformanceTab({ periodData, selectedLender, marketStats, period, allRows }: LenderPerformanceTabProps) {
  const [activeRevenueIndex, setActiveRevenueIndex] = useState<number | null>(null);
  const [activeTrendIndex, setActiveTrendIndex] = useState<number | null>(null);
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);
  const [caseTypeSortField, setCaseTypeSortField] = useState<CaseTypeSortField>('avgNetRevenue');
  const [caseTypeSortDirection, setCaseTypeSortDirection] = useState<'asc' | 'desc'>('desc');

  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (lenderRows.length === 0) {
    return <EmptyState title="No performance data for selected lender" />;
  }

  const lenderRevenuePerCase = average(
    lenderRows
      .map((row) => row.totalBrokerFees)
      .filter((value): value is number => value !== null && value >= 0),
  );
  const marketRevenuePerCase = average(
    periodData
      .map((row) => row.totalBrokerFees)
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
  const protectionRows = buildProtectionByCaseType(lenderRows, periodData, groupOtherCaseTypes);
  const averageRevenue = revenueSeries.length
    ? revenueSeries.reduce((sum, row) => sum + row.total, 0) / revenueSeries.length
    : 0;
  const latestRevenue = revenueSeries[revenueSeries.length - 1]?.total ?? 0;
  const showPartialDataNote = averageRevenue > 0 && latestRevenue < averageRevenue * 0.6;
  const highestProtection = protectionRows[0];
  const lowestProtection = protectionRows[protectionRows.length - 1];
  const showProtectionGapCallout =
    highestProtection &&
    lowestProtection &&
    highestProtection.percentage - lowestProtection.percentage > 0.1;

  const previous = priorPeriod(period);
  const previousRows = previous ? filterByPeriod(allRows, previous).filter((row) => row.lender === selectedLender) : [];
  const previousRevenuePerCase = average(
    previousRows
      .map((row) => row.totalBrokerFees)
      .filter((value): value is number => value !== null && value >= 0),
  );
  const revenueDelta = lenderRevenuePerCase - previousRevenuePerCase;
  const hasPreviousRevenue = previousRows.length > 0;
  const revenueDeltaText = hasPreviousRevenue ? `${formatSignedCurrencyDelta(revenueDelta)} vs prev period` : 'No previous period data';
  const revenueDeltaColor = hasPreviousRevenue
    ? revenueDelta >= 0
      ? 'text-green-700'
      : 'text-amber-700'
    : 'text-acre-muted';
  const lenderCaseTypeRows = buildCaseTypePerformanceRows(lenderRows, groupOtherCaseTypes);
  const marketCaseTypeRows = buildCaseTypePerformanceRows(periodData, groupOtherCaseTypes);
  const lenderCaseTypeMap = new Map(lenderCaseTypeRows.map((row) => [row.caseType, row]));
  const marketCaseTypeMap = new Map(marketCaseTypeRows.map((row) => [row.caseType, row]));
  const caseTypeComparisonRows = sortCaseTypeLabels([...new Set([...lenderCaseTypeMap.keys(), ...marketCaseTypeMap.keys()])]).map(
    (caseType) => ({
      caseType,
      lender: lenderCaseTypeMap.get(caseType),
      market: marketCaseTypeMap.get(caseType),
    }),
  );
  const sortedCaseTypeRows = caseTypeComparisonRows.slice().sort((a, b) => {
    const direction = caseTypeSortDirection === 'desc' ? 1 : -1;
    if (caseTypeSortField === 'caseType') {
      return direction * b.caseType.localeCompare(a.caseType, 'en-GB');
    }
    if (caseTypeSortField === 'completionRate') {
      return direction * ((b.lender?.completionRate ?? 0) - (a.lender?.completionRate ?? 0));
    }
    if (caseTypeSortField === 'notProceedingRate') {
      return direction * ((b.lender?.notProceedingRate ?? 0) - (a.lender?.notProceedingRate ?? 0));
    }
    return direction * ((b.lender?.avgNetRevenue ?? Number.NEGATIVE_INFINITY) - (a.lender?.avgNetRevenue ?? Number.NEGATIVE_INFINITY));
  });
  const lenderRateTypeRows = initialRateTypeShare(lenderRows);
  const marketRateTypeRows = initialRateTypeShare(periodData);
  const marketRateTypeMap = new Map(marketRateTypeRows.map((row) => [row.label, row]));
  const rateTypeRows = lenderRateTypeRows
    .map((row) => ({
      label: row.label,
      percentage: row.percentage,
      marketPercentage: marketRateTypeMap.get(row.label)?.percentage ?? 0,
      value: `${formatPercentage(row.percentage, 1)} | (${formatNumber(row.count)})`,
      marketValue: `${formatPercentage(marketRateTypeMap.get(row.label)?.percentage ?? 0, 1)} | (${formatNumber(
        marketRateTypeMap.get(row.label)?.count ?? 0,
      )})`,
      accent: '#5B68FA',
      marketAccent: 'rgba(61, 76, 249, 0.35)',
    }))
    .filter((row) => row.percentage > 0 || row.marketPercentage > 0);
  const lenderProductMix = buildProductMixKpi(lenderRows);
  const marketProductMix = buildProductMixKpi(periodData);
  const regulatedShare = buildRegulatedCasesKpi(lenderRows);
  const marketRegulatedShare = buildRegulatedCasesKpi(periodData);
  const lenderComposition = buildCaseCompositionRows(lenderRows);
  const marketComposition = buildCaseCompositionRows(periodData);
  const marketCompositionMap = new Map(marketComposition.map((row) => [row.label, row.percentage]));
  const ptShare = lenderComposition.find((row) => row.label === 'Product transfer')?.percentage ?? 0;
  const consumerBtlShare = lenderComposition.find((row) => row.label === 'Consumer BTL')?.percentage ?? 0;

  function toggleCaseTypeSort(next: CaseTypeSortField) {
    if (caseTypeSortField === next) {
      setCaseTypeSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setCaseTypeSortField(next);
    setCaseTypeSortDirection('desc');
  }

  function caseTypeSortMarker(field: CaseTypeSortField): string {
    if (caseTypeSortField !== field) {
      return '↕';
    }
    return caseTypeSortDirection === 'desc' ? '↓' : '↑';
  }

  return (
    <section className="mt-3">
      <PageHeader
        title="Performance"
        subtitle={`Revenue, protection, and conversion quality for ${selectedLender}`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard
          label={withTimeFrameLabel('Broker revenue per case', period)}
          value={formatCurrency(lenderRevenuePerCase)}
          subtitle={`Market avg: ${formatCurrency(marketRevenuePerCase)}`}
          meta={<p className={`text-xs font-medium ${revenueDeltaColor}`}>{revenueDeltaText}</p>}
        />
        <KpiCard
          label={withTimeFrameLabel('Protection attach rate', period)}
          value={formatPercentage(lenderProtectionAttach)}
          subtitle={`Market avg: ${formatPercentage(marketStats.protectionAttachRate)}`}
        />
        <KpiCard
          label={withTimeFrameLabel('Resubmission rate', period)}
          value={formatPercentage(lenderResubmission.rate)}
          subtitle={`Market avg: ${formatPercentage(marketResubmission)}`}
        />
        <KpiCard
          label={withTimeFrameLabel('Avg initial rate', period)}
          value={formatPercentage(lenderInitialRate, 2)}
          subtitle={`Market avg: ${formatPercentage(marketInitialRate, 2)}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Broker revenue breakdown</h3>
          <p className="mt-1 text-sm text-acre-muted">Total broker fee and procurement fee by month</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-acre-muted">
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#3D4CF9]" />Procurement fee</span>
            <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F97316]" />Broker fee</span>
          </div>
          <div className="mt-4 h-[260px]" role="img" aria-label="Broker revenue stacked bar chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={220}>
              <BarChart
                data={revenueSeries}
                margin={SHARED_CHART_MARGIN}
                onMouseMove={(state) => {
                  setActiveRevenueIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveRevenueIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  tickMargin={10}
                  label={{ value: 'Month', position: 'bottom', offset: 10, fill: '#374151', fontSize: 12 }}
                />
                <YAxis
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  width={SHARED_Y_AXIS_WIDTH}
                  tickFormatter={formatCurrencyTick}
                  tickMargin={8}
                  label={{ value: 'Revenue (£)', angle: -90, position: 'insideLeft', dx: -14, fill: '#374151', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, name, item) => {
                    const seriesLabel = name === 'brokerFee' ? 'Broker fee' : 'Procurement fee';
                    const seriesColor = item.color ?? '#FFFFFF';
                    return [
                      <span style={{ color: seriesColor }}>{formatCurrency(Number(value))}</span>,
                      <span style={{ color: seriesColor }}>{seriesLabel}</span>,
                    ];
                  }}
                  contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                  itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                />
                <Bar dataKey="procFee" stackId="fees" fill="#3D4CF9">
                  {revenueSeries.map((entry, index) => (
                    <Cell
                      key={`${entry.month}-proc`}
                      fillOpacity={activeRevenueIndex === null || activeRevenueIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
                <Bar dataKey="brokerFee" stackId="fees" fill="#F97316">
                  {revenueSeries.map((entry, index) => (
                    <Cell
                      key={`${entry.month}-broker`}
                      fillOpacity={activeRevenueIndex === null || activeRevenueIndex === index ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {showPartialDataNote ? (
            <p className="mt-2 text-xs text-acre-muted">Recent months may reflect partial data for the selected period.</p>
          ) : null}
        </section>
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Total revenue trend</h3>
          <p className="mt-1 text-sm text-acre-muted">Combined monthly broker revenue (procurement fee + broker fees)</p>
          <div className="mt-4 h-[286px]" role="img" aria-label="Total broker revenue trend line chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <LineChart
                data={revenueSeries}
                margin={SHARED_CHART_MARGIN}
                onMouseMove={(state) => {
                  setActiveTrendIndex(
                    state?.isTooltipActive && typeof state.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null,
                  );
                }}
                onMouseLeave={() => setActiveTrendIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  tickMargin={10}
                  label={{ value: 'Month', position: 'bottom', offset: 10, fill: '#374151', fontSize: 12 }}
                />
                <YAxis
                  stroke="#374151"
                  tick={{ fill: '#374151', fontSize: 12 }}
                  tickLine={{ stroke: '#374151' }}
                  axisLine={{ stroke: '#374151', strokeWidth: 1.5 }}
                  width={SHARED_Y_AXIS_WIDTH}
                  tickFormatter={formatCurrencyTick}
                  tickMargin={8}
                  label={{ value: 'Revenue (£)', angle: -90, position: 'insideLeft', dx: -14, fill: '#374151', fontSize: 12 }}
                />
                <ReferenceLine
                  y={averageRevenue}
                  stroke="#6B6D76"
                  strokeDasharray="4 4"
                  label={{
                    value: `Period avg: ${formatCurrency(averageRevenue)}`,
                    position: 'insideTopRight',
                    dy: -6,
                    fill: '#D97706',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Total revenue']}
                  contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                  itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#3D4CF9"
                  strokeWidth={2}
                  strokeOpacity={activeTrendIndex === null ? 1 : 0.6}
                  dot={{ r: 3, fill: '#3D4CF9', fillOpacity: 0.65 }}
                  activeDot={{ r: 5, fill: '#3D4CF9' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Case type performance</h3>
        <p className="mt-1 text-sm text-acre-muted">Your completion, not-proceeding, and net revenue by case type vs market</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('caseType')}>
                    <span>Case type</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('caseType')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('completionRate')}>
                    <span>Completion (you vs market)</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('completionRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('notProceedingRate')}>
                    <span>Not proceeding (you vs market)</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('notProceedingRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('avgNetRevenue')}>
                    <span>Avg net revenue (you vs market)</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('avgNetRevenue')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCaseTypeRows.map((row) => (
                <tr key={row.caseType} className="border-b border-acre-border">
                  <td className="py-2 pr-4 text-acre-text">
                    {row.caseType === 'Other' ? (
                      <AppTooltip content={OTHER_CASE_TYPE_TOOLTIP}>
                        <span className="cursor-help border-b border-dotted border-current leading-none">Other</span>
                      </AppTooltip>
                    ) : (
                      row.caseType
                    )}
                  </td>
                  <td className="py-2 pr-4 text-acre-text">
                    {`${formatPercentage(row.lender?.completionRate ?? 0, 1)} | Mkt: ${formatPercentage(row.market?.completionRate ?? 0, 1)}`}
                  </td>
                  <td className="py-2 pr-4 text-acre-text">
                    {`${formatPercentage(row.lender?.notProceedingRate ?? 0, 1)} | Mkt: ${formatPercentage(row.market?.notProceedingRate ?? 0, 1)}`}
                  </td>
                  <td className="py-2 pr-4 text-acre-text">
                    {`${row.lender?.avgNetRevenue === null || row.lender?.avgNetRevenue === undefined ? 'N/A' : formatCurrency(row.lender.avgNetRevenue)} | Mkt: ${
                      row.market?.avgNetRevenue === null || row.market?.avgNetRevenue === undefined ? 'N/A' : formatCurrency(row.market.avgNetRevenue)
                    }`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Product mix vs market"
          subtitle="Initial rate type share (you vs market)"
          rows={rateTypeRows}
          hideZeroRows
          valueColumnPx={128}
          singleLineValue
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Compliance composition</h3>
          <p className="mt-1 text-sm text-acre-muted">Regulated, PT, and Consumer BTL share compared with market</p>
          <div className="mt-4">
            <KpiCard
              label={withTimeFrameLabel('Avg term length', period)}
              value={lenderProductMix.averageTermYears === null ? 'N/A' : `${lenderProductMix.averageTermYears.toFixed(1)} years`}
              subtitle={`Market avg: ${
                marketProductMix.averageTermYears === null ? 'N/A' : `${marketProductMix.averageTermYears.toFixed(1)} years`
              }`}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 desktop-sm:grid-cols-3">
            <KpiCard
              label={withTimeFrameLabel('Regulated share', period)}
              value={formatPercentage(regulatedShare.percentage)}
              subtitle={`Market avg: ${formatPercentage(marketRegulatedShare.percentage)}`}
            />
            <KpiCard
              label={withTimeFrameLabel('PT share', period)}
              value={formatPercentage(ptShare)}
              subtitle={`Market avg: ${formatPercentage(marketCompositionMap.get('Product transfer') ?? 0)}`}
            />
            <KpiCard
              label={withTimeFrameLabel('Consumer BTL share', period)}
              value={formatPercentage(consumerBtlShare)}
              subtitle={`Market avg: ${formatPercentage(marketCompositionMap.get('Consumer BTL') ?? 0)}`}
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Protection attach by case type"
          subtitle="Share of cases with linked protection"
          rows={protectionRows}
          hideZeroRows
          valueColumnPx={128}
          singleLineValue
          otherDisclosure={{
            tooltip: OTHER_CASE_TYPE_TOOLTIP,
            expanded: !groupOtherCaseTypes,
            onToggle: () => setGroupOtherCaseTypes((current) => !current),
          }}
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
              <p className="mt-1 text-xs text-acre-muted">Market avg: {formatPercentage(marketResubmission)}</p>
            </div>
          </div>
        </section>
      </div>
      {showProtectionGapCallout ? (
        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {`${lowestProtection.label} protection attach is significantly lower than ${highestProtection.label} - reviewing protection conversations for ${lowestProtection.label.toLowerCase()} cases may represent revenue upside.`}
        </section>
      ) : null}
    </section>
  );
}

