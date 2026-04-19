import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MortgageCase, TimePeriod } from '../../types/mortgage';
import { OTHER_CASE_TYPE_TOOLTIP, toCaseTypeLabel, toPipelineStage } from '../../utils/constants';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
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

interface LenderRow {
  lender: string;
  caseCount: number;
  totalLoanValue: number;
  share: number;
  completionRate: number;
  avgRevenue: number;
  highLtvShare: number;
}

interface SwitchRow {
  route: string;
  count: number;
}

const CASE_TYPE_COLORS: Record<string, string> = {
  'First-time buyer': '#3D4CF9',
  Remortgage: '#1D9E75',
  'House move': '#6FA8FF',
  'Buy-to-let': '#E24B4A',
  Other: '#B8B9C0',
};

const BEST_COMPLETION_MIN_CASES = 100;

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
      const completedRows = rows.filter((item) => toPipelineStage(item.caseStatus) === 'COMPLETION');
      const completed = completedRows.length;
      const validRevenue = rows
        .map((item) => item.totalCaseRevenue)
        .filter((value): value is number => value !== null && value >= 0);
      return {
        lender,
        caseCount: rows.length,
        totalLoanValue: completedRows.reduce((sum, item) => sum + Math.max(0, item.mortgageAmount ?? 0), 0),
        share: rows.length / totalCases,
        completionRate: rows.length ? completed / rows.length : 0,
        avgRevenue: average(validRevenue),
        highLtvShare:
          rows.filter((item) => item.ltv !== null && item.ltv >= 0 && item.ltv <= 1.5).length > 0
            ? rows.filter((item) => item.ltv !== null && item.ltv >= 0.85 && item.ltv <= 1.5).length /
              rows.filter((item) => item.ltv !== null && item.ltv >= 0 && item.ltv <= 1.5).length
            : 0,
      };
    })
    .sort((a, b) => b.caseCount - a.caseCount);
}

