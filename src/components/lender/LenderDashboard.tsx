import { useState } from 'react';
import type { FunnelMode, LenderStats, MarketStats, MortgageCase, TimePeriod } from '../../types/mortgage';
import {
  caseTypeBreakdown,
  computeConversionVelocityRanking,
  monthlyCompletedVolume,
  monthlyVolume,
  mortgageAmountDistribution,
} from '../../utils/aggregations';
import { monthLabelFromKey, resolvePeriodBounds } from '../../utils/dateUtils';
import { ALL_STATUS_ORDER, OTHER_CASE_TYPE_TOOLTIP, STATUS_LABELS, STATUS_TOOLTIPS, sortCaseTypeLabels } from '../../utils/constants';
import { formatCompactCurrency, formatCurrency, formatDirectionalDaysVsMarket, formatPercentage } from '../../utils/formatters';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { AppTooltip } from '../shared/AppTooltip';
import { FunnelPanel } from '../shared/FunnelPanel';
import { VolumeChartCard } from '../shared/VolumeChartCard';

interface LenderDashboardProps {
  selectedLender: string;
  stats: LenderStats | null;
  marketStats: MarketStats;
  periodData: MortgageCase[];
  period: TimePeriod;
  typicalLifecycleDays?: number | null;
}

export function LenderDashboard({
  selectedLender,
  stats,
  marketStats,
  periodData,
  period,
  typicalLifecycleDays = null,
}: LenderDashboardProps) {
  const [activePipelineStage, setActivePipelineStage] = useState<string | null>(null);
  const [volumeMetric, setVolumeMetric] = useState<'created' | 'completed'>('created');
  const [funnelMode, setFunnelMode] = useState<FunnelMode | undefined>(undefined);
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);

  if (!stats) {
    return (
      <section className="mt-8 rounded-xl border border-acre-border bg-white p-8 text-acre-muted">
        Lender metrics are still computing for the selected period...
      </section>
    );
  }

  const marketBrokerRevenuePerCase =
    periodData.length > 0
      ? periodData.reduce((sum, row) => sum + Math.max(0, row.totalBrokerFees ?? 0), 0) / periodData.length
      : 0;
  const benchmarkRows = [
    {
      label: 'Avg LTV',
      lenderValue: stats.avgLtv,
      marketValue: marketStats.avgLtv,
      lowerIsBetter: true,
      you: formatPercentage(stats.avgLtv),
      market: formatPercentage(marketStats.avgLtv),
    },
    {
      label: 'Broker revenue per case',
      lenderValue: stats.brokerRevenuePerCase,
      marketValue: marketBrokerRevenuePerCase,
      lowerIsBetter: false,
      you: formatCurrency(stats.brokerRevenuePerCase),
      market: formatCurrency(marketBrokerRevenuePerCase),
    },
    {
      label: 'Protection attach',
      lenderValue: stats.protectionAttachRate,
      marketValue: marketStats.protectionAttachRate,
      lowerIsBetter: false,
      you: formatPercentage(stats.protectionAttachRate),
      market: formatPercentage(marketStats.protectionAttachRate),
    },
    {
      label: 'Days to complete',
      lenderValue: stats.avgDaysToComplete,
      marketValue: marketStats.avgDaysToComplete,
      lowerIsBetter: true,
      you: `${Math.round(stats.avgDaysToComplete)}d`,
      market: `${Math.round(marketStats.avgDaysToComplete)}d`,
    },
    {
      label: 'Resubmission rate',
      lenderValue: stats.resubmissionRate,
      marketValue: marketStats.resubmissionRate,
      lowerIsBetter: true,
      you: formatPercentage(stats.resubmissionRate),
      market: formatPercentage(marketStats.resubmissionRate),
    },
  ];
  const conversionRank = computeConversionVelocityRanking(periodData, selectedLender);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  const totalNetRevenue = lenderRows.reduce((sum, row) => sum + Math.max(0, row.netCaseRevenue ?? 0), 0);
  const totalLoanValue = lenderRows.reduce((sum, row) => sum + Math.max(0, row.mortgageAmount ?? 0), 0);
  const lenderMonthlyCreatedVolume = monthlyVolume(lenderRows).map((row) => ({
    key: row.key,
    label: monthLabelFromKey(row.key),
    count: row.count,
  }));
  const lenderMonthlyCompletedVolume = monthlyCompletedVolume(lenderRows).map((row) => ({
    key: row.key,
    label: monthLabelFromKey(row.key),
    count: row.count,
  }));
  const volumeData = volumeMetric === 'created' ? lenderMonthlyCreatedVolume : lenderMonthlyCompletedVolume;
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
  const lenderCaseMix = caseTypeBreakdown(lenderRows, groupOtherCaseTypes);
  const marketCaseMix = caseTypeBreakdown(periodData, groupOtherCaseTypes);
  const caseMixMap = new Map(lenderCaseMix.map((row) => [row.label, row]));
  const marketCaseMixMap = new Map(marketCaseMix.map((row) => [row.label, row]));
  const lenderMortgageAmountDistribution = mortgageAmountDistribution(lenderRows);
  const marketMortgageAmountDistribution = mortgageAmountDistribution(periodData);
  const lenderMortgageAmountMap = new Map(lenderMortgageAmountDistribution.map((row) => [row.label, row]));
  const marketMortgageAmountMap = new Map(marketMortgageAmountDistribution.map((row) => [row.label, row]));
  const stageByStatus = new Map(stats.pipeline.map((row) => [row.status, row]));
  const marketStageByStatus = new Map(marketStats.pipeline.map((row) => [row.status, row]));
  const stageCards = ALL_STATUS_ORDER.map((status, index) => {
    const lenderStage = stageByStatus.get(status);
    const marketStage = marketStageByStatus.get(status);
    const previousStatus = index === 0 ? null : ALL_STATUS_ORDER[index - 1];
    const lenderPrev = previousStatus ? stageByStatus.get(previousStatus) : null;
    const marketPrev = previousStatus ? marketStageByStatus.get(previousStatus) : null;
    const lenderConversion = lenderPrev && lenderPrev.count > 0 && lenderStage ? lenderStage.count / lenderPrev.count : null;
    const marketConversion = marketPrev && marketPrev.count > 0 && marketStage ? marketStage.count / marketPrev.count : null;
    const lenderShare = stats.totalCases > 0 && lenderStage ? lenderStage.count / stats.totalCases : 0;
    const marketShare = marketStats.totalCases > 0 && marketStage ? marketStage.count / marketStats.totalCases : 0;
    const tooltipLines = {
      description: STATUS_TOOLTIPS[status],
      lenderConversion: lenderConversion === null ? 'Baseline stage' : formatPercentage(lenderConversion, 1),
      marketConversion: marketConversion === null ? 'Baseline stage' : formatPercentage(marketConversion, 1),
    };
    return {
      status,
      lenderCount: lenderStage?.count ?? 0,
      lenderShare,
      marketShare,
      tooltip: tooltipLines,
    };
  });
  const caseMixRows = sortCaseTypeLabels([...new Set([...caseMixMap.keys(), ...marketCaseMixMap.keys()])])
    .map((label) => {
      const lenderMix = caseMixMap.get(label);
      const marketMix = marketCaseMixMap.get(label);
      const lenderShare = lenderMix?.percentage ?? 0;
      const marketShare = marketMix?.percentage ?? 0;
      const lenderCount = lenderMix?.count ?? 0;
      const marketCount = marketMix?.count ?? 0;
      return {
        label,
        value: `${formatPercentage(lenderShare, 1)} | (${lenderCount.toLocaleString('en-GB')})`,
        percentage: lenderShare,
        marketValue: `${formatPercentage(marketShare, 1)} | (${marketCount.toLocaleString('en-GB')})`,
        marketPercentage: marketShare,
      };
    });
  const mortgageAmountRows = [
    ...marketMortgageAmountDistribution.map((row) => row.label),
    ...lenderMortgageAmountDistribution.map((row) => row.label).filter((label) => !marketMortgageAmountMap.has(label)),
  ].map((label) => {
    const lenderBand = lenderMortgageAmountMap.get(label);
    const marketBand = marketMortgageAmountMap.get(label);
    const lenderShare = lenderBand?.percentage ?? 0;
    const marketShare = marketBand?.percentage ?? 0;
    const lenderCount = lenderBand?.count ?? 0;
    const marketCount = marketBand?.count ?? 0;
    return {
      label,
      value: `${formatPercentage(lenderShare, 1)} | (${lenderCount.toLocaleString('en-GB')})`,
      percentage: lenderShare,
      marketValue: `${formatPercentage(marketShare, 1)} | (${marketCount.toLocaleString('en-GB')})`,
      marketPercentage: marketShare,
      marketAccent: 'rgba(61, 76, 249, 0.35)',
      accent: '#5B68FA',
    };
  });

  return (
    <section className="mt-3">
      <PageHeader
        title="Lender overview"
        subtitle={`${selectedLender} performance benchmarked against anonymised market averages`}
        showScoreExport
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3">
        <KpiCard
          label={withTimeFrameLabel('Conversion velocity rank', period)}
          value={`${conversionRank.rank} of ${conversionRank.total}`}
          subtitle="By avg days to offer"
          meta={
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-acre-purple">Faster offer speed ranks higher.</p>
              <AppTooltip content="Only lenders with at least 5 cases and valid submitted-to-offer dates are included in this ranking.">
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-acre-border bg-white text-[10px] text-acre-muted"
                  aria-label="Conversion rank eligibility"
                >
                  i
                </button>
              </AppTooltip>
            </div>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Your cases', period)}
          value={`${stats.totalCases.toLocaleString('en-GB')} cases`}
          subtitle={`Market share: ${formatPercentage(stats.marketShare, 1)}`}
        />
        <KpiCard
          label={withTimeFrameLabel('Total net revenue', period)}
          value={formatCompactCurrency(totalNetRevenue)}
          subtitle={`Total loan value: ${formatCompactCurrency(totalLoanValue)}`}
        />
        <KpiCard
          label={withTimeFrameLabel('Avg loan size', period)}
          value={formatCurrency(stats.avgLoanSize)}
        />
        <KpiCard
          label={withTimeFrameLabel('Completion rate', period)}
          value={formatPercentage(stats.completionRate)}
          subtitle={`Market avg: ${formatPercentage(marketStats.completedCases / Math.max(marketStats.totalCases, 1))}`}
          meta={
            <AppTooltip content="Completed cases as a proportion of all cases ever created for this lender in the selected period.">
              <p className="text-xs text-acre-muted">Completion metric definition</p>
            </AppTooltip>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Avg days to offer', period)}
          value={`${Math.round(stats.avgDaysToOffer)} days`}
          subtitle={`Market avg: ${Math.round(marketStats.avgDaysToOffer)} days`}
          meta={
            <p className={`text-xs font-medium ${stats.avgDaysToOffer <= marketStats.avgDaysToOffer ? 'text-green-700' : 'text-amber-700'}`}>
              {formatDirectionalDaysVsMarket(stats.avgDaysToOffer - marketStats.avgDaysToOffer)}
            </p>
          }
        />
      </div>

      <div className="mt-6">
        <VolumeChartCard
          title="Monthly volume"
          subtitle={
            volumeMetric === 'created'
              ? `Case creation by month for ${selectedLender}`
              : `Completed cases by month for ${selectedLender}`
          }
          ariaLabel={
            volumeMetric === 'created'
              ? 'Monthly created case volume chart for selected lender'
              : 'Monthly completed case volume chart for selected lender'
          }
          xAxisLabel="Month"
          data={volumeData}
          headerActions={
            <div className="inline-flex rounded-md border border-acre-border bg-acre-panel p-0.5" role="group" aria-label="Volume metric">
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  volumeMetric === 'created' ? 'bg-white text-acre-text shadow-sm' : 'text-acre-muted hover:text-acre-text'
                }`}
                onClick={() => setVolumeMetric('created')}
                aria-pressed={volumeMetric === 'created'}
              >
                Created
              </button>
              <button
                type="button"
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  volumeMetric === 'completed' ? 'bg-white text-acre-text shadow-sm' : 'text-acre-muted hover:text-acre-text'
                }`}
                onClick={() => setVolumeMetric('completed')}
                aria-pressed={volumeMetric === 'completed'}
              >
                Completed
              </button>
            </div>
          }
        />
      </div>
      <div className="mt-4">
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

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Your case mix vs market"
          subtitle="Case-type distribution"
          rows={caseMixRows}
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
          <h3 className="text-2xl font-semibold text-acre-text">Performance benchmarks</h3>
          <div className="mt-3 grid grid-cols-[1.3fr_0.8fr_0.8fr] gap-2 text-[10px] font-semibold uppercase tracking-wide text-acre-muted">
            <span>Metric</span>
            <span>{selectedLender}</span>
            <span>Market avg</span>
          </div>
          <div className="mt-4 space-y-2">
            {benchmarkRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1.3fr_0.8fr_0.8fr] gap-2 border-b border-acre-border py-2 text-sm">
                <span className="inline-flex items-center gap-2 text-acre-text">
                  <AppTooltip
                    content={
                      Math.abs(row.lenderValue - row.marketValue) <= Math.abs(row.marketValue) * 0.01
                        ? 'At market average'
                        : undefined
                    }
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        Math.abs(row.lenderValue - row.marketValue) <= Math.abs(row.marketValue) * 0.01
                          ? 'bg-gray-400'
                          : row.lowerIsBetter
                            ? row.lenderValue < row.marketValue
                              ? 'bg-green-600'
                              : 'bg-amber-500'
                            : row.lenderValue > row.marketValue
                              ? 'bg-green-600'
                              : 'bg-amber-500'
                      }`}
                    />
                  </AppTooltip>
                  {row.label}
                </span>
                <span className="text-acre-purple">{row.you}</span>
                <span className="text-acre-muted">{row.market}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-acre-muted">
            Broker revenue is proc fee paid by the lender plus broker fees charged to the client.
          </p>
        </section>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <HorizontalDistribution
          title="Mortgage amount distribution (you vs market)"
          subtitle="Share of cases by mortgage amount band"
          rows={mortgageAmountRows}
          hideZeroRows
          valueColumnPx={128}
          singleLineValue
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Your pipeline vs market conversion rates</h3>
        <p className="mt-1 text-sm text-acre-muted">
          All comparisons are against anonymised aggregate market averages.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 desktop-md:grid-cols-6">
          {stageCards.map((stage) => (
            <AppTooltip
              key={stage.status}
              content={
                <>
                  <p className="font-semibold text-white">{STATUS_LABELS[stage.status]}</p>
                  <p className="mt-1 text-white/85">{stage.tooltip.description}</p>
                  <div className="mt-2 space-y-0.5 border-t border-white/25 pt-2">
                    <p className="text-white/85">
                      Lender conversion: <span className="font-semibold text-white">{stage.tooltip.lenderConversion}</span>
                    </p>
                    <p className="text-white/85">
                      Market conversion: <span className="font-semibold text-white">{stage.tooltip.marketConversion}</span>
                    </p>
                  </div>
                </>
              }
              wrapperClassName="!block w-full"
              panelClassName="w-64"
            >
              <article
                className={`relative rounded-lg p-3 text-center transition ${
                  activePipelineStage && activePipelineStage !== stage.status ? 'opacity-45' : 'opacity-100'
                } ${stage.status === 'NOT_PROCEEDING' ? 'bg-red-50 hover:bg-red-100' : 'bg-acre-purple-bg hover:bg-[#EEF0FF]'}`}
                onMouseEnter={() => setActivePipelineStage(stage.status)}
                onMouseLeave={() => setActivePipelineStage(null)}
                onFocus={() => setActivePipelineStage(stage.status)}
                onBlur={() => setActivePipelineStage(null)}
                tabIndex={0}
              >
                <p className={`text-2xl font-semibold ${stage.status === 'NOT_PROCEEDING' ? 'text-red-700' : 'text-acre-purple'}`}>
                  {stage.lenderCount.toLocaleString('en-GB')}
                </p>
                <p className={`text-xs ${stage.status === 'NOT_PROCEEDING' ? 'text-red-700' : 'text-acre-muted'}`}>
                  {STATUS_LABELS[stage.status]}
                </p>
                <p className={`mt-1 text-[11px] ${stage.status === 'NOT_PROCEEDING' ? 'text-red-700' : 'text-acre-muted'}`}>
                  {formatPercentage(stage.lenderShare, 1)} of your cases
                </p>
                <p className={`text-[11px] ${stage.status === 'NOT_PROCEEDING' ? 'text-red-700' : 'text-acre-muted'}`}>
                  Market avg: {formatPercentage(stage.marketShare, 1)}
                </p>
                <span className="sr-only">
                  Lender conversion: {stage.tooltip.lenderConversion}. Market conversion: {stage.tooltip.marketConversion}.
                </span>
              </article>
            </AppTooltip>
          ))}
        </div>
      </section>
    </section>
  );
}

