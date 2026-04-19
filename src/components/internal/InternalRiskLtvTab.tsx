import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MortgageCase, TimePeriod } from '../../types/mortgage';
import { filterByPeriod } from '../../utils/aggregations';
import { OTHER_CASE_TYPE_TOOLTIP, toCaseTypeLabel } from '../../utils/constants';
import { priorPeriod } from '../../utils/dateUtils';
import { formatPercentage, formatPercentagePoints } from '../../utils/formatters';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { AppTooltip } from '../shared/AppTooltip';
import {
  RECHARTS_TOOLTIP_CONTENT_STYLE,
  RECHARTS_TOOLTIP_ITEM_STYLE,
  RECHARTS_TOOLTIP_LABEL_STYLE,
} from '../shared/tooltipStyles';

interface LenderLtvRow {
  lender: string;
  caseCount: number;
  avgLtv: number;
  highLtvShare: number;
  highLtvDeltaVsMarket: number;
}

type RiskSortField = 'lender' | 'caseCount' | 'avgLtv' | 'highLtvShare' | 'highLtvDeltaVsMarket';
type LtvStackCaseType = 'FTB' | 'Remortgage' | 'House Move' | 'BTL' | 'Other';

const SHORT_CASE_TYPE_LABELS: Record<string, string> = {
  'First-time buyer': 'FTB',
  'House move': 'House Move',
  'Buy-to-let': 'BTL',
};