function buildSwitchRows(periodData: MortgageCase[], excludeUnknownLender: boolean): SwitchRow[] {
  const transitions = new Map<string, number>();
  for (const row of periodData) {
    if (!row.prevLender || row.prevLender === row.lender) {
      continue;
    }
    if (excludeUnknownLender && (isUnknownLender(row.prevLender) || isUnknownLender(row.lender))) {
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

function normaliseCaseType(caseType: string): string {
  return toCaseTypeLabel(caseType, true);
}

export function buildTopLenderMix(periodData: MortgageCase[], excludeUnknownLender: boolean) {
  const filtered = excludeUnknownLender ? periodData.filter((row) => !isUnknownLender(row.lender)) : periodData;
  const lenderCounts = new Map<string, number>();
  for (const row of filtered) {
    lenderCounts.set(row.lender, (lenderCounts.get(row.lender) ?? 0) + 1);
  }
  const topLenders = [...lenderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lender]) => lender);

  return topLenders.map((lender) => {
    const lenderRows = filtered.filter((row) => row.lender === lender);
    const total = Math.max(lenderRows.length, 1);
    const typeCounts = new Map<string, number>();
    for (const row of lenderRows) {
      const label = normaliseCaseType(row.caseType);
      typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
    }

    return {
      lender,
      'First-time buyer': ((typeCounts.get('First-time buyer') ?? 0) / total) * 100,
      Remortgage: ((typeCounts.get('Remortgage') ?? 0) / total) * 100,
      'House move': ((typeCounts.get('House move') ?? 0) / total) * 100,
      'Buy-to-let': ((typeCounts.get('Buy-to-let') ?? 0) / total) * 100,
      Other: ((typeCounts.get('Other') ?? 0) / total) * 100,
    };
  });
}

export function renderCaseMixLegendLabel(value: string) {
  if (value !== 'Other') {
    return value;
  }
  return (
    <AppTooltip content={OTHER_CASE_TYPE_TOOLTIP}>
      <span className="cursor-help border-b border-dotted border-current leading-none">Other</span>
    </AppTooltip>
  );
}

type SortField = 'lender' | 'caseCount' | 'totalLoanValue' | 'share' | 'completionRate' | 'avgRevenue' | 'highLtvShare';

export function InternalLenderShareTab({
  periodData,
  period,
}: {
  periodData: MortgageCase[];
  period: TimePeriod;
}) {
  const [selectedLenderRow, setSelectedLenderRow] = useState<string | null>(null);
  const [excludeUnknownLender, setExcludeUnknownLender] = useState(true);
  const [sortField, setSortField] = useState<SortField>('totalLoanValue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  if (periodData.length === 0) {
    return <EmptyState title="No lender-share data in this period" />;
  }

  const filteredData = excludeUnknownLender ? periodData.filter((row) => !isUnknownLender(row.lender)) : periodData;
  const lenderRows = buildLenderRows(filteredData);
  const switchRows = buildSwitchRows(periodData, excludeUnknownLender);
  const topLenderCaseMix = buildTopLenderMix(periodData, excludeUnknownLender);

  const numberOfLenders = lenderRows.length;
  const topFiveConcentration = lenderRows.slice(0, 5).reduce((sum, row) => sum + row.share, 0);
  const bestCompletion = lenderRows
    .filter((row) => row.caseCount >= BEST_COMPLETION_MIN_CASES)
    .sort((a, b) => b.completionRate - a.completionRate)[0];
  const validRevenueRows = filteredData.filter((row) => row.totalCaseRevenue !== null && row.totalCaseRevenue >= 0);
  const totalRevenue = validRevenueRows.reduce((sum, row) => sum + (row.totalCaseRevenue ?? 0), 0);
  const avgRevenuePerLender = numberOfLenders > 0 && validRevenueRows.length > 0 ? totalRevenue / numberOfLenders : null;
  const excludedCount = periodData.filter((row) => isUnknownLender(row.lender)).length;
  const excludedShare = periodData.length ? excludedCount / periodData.length : 0;

  const sortedRows = lenderRows.slice().sort((a, b) => {
    const direction = sortDirection === 'desc' ? 1 : -1;
    if (sortField === 'lender') return direction * b.lender.localeCompare(a.lender, 'en-GB');
    if (sortField === 'caseCount') return direction * (b.caseCount - a.caseCount);
    if (sortField === 'totalLoanValue') return direction * (b.totalLoanValue - a.totalLoanValue);
    if (sortField === 'share') return direction * (b.share - a.share);
    if (sortField === 'completionRate') return direction * (b.completionRate - a.completionRate);
    if (sortField === 'highLtvShare') return direction * (b.highLtvShare - a.highLtvShare);
    return direction * (b.avgRevenue - a.avgRevenue);
  });
  const completionMedian = average(sortedRows.map((row) => row.completionRate));
  const revenueMedian = average(sortedRows.map((row) => row.avgRevenue));

  function toggleSort(next: SortField) {
    if (sortField === next) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortField(next);
    setSortDirection('desc');
  }

  function sortMarker(field: SortField): string {
    if (sortField !== field) {
      return '↕';
    }
    return sortDirection === 'desc' ? '↓' : '↑';
  }

  function ariaSortValue(field: SortField): 'none' | 'ascending' | 'descending' {
    if (sortField !== field) {
      return 'none';
    }
    return sortDirection === 'desc' ? 'descending' : 'ascending';
  }

  return (
    <section className="mt-3">
      <PageHeader title="Lender share" subtitle="Market concentration and lender-level performance" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-acre-border bg-white p-4">
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
            {excludedCount.toLocaleString('en-GB')} cases ({formatPercentage(excludedShare)}) have no lender assigned and are excluded from this view.
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label={withTimeFrameLabel('Number of lenders', period)} value={numberOfLenders.toLocaleString('en-GB')} />
        <KpiCard label={withTimeFrameLabel('Top 5 concentration', period)} value={formatPercentage(topFiveConcentration)} />
        <KpiCard
          label={withTimeFrameLabel('Best completion rate', period)}
          value={bestCompletion ? `${bestCompletion.lender}` : 'N/A'}
          subtitle={
            bestCompletion
              ? `${formatPercentage(bestCompletion.completionRate)} (${BEST_COMPLETION_MIN_CASES}+ cases)`
              : `Insufficient volume (${BEST_COMPLETION_MIN_CASES}+ cases)`
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Avg revenue per lender', period)}
          value={avgRevenuePerLender === null ? 'N/A' : formatCurrency(avgRevenuePerLender)}
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
            accent: '#5B68FA',
          }))}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Switching patterns</h3>
          <p className="mt-1 text-sm text-acre-muted">Top previous-lender to current-lender transitions</p>
          <div className="mt-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-acre-border pb-2 text-xs font-semibold uppercase tracking-wide text-acre-muted">
              <span>Route</span>
              <span className="text-right">Transitions</span>
            </div>
            <div className="space-y-2">
            {switchRows.length ? (
              switchRows.map((row) => (
                <div key={row.route} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-acre-border py-2 text-sm">
                  <span className="truncate text-acre-text">{row.route}</span>
                  <span className="text-right font-medium text-acre-purple">{row.count.toLocaleString('en-GB')}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-acre-muted">
                No lender-to-lender switching patterns available once blank lender is excluded. This may reflect a data completeness issue with the prev_lender field.
              </p>
            )}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Case mix by top lender</h3>
        <p className="mt-1 text-sm text-acre-muted">Case type composition for the top 10 lenders by volume</p>
        <div className="mt-4 h-[360px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
            <BarChart data={topLenderCaseMix} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 100]}
                allowDecimals={false}
                tickCount={6}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <YAxis type="category" dataKey="lender" width={240} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
              />
              <Legend formatter={renderCaseMixLegendLabel} />
              {Object.keys(CASE_TYPE_COLORS).map((key) => (
                <Bar key={key} dataKey={key} stackId="mix" fill={CASE_TYPE_COLORS[key]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">All lenders</h3>
        <p className="mt-1 text-sm text-acre-muted">Case count, market share, completion rate, and average broker revenue</p>
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
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('totalLoanValue')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('totalLoanValue')}
                  >
                    <span>Total Completed Loan Value</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('totalLoanValue')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('share')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('share')}
                  >
                    <span>Share</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('share')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('completionRate')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('completionRate')}
                  >
                    <span>Completion rate</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('completionRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium" aria-sort={ariaSortValue('avgRevenue')}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left text-acre-muted transition-colors hover:text-acre-text"
                    onClick={() => toggleSort('avgRevenue')}
                  >
                    <span>Avg broker revenue</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('avgRevenue')}</span>
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
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={row.lender}
                  className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                    selectedLenderRow === row.lender ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedLenderRow(row.lender)}
                >
                  <td className="py-2 pr-4 text-acre-text">{row.lender}</td>
                  <td className="py-2 pr-4 text-acre-text">{row.caseCount.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatCurrency(row.totalLoanValue)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.share)}</td>
                  <td
                    className="py-2 pr-4 text-acre-text"
                    style={{ backgroundColor: row.completionRate >= completionMedian ? 'rgba(29, 158, 117, 0.1)' : 'rgba(226, 173, 75, 0.12)' }}
                  >
                    <AppTooltip
                      content={`${row.completionRate >= completionMedian ? 'Over average' : 'Under average'} completion rate. Average: ${formatPercentage(completionMedian)}`}
                    >
                      <span>{formatPercentage(row.completionRate)}</span>
                    </AppTooltip>
                  </td>
                  <td
                    className="py-2 pr-4 text-acre-purple"
                    style={{ backgroundColor: row.avgRevenue >= revenueMedian ? 'rgba(29, 158, 117, 0.1)' : 'rgba(226, 173, 75, 0.12)' }}
                  >
                    <AppTooltip
                      content={`${row.avgRevenue >= revenueMedian ? 'Over average' : 'Under average'} average broker revenue. Average: ${formatCurrency(revenueMedian)}`}
                    >
                      <span>{formatCurrency(row.avgRevenue)}</span>
                    </AppTooltip>
                  </td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.highLtvShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

