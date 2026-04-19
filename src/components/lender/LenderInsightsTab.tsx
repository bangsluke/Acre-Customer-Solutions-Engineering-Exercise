import { useEffect, useMemo, useState } from 'react';
import type { MarketStats, MortgageCase, TimePeriod } from '../../types/mortgage';
import { buildCaseCompositionRows, computeConversionVelocityRanking } from '../../utils/aggregations';
import { toPipelineStage } from '../../utils/constants';
import { computeStalledSubmittedInsights, evaluateLenderInsights, evaluateLtvOpportunityGaps } from '../../utils/lenderInsights';
import { formatCurrency, formatDays, formatPercentage, formatSignedDaysDelta } from '../../utils/formatters';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { AppTooltip } from '../shared/AppTooltip';

interface LenderInsightsTabProps {
  periodData: MortgageCase[];
  allRows: MortgageCase[];
  selectedLender: string;
  marketStats: MarketStats;
  period: TimePeriod;
}

type StalledSortField = 'caseId' | 'daysStalled' | 'caseType' | 'mortgageAmount' | 'revenueAtRisk';

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function truncateCaseId(caseId: string): string {
  return caseId.length > 8 ? `${caseId.slice(0, 8)}...` : caseId;
}

function copyToClipboard(value: string) {
  void navigator.clipboard?.writeText(value);
}

function urgencyClass(days: number): string {
  if (days >= 91) {
    return 'bg-red-600';
  }
  if (days >= 31) {
    return 'bg-amber-500';
  }
  return 'bg-transparent';
}

function ltvBandRows(rows: MortgageCase[]) {
  const valid = rows
    .map((row) => row.ltv)
    .filter((value): value is number => value !== null && value >= 0 && value <= 1.5);
  const total = Math.max(valid.length, 1);
  const bands = [
    { label: '0-60%', predicate: (v: number) => v < 0.6 },
    { label: '60-75%', predicate: (v: number) => v >= 0.6 && v < 0.75 },
    { label: '75-85%', predicate: (v: number) => v >= 0.75 && v < 0.85 },
    { label: '85-90%', predicate: (v: number) => v >= 0.85 && v < 0.9 },
    { label: '90-95%', predicate: (v: number) => v >= 0.9 && v < 0.95 },
    { label: '95-100%', predicate: (v: number) => v >= 0.95 },
  ];
  return bands.map((band) => {
    const count = valid.filter((value) => band.predicate(value)).length;
    return {
      label: band.label,
      count,
      share: count / total,
    };
  });
}