function caseTypeDisplayLabel(label: string): string {
  return SHORT_CASE_TYPE_LABELS[label] ?? label;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isUnknownLender(lender: string): boolean {
  const normalized = lender.trim().toLowerCase();
  return !normalized || normalized === 'unknown lender' || normalized === 'unknown' || normalized === 'blank lender' || normalized === 'blank';
}

function toLtvStackCaseType(caseType: MortgageCase['caseType']): LtvStackCaseType {
  if (caseType === 'REASON_FTB') {
    return 'FTB';
  }
  if (caseType === 'REASON_REMORTGAGE') {
    return 'Remortgage';
  }
  if (caseType === 'REASON_HOUSE_MOVE') {
    return 'House Move';
  }
  if (caseType === 'REASON_BTL') {
    return 'BTL';
  }
  return 'Other';
}

function buildLenderLtvRows(periodData: MortgageCase[], marketHighLtvShare: number): LenderLtvRow[] {
  const byLender = new Map<string, MortgageCase[]>();
  for (const row of periodData) {
    const rows = byLender.get(row.lender) ?? [];
    rows.push(row);
    byLender.set(row.lender, rows);
  }

  return [...byLender.entries()]
    .map(([lender, rows]) => {
      const ltvValues = rows
        .map((item) => item.ltv)
        .filter((value): value is number => value !== null && value <= 1.5 && value >= 0);
      const highLtv = ltvValues.filter((value) => value >= 0.85).length;
      return {
        lender,
        caseCount: rows.length,
        avgLtv: average(ltvValues),
        highLtvShare: ltvValues.length ? highLtv / ltvValues.length : 0,
        highLtvDeltaVsMarket: (ltvValues.length ? highLtv / ltvValues.length : 0) - marketHighLtvShare,
      };
    })
    .filter((row) => row.caseCount > 0)
    .sort((a, b) => b.caseCount - a.caseCount)
    .slice(0, 10);
}

function buildCaseTypeLtvRows(periodData: MortgageCase[], groupOther: boolean) {
  const byLabel = new Map<string, number[]>();
  for (const row of periodData) {
    if (row.ltv === null || row.ltv > 1.5 || row.ltv < 0) {
      continue;
    }
    const label = toCaseTypeLabel(row.caseType, groupOther);
    const values = byLabel.get(label) ?? [];
    values.push(row.ltv);
    byLabel.set(label, values);
  }

  return [...byLabel.entries()]
    .map(([label, values]) => ({
      label: caseTypeDisplayLabel(label),
      value: formatPercentage(average(values), 1),
      percentage: average(values),
    }))
    .sort((a, b) => b.percentage - a.percentage || a.label.localeCompare(b.label));
}

function buildRiskTrendBadge(
  current: number,
  previous: number | null,
  period: TimePeriod,
): { text: string; tone: 'muted' | 'positive' | 'negative' } {
  if (period.type === 'this_year') {
    return { text: 'No data', tone: 'muted' };
  }
  if (previous === null) {
    return { text: 'No previous period data', tone: 'muted' };
  }
  const delta = current - previous;
  if (delta === 0) {
    return { text: '→ 0.0% vs prev period', tone: 'muted' };
  }
  return {
    text: `${delta > 0 ? '↑' : '↓'} ${formatPercentagePoints(delta)} vs prev period`,
    tone: delta < 0 ? 'positive' : 'negative',
  };
}

export function InternalRiskLtvTab({
  periodData,
  period,
  allRows = periodData,
}: {
  periodData: MortgageCase[];
  period: TimePeriod;
  allRows?: MortgageCase[];
}) {
  const [selectedRiskLender, setSelectedRiskLender] = useState<string | null>(null);
  const [excludeUnknownLender, setExcludeUnknownLender] = useState(true);
  const [sortField, setSortField] = useState<RiskSortField>('avgLtv');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);

  if (periodData.length === 0) {
    return <EmptyState title="No risk and LTV data in this period" />;
  }

  const validLtvRows = periodData.filter((row) => row.ltv !== null && row.ltv <= 1.5 && row.ltv >= 0);
  const avgLtv = average(validLtvRows.map((row) => row.ltv as number));
  const highLtvCount = validLtvRows.filter((row) => (row.ltv as number) >= 0.85).length;
  const veryHighLtvCount = validLtvRows.filter((row) => (row.ltv as number) >= 0.95).length;

  const highLtvShare = validLtvRows.length ? highLtvCount / validLtvRows.length : 0;
  const veryHighLtvShare = validLtvRows.length ? veryHighLtvCount / validLtvRows.length : 0;
  const latestCreatedAt = allRows.reduce<Date | null>((latest, row) => {
    if (!row.createdAt) {
      return latest;
    }
    if (!latest || row.createdAt.getTime() > latest.getTime()) {
      return row.createdAt;
    }
    return latest;
  }, null);
  const previousPeriod = period.type === 'this_year' ? null : priorPeriod(period, latestCreatedAt ?? undefined);
  const previousPeriodData = previousPeriod ? filterByPeriod(allRows, previousPeriod) : [];
  const previousValidLtvRows = previousPeriodData.filter((row) => row.ltv !== null && row.ltv <= 1.5 && row.ltv >= 0);
  const previousAvgLtv = previousValidLtvRows.length
    ? average(previousValidLtvRows.map((row) => row.ltv as number))
    : null;
  const previousHighLtvShare = previousValidLtvRows.length
    ? previousValidLtvRows.filter((row) => (row.ltv as number) >= 0.85).length / previousValidLtvRows.length
    : null;
  const previousVeryHighLtvShare = previousValidLtvRows.length
    ? previousValidLtvRows.filter((row) => (row.ltv as number) >= 0.95).length / previousValidLtvRows.length
    : null;
  const avgLtvTrend = buildRiskTrendBadge(avgLtv, previousAvgLtv, period);
  const highLtvTrend = buildRiskTrendBadge(highLtvShare, previousHighLtvShare, period);
  const veryHighLtvTrend = buildRiskTrendBadge(veryHighLtvShare, previousVeryHighLtvShare, period);

  const typeRows = buildCaseTypeLtvRows(periodData, groupOtherCaseTypes);
  const filteredLenderData = excludeUnknownLender ? periodData.filter((row) => !isUnknownLender(row.lender)) : periodData;
  const lenderRows = buildLenderLtvRows(filteredLenderData, highLtvShare);
  const excludedLenderCount = periodData.filter((row) => isUnknownLender(row.lender)).length;
  const excludedLenderShare = periodData.length ? excludedLenderCount / periodData.length : 0;
  const sortedLenderRows = lenderRows.slice().sort((a, b) => {
    const direction = sortDirection === 'desc' ? 1 : -1;
    if (sortField === 'lender') {
      return direction * b.lender.localeCompare(a.lender, 'en-GB');
    }
    if (sortField === 'avgLtv') {
      return direction * (b.avgLtv - a.avgLtv);
    }
    if (sortField === 'highLtvShare') {
      return direction * (b.highLtvShare - a.highLtvShare);
    }
    if (sortField === 'highLtvDeltaVsMarket') {
      return direction * (b.highLtvDeltaVsMarket - a.highLtvDeltaVsMarket);
    }
    return direction * (b.caseCount - a.caseCount);
  });

  function toggleSort(next: RiskSortField) {
    if (sortField === next) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortField(next);
    setSortDirection('desc');
  }

  function sortMarker(field: RiskSortField): string {
    if (sortField !== field) {
      return '↕';
    }
    return sortDirection === 'desc' ? '↓' : '↑';
  }

  function ariaSortValue(field: RiskSortField): 'none' | 'ascending' | 'descending' {
    if (sortField !== field) {
      return 'none';
    }
    return sortDirection === 'desc' ? 'descending' : 'ascending';
  }

  const midPointDate = new Date(2025, 6, 1);
  const previousHalfRows = validLtvRows.filter((row) => row.createdAt && row.createdAt < midPointDate);
  const currentHalfRows = validLtvRows.filter((row) => row.createdAt && row.createdAt >= midPointDate);
  const previousHalfAvg = average(previousHalfRows.map((row) => row.ltv as number));
  const currentHalfAvg = average(currentHalfRows.map((row) => row.ltv as number));
  const ltvDelta = currentHalfAvg - previousHalfAvg;
  const ltvTrendDirection = ltvDelta > 0 ? '↑' : ltvDelta < 0 ? '↓' : '→';
  const ltvTrendText = `${ltvTrendDirection} ${formatPercentagePoints(ltvDelta)} vs prev half`;
  const isImprovement = ltvDelta < 0;

  const ltvBands = [
    { key: '0-60%', min: 0, max: 0.6 },
    { key: '60-75%', min: 0.6, max: 0.75 },
    { key: '75-85%', min: 0.75, max: 0.85 },
    { key: '85-90%', min: 0.85, max: 0.9 },
    { key: '90-95%', min: 0.9, max: 0.95 },
    { key: '95-100%', min: 0.95, max: 1.5 },
  ];
  const caseTypeKeys: LtvStackCaseType[] = ['FTB', 'Remortgage', 'House Move', 'BTL', 'Other'];
  const caseTypeColors: Record<LtvStackCaseType, string> = {
    FTB: '#3D4CF9',
    Remortgage: '#1D9E75',
    'House Move': '#6FA8FF',
    BTL: '#E24B4A',
    Other: '#B8B9C0',
  };
  const otherCaseTypeValues = [...new Set(
    validLtvRows
      .map((row) => row.caseType)
      .filter((caseType) => toLtvStackCaseType(caseType) === 'Other'),
  )].sort((a, b) => a.localeCompare(b));
  const otherLegendTooltip = otherCaseTypeValues.length
    ? `Includes these caseType values: ${otherCaseTypeValues.join(', ')}`
    : 'Includes any caseType values outside FTB, Remortgage, House Move, and BTL.';

  const ltvStackRows = ltvBands.map((band) => {
    const inBand = validLtvRows.filter((row) => (row.ltv as number) >= band.min && (row.ltv as number) < band.max);
    const bandTotal = Math.max(inBand.length, 1);
    const row: Record<string, string | number> = {
      band: band.key,
      totalShare: validLtvRows.length ? inBand.length / validLtvRows.length : 0,
    };
    for (const key of caseTypeKeys) {
      row[key] = inBand.filter((item) => toLtvStackCaseType(item.caseType) === key).length / bandTotal * 100;
    }
    return row;
  });

  return (
    <section className="mt-3">
      <PageHeader
        title="Risk and LTV"
        subtitle="Risk profile distribution and concentration across lenders and case types"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard
          label={withTimeFrameLabel('Average LTV', period)}
          value={formatPercentage(avgLtv)}
          rightBadge={<span className={`text-xs font-medium ${avgLtvTrend.tone === 'muted' ? 'text-acre-muted' : avgLtvTrend.tone === 'positive' ? 'text-green-700' : 'text-amber-700'}`}>{avgLtvTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('High-LTV cases (85%+)', period)}
          value={formatPercentage(highLtvShare)}
          rightBadge={<span className={`text-xs font-medium ${highLtvTrend.tone === 'muted' ? 'text-acre-muted' : highLtvTrend.tone === 'positive' ? 'text-green-700' : 'text-amber-700'}`}>{highLtvTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('Very high-LTV cases (95%+)', period)}
          value={formatPercentage(veryHighLtvShare)}
          rightBadge={<span className={`text-xs font-medium ${veryHighLtvTrend.tone === 'muted' ? 'text-acre-muted' : veryHighLtvTrend.tone === 'positive' ? 'text-green-700' : 'text-amber-700'}`}>{veryHighLtvTrend.text}</span>}
        />
        <KpiCard
          label={withTimeFrameLabel('LTV trend direction', period)}
          value={formatPercentage(currentHalfAvg || avgLtv)}
          rightBadge={
            <span
              className={`text-xs font-medium ${
                ltvDelta === 0 ? 'text-acre-muted' : isImprovement ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {ltvTrendText}
            </span>
          }
          subtitle="Compared with previous half-year average"
          meta={
            <p className={`text-xs font-medium ${ltvDelta === 0 ? 'text-acre-muted' : ltvDelta > 0 ? 'text-amber-700' : 'text-green-700'}`}>
              {ltvDelta === 0 ? 'Risk mix is stable.' : ltvDelta > 0 ? 'Risk mix is moving upward.' : 'Risk mix is moving downward.'}
            </p>
          }
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">LTV distribution</h3>
          <p className="mt-1 text-sm text-acre-muted">Share of valid cases by LTV band and case type</p>
          <div className="mt-4 h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart layout="vertical" data={ltvStackRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="band" width={88} />
                <Tooltip
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                  contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                  labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                  itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                />
                <Legend
                  formatter={(value) => {
                    if (value !== 'Other') {
                      return value;
                    }
                    return (
                      <AppTooltip content={otherLegendTooltip}>
                        <span className="cursor-help border-b border-dotted border-acre-muted">Other</span>
                      </AppTooltip>
                    );
                  }}
                />
                {caseTypeKeys.map((label) => (
                  <Bar key={label} dataKey={label} stackId="ltv" fill={caseTypeColors[label]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-acre-muted">
            {ltvStackRows.map((row) => (
              <p key={String(row.band)}>
                {row.band}: {formatPercentage(Number(row.totalShare))}
              </p>
            ))}
          </div>
        </section>
        <HorizontalDistribution
          title="Average LTV by case type"
          subtitle="Relative risk profile by business segment"
          rows={typeRows}
          otherDisclosure={{
            tooltip: OTHER_CASE_TYPE_TOOLTIP,
            expanded: !groupOtherCaseTypes,
            onToggle: () => setGroupOtherCaseTypes((current) => !current),
          }}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Top lenders by average LTV</h3>
        <p className="mt-1 text-sm text-acre-muted">Top 10 lenders by case volume in the active period</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-acre-border bg-acre-panel p-4">
          <label className="inline-flex items-center gap-2 text-sm text-acre-text">
            <input
              type="checkbox"
              checked={excludeUnknownLender}
              onChange={(event) => setExcludeUnknownLender(event.target.checked)}
            />
            Exclude blank lender
          </label>
          {excludeUnknownLender ? (
            <p className="text-sm text-acre-muted">
              {excludedLenderCount.toLocaleString('en-GB')} cases ({formatPercentage(excludedLenderShare)}) have no lender assigned and are excluded from this view.
            </p>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('lender')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('lender')}
                  >
                    <span>Lender</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('lender')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('caseCount')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('caseCount')}
                  >
                    <span>Cases</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('caseCount')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('avgLtv')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('avgLtv')}
                  >
                    <span>Avg LTV</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('avgLtv')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('highLtvShare')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('highLtvShare')}
                  >
                    <span>High-LTV share (85%+)</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('highLtvShare')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('highLtvDeltaVsMarket')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('highLtvDeltaVsMarket')}
                  >
                    <span>High-LTV share vs market avg</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('highLtvDeltaVsMarket')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLenderRows.map((row) => (
                <tr
                  key={row.lender}
                  className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                    selectedRiskLender === row.lender ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedRiskLender(row.lender)}
                >
                  <td className="py-2 pr-4 text-acre-text">{row.lender}</td>
                  <td className="py-2 pr-4 text-acre-text">{row.caseCount.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.avgLtv)}</td>
                  <td className="py-2 pr-4 text-acre-purple">
                    {formatPercentage(row.highLtvShare)}
                    {row.highLtvShare === 0 && (row.lender === 'The Mortgage Works' || row.lender === 'BM Solutions') ? (
                      <AppTooltip content="Buy-to-let specialist lenders typically operate with lower LTV caps. A 0% high-LTV share may reflect product constraints rather than missing data.">
                        <span className="ml-2 text-xs text-acre-muted">*</span>
                      </AppTooltip>
                    ) : null}
                  </td>
                  <td className={`py-2 pr-4 font-medium ${row.highLtvDeltaVsMarket > 0 ? 'text-amber-700' : row.highLtvDeltaVsMarket < 0 ? 'text-green-700' : 'text-acre-muted'}`}>
                    {formatPercentagePoints(row.highLtvDeltaVsMarket)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </section>
  );
}