function lenderOfferSpeed(rows: MortgageCase[]) {
  const values = rows
    .map((row) => daysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((value): value is number => value !== null);
  return average(values);
}

function quarterKey(date: Date): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

export function LenderInsightsTab({ periodData, allRows, selectedLender, marketStats, period }: LenderInsightsTabProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [stalledSortField, setStalledSortField] = useState<StalledSortField>('daysStalled');
  const [stalledSortDirection, setStalledSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAllStalled, setShowAllStalled] = useState(false);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  const furtherAdvanceShare = buildCaseCompositionRows(lenderRows).find((row) => row.label === 'Further advance')?.percentage ?? 0;
  const showHighFurtherAdvanceBadge = furtherAdvanceShare >= 0.2;
  const stalledInsights = computeStalledSubmittedInsights(periodData, selectedLender);
  const stalled = stalledInsights.rows;
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
  const visibleStalled = showAllStalled ? sortedStalled : sortedStalled.slice(0, 10);

  const stalledCount = stalledInsights.stalledCount;
  const revenueAtRisk = stalledInsights.revenueAtRisk;
  const mortgageValueAtRisk = stalledInsights.mortgageValueAtRisk;
  const avgDaysStalled = stalledInsights.avgDaysStalled;

  const lenderSpeed = lenderOfferSpeed(lenderRows);
  const speedVsMarket = lenderSpeed - marketStats.avgDaysToOffer;
  const ranking = computeConversionVelocityRanking(periodData, selectedLender);
  const rankingTopPercent = ranking.total > 0 ? Math.max(1, Math.round((ranking.rank / ranking.total) * 100)) : 0;
  const insightEvaluation = evaluateLenderInsights(periodData, selectedLender, marketStats);
  const ltvOpportunities = evaluateLtvOpportunityGaps(allRows, periodData, selectedLender, period);

  const latestCreatedAt = lenderRows.reduce<Date | null>((latest, row) => {
    if (!row.createdAt) {
      return latest;
    }
    if (!latest || row.createdAt.getTime() > latest.getTime()) {
      return row.createdAt;
    }
    return latest;
  }, null);
  const activeQuarterRows = latestCreatedAt
    ? lenderRows.filter((row) => row.createdAt && quarterKey(row.createdAt) === quarterKey(latestCreatedAt))
    : [];
  const completedQuarterRevenue = activeQuarterRows
    .filter((row) => toPipelineStage(row.caseStatus) === 'COMPLETION')
    .reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);
  const inFlightQuarterRevenue = activeQuarterRows
    .filter((row) => {
      const stage = toPipelineStage(row.caseStatus);
      return stage === 'APPLICATION' || stage === 'OFFER';
    })
    .reduce((sum, row) => sum + Math.max(0, row.totalCaseRevenue ?? 0), 0);
  const platformSpeedAverages = useMemo(() => {
    const byLender = new Map<string, number[]>();
    for (const row of periodData) {
      const daysToOffer = daysBetween(row.firstSubmittedDate, row.firstOfferDate);
      if (daysToOffer === null) {
        continue;
      }
      const lenderValues = byLender.get(row.lender) ?? [];
      lenderValues.push(daysToOffer);
      byLender.set(row.lender, lenderValues);
    }
    return [...byLender.values()]
      .filter((values) => values.length >= 5)
      .map((values) => average(values))
      .filter((value) => value > 0);
  }, [periodData]);
  const platformBestSpeed =
    platformSpeedAverages.length > 0 ? Math.max(1, Math.floor(Math.min(...platformSpeedAverages))) : Math.max(1, Math.floor(lenderSpeed));
  const platformMedianSpeed =
    platformSpeedAverages.length > 0 ? Math.max(platformBestSpeed, Math.round(median(platformSpeedAverages))) : Math.max(platformBestSpeed, Math.round(marketStats.avgDaysToOffer));
  const headroomDays = 10;
  const minTargetDays = platformBestSpeed;
  const maxTargetDays = Math.max(minTargetDays + 1, platformMedianSpeed + headroomDays);
  const roundedCurrentSpeed = Math.max(
    minTargetDays,
    Math.min(maxTargetDays, Math.round(lenderSpeed || marketStats.avgDaysToOffer || minTargetDays)),
  );
  const [targetDaysToOffer, setTargetDaysToOffer] = useState<number>(roundedCurrentSpeed);
  useEffect(() => {
    setTargetDaysToOffer(roundedCurrentSpeed);
  }, [selectedLender, roundedCurrentSpeed]);
  const whatIf = useMemo(() => {
    const baseline = Math.max(1, roundedCurrentSpeed);
    const improvementRatio = (baseline - targetDaysToOffer) / baseline;
    const modeledIncrementalRevenue = inFlightQuarterRevenue * improvementRatio;
    const projectedQuarterRevenue = completedQuarterRevenue + modeledIncrementalRevenue;
    return {
      modeledIncrementalRevenue,
      projectedQuarterRevenue,
    };
  }, [completedQuarterRevenue, inFlightQuarterRevenue, roundedCurrentSpeed, targetDaysToOffer]);

  if (lenderRows.length === 0) {
    return <EmptyState title="No insights data for selected lender" />;
  }

  const lenderBands = ltvBandRows(lenderRows);
  const marketBands = ltvBandRows(periodData);
  const highLtvLender = lenderBands.find((row) => row.label === '95-100%')?.share ?? 0;
  const highLtvMarket = marketBands.find((row) => row.label === '95-100%')?.share ?? 0;
  const highLtvSummary =
    highLtvLender <= highLtvMarket
      ? `${selectedLender} carries lower very-high-LTV exposure than the market (${Math.round(highLtvLender * 100)}% vs ${Math.round(
          highLtvMarket * 100,
        )}% in the 95-100% band).`
      : `${selectedLender} carries higher very-high-LTV exposure than the market (${Math.round(highLtvLender * 100)}% vs ${Math.round(
          highLtvMarket * 100,
        )}% in the 95-100% band) and may need tighter risk controls.`;

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
        title="Insights"
        subtitle={`Actionable signals for ${selectedLender}, including conversion speed and LTV risk positioning`}
      />
      {showHighFurtherAdvanceBadge ? (
        <div className="mt-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          High further advances
        </div>
      ) : null}
      {insightEvaluation.alertMessages.length ? (
        <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Action required</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {insightEvaluation.alertMessages.map((alert) => (
              <li key={alert}>- {alert}</li>
            ))}
          </ul>
          <a href="#revenue-at-risk" className="mt-2 inline-block text-sm font-medium text-amber-900 underline">
            View stalled cases
          </a>
        </section>
      ) : null}

      <section className="mt-4 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">What to focus on</h3>
        <div className="mt-3 space-y-2">
          {insightEvaluation.recommendations.length ? (
            insightEvaluation.recommendations.map((recommendation) => (
              <div
                key={recommendation.text}
                className={`rounded-md border-l-4 p-3 text-sm ${
                  recommendation.tone === 'red'
                    ? 'border-red-500 bg-red-50'
                    : recommendation.tone === 'amber'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-green-600 bg-green-50'
                }`}
              >
                <p className="text-acre-text">{recommendation.text}</p>
                <a href={recommendation.href} className="mt-1 inline-block text-xs font-medium text-acre-purple underline">
                  View detail
                </a>
              </div>
            ))
          ) : (
            <p className="text-sm text-green-800">
              No significant areas of concern. {selectedLender} is performing above market average across all tracked metrics.
            </p>
          )}
        </div>
      </section>

      <section id="revenue-at-risk" className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Revenue at risk (stalled submitted cases)</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 desktop-sm:grid-cols-4">
          <KpiCard label={withTimeFrameLabel('Stalled cases', period)} value={stalledCount.toLocaleString('en-GB')} />
          <KpiCard label={withTimeFrameLabel('Broker revenue at risk', period)} value={formatCurrency(revenueAtRisk)} />
          <KpiCard label={withTimeFrameLabel('Mortgage value at risk', period)} value={formatCurrency(mortgageValueAtRisk)} />
          <KpiCard
            label={withTimeFrameLabel('Average days stalled', period)}
            value={formatDays(avgDaysStalled)}
          />
        </div>
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
              {visibleStalled.length ? (
                visibleStalled.map((row) => (
                  <tr
                    key={row.caseId}
                    className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                      selectedCaseId === row.caseId ? 'bg-gray-200' : ''
                    }`}
                    onClick={() => setSelectedCaseId(row.caseId)}
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
                      <span className="inline-flex items-center gap-2">
                        <span>{row.daysStalled.toLocaleString('en-GB')}</span>
                        <span className={`h-2.5 w-2.5 rounded-full ${urgencyClass(row.daysStalled)}`} />
                        {row.daysStalled >= 91 ? <span className="text-xs text-red-600">Critical</span> : null}
                      </span>
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-3 text-acre-muted">No stalled submitted cases above market threshold.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {sortedStalled.length > 10 ? (
          <button
            type="button"
            className="mt-4 text-sm font-medium text-acre-purple underline-offset-2 hover:underline"
            onClick={() => setShowAllStalled((current) => !current)}
          >
            {showAllStalled ? 'Show less' : 'Show more'}
          </button>
        ) : null}
      </section>

      <section id="conversion-velocity" className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Conversion velocity</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2">
          <KpiCard
            label={withTimeFrameLabel('Your avg days to offer', period)}
            value={formatDays(lenderSpeed)}
            subtitle={`Market avg: ${formatDays(marketStats.avgDaysToOffer)}`}
            meta={
              <p className={`text-xs font-medium ${speedVsMarket <= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                {speedVsMarket <= 0
                  ? `↓ ${formatSignedDaysDelta(speedVsMarket)} faster than market`
                  : `↑ ${formatSignedDaysDelta(speedVsMarket)} slower than market`}
              </p>
            }
          />
          <KpiCard
            label={withTimeFrameLabel('Market ranking', period)}
            value={`Rank ${ranking.rank} of ${ranking.total}`}
            subtitle={`Top ${rankingTopPercent}% of platform lenders by conversion speed`}
          />
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">What-if modelling</h3>
        <p className="mt-2 text-sm text-acre-muted">
          {speedVsMarket <= 0
            ? `${selectedLender} is already ${Math.abs(Math.round(speedVsMarket))}d faster than market. Slide right to see what matching slower lenders would cost; slide left to model further improvement.`
            : `${selectedLender} is currently ${Math.abs(Math.round(speedVsMarket))}d slower than market. Slide left to model improvement; slide right to test slower scenarios.`}
        </p>
        <p className="mt-2 text-sm text-acre-text">
          Current: <span className="font-semibold">{formatDays(lenderSpeed)}</span> | Market avg:{' '}
          <span className="font-semibold">{formatDays(marketStats.avgDaysToOffer)}</span>
        </p>
        <div className="mt-4">
          <label htmlFor="what-if-target-days" className="text-sm font-medium text-acre-text">
            Target submission-to-offer days: {targetDaysToOffer}d
          </label>
          <input
            id="what-if-target-days"
            className="mt-2 w-full accent-acre-purple"
            type="range"
            min={minTargetDays}
            max={maxTargetDays}
            step={1}
            value={targetDaysToOffer}
            onChange={(event) => setTargetDaysToOffer(Number(event.target.value))}
          />
        </div>
        <p className={`mt-3 text-sm font-medium ${whatIf.modeledIncrementalRevenue >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          Modeled incremental revenue this quarter:{' '}
          {whatIf.modeledIncrementalRevenue >= 0 ? '+' : ''}
          {formatCurrency(whatIf.modeledIncrementalRevenue)}
        </p>
        <p className="mt-1 text-xs text-acre-muted">
          Projected cleared revenue this quarter: {formatCurrency(whatIf.projectedQuarterRevenue)} (current cleared:{' '}
          {formatCurrency(completedQuarterRevenue)}).
        </p>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4">
        <HorizontalDistribution
          title={`LTV risk (${selectedLender} vs market baseline)`}
          subtitle={`Overlaid lender and market bar shares by LTV band. Higher bands indicate greater credit risk exposure.`}
          rows={lenderBands.map((row) => ({
            label: row.label,
            percentage: row.share,
            value: `${formatPercentage(row.share)} | (${row.count.toLocaleString('en-GB')})`,
            marketPercentage: marketBands.find((marketRow) => marketRow.label === row.label)?.share ?? 0,
            marketValue: `${formatPercentage(marketBands.find((marketRow) => marketRow.label === row.label)?.share ?? 0)} | (${(
              marketBands.find((marketRow) => marketRow.label === row.label)?.count ?? 0
            ).toLocaleString('en-GB')})`,
            marketAccent: 'rgba(61, 76, 249, 0.35)',
            badge: Math.abs(row.share - (marketBands.find((marketRow) => marketRow.label === row.label)?.share ?? 0)) <= 0.01 ? '≈ market' : undefined,
            accent: '#5B68FA',
          }))}
          valueColumnPx={128}
          singleLineValue
        />
      </div>
      <section className="mt-4 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">LTV opportunity gaps</h3>
        <p className="mt-1 text-sm text-acre-muted">
          Top LTV bands where market share is growing and {selectedLender} is under-indexed vs market
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 desktop-sm:grid-cols-2">
          {ltvOpportunities.length ? (
            ltvOpportunities.map((gap) => (
              <article key={gap.label} className="rounded-lg border border-green-200 bg-green-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-800">{gap.label} band</p>
                <p className="mt-2 text-sm text-acre-text">
                  Capture opportunity: market growth is <span className="font-semibold text-green-800">{formatPercentage(gap.marketGrowthRate, 1)}</span>{' '}
                  while your share is <span className="font-semibold">{formatPercentage(gap.lenderShare, 1)}</span> vs market{' '}
                  <span className="font-semibold">{formatPercentage(gap.marketShare, 1)}</span>.
                </p>
                <p className="mt-2 text-xs text-acre-muted">
                  Share gap to capture: {formatPercentage(gap.shareGap, 1)}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-acre-border bg-acre-panel p-4 text-sm text-acre-muted desktop-sm:col-span-2">
              No LTV bands currently meet the opportunity threshold for this period.
            </p>
          )}
        </div>
      </section>
      <p className="mt-2 text-sm text-acre-muted">{highLtvSummary}</p>
    </section>
  );
}

