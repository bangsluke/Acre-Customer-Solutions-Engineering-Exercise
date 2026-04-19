import { format as formatDate } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DateRange, FunnelMode, FunnelScope, MortgageCase } from '../../types/mortgage';
import { STATUS_LABELS } from '../../utils/constants';
import { formatNumber, formatPercentage } from '../../utils/formatters';
import { computePipelineFunnel, computeStageDistribution } from '../../utils/funnelMetrics';
import { AppTooltip } from './AppTooltip';
import { FunnelRow } from './FunnelRow';

interface FunnelPanelProps {
  cases: MortgageCase[];
  title: string;
  scope: FunnelScope;
  dateRange: DateRange;
  mode?: FunnelMode;
  onModeChange?: (mode: FunnelMode) => void;
  typicalLifecycleDays?: number | null;
  onStagesSkippedChange?: (value: number) => void;
}

const modeStorageKey: Record<FunnelScope, string> = {
  internal: 'funnel-mode:internal',
  lender: 'funnel-mode:lender',
};

const STAGE_GROUP_TOOLTIPS: Record<string, string> = {
  LEAD: 'Stage 1 LEAD: Contains: LEAD',
  RECOMMENDATION: 'Stage 2 RECOMMENDATION: Contains: PRE_RECOMMENDATION, POST_RECOMMENDATION_REVIEW',
  APPLICATION: 'Stage 3 APPLICATION: Contains: PRE_APPLICATION, REVIEW, APPLICATION_SUBMITTED, REFERRED',
  OFFER: 'Stage 4 OFFER: Contains: AWAITING_VALUATION, AWAITING_OFFER, OFFER_RECEIVED',
  COMPLETION: 'Stage 5 COMPLETION: Contains: EXCHANGE, COMPLETE',
};

function getStoredMode(scope: FunnelScope): FunnelMode {
  if (typeof window === 'undefined') {
    return 'funnel';
  }
  const value = window.localStorage.getItem(modeStorageKey[scope]);
  return value === 'distribution' ? 'distribution' : 'funnel';
}

function toRangeLabel(dateRange: DateRange): string {
  return `${formatDate(dateRange.start, 'd MMM yyyy')} - ${formatDate(dateRange.end, 'd MMM yyyy')}`;
}

function stageTooltipContent(stage: string, metricsText: string): ReactNode {
  const stageGroupText = STAGE_GROUP_TOOLTIPS[stage];
  if (!stageGroupText) {
    return metricsText;
  }
  return (
    <div>
      <div>{stageGroupText}</div>
      <div>{metricsText}</div>
    </div>
  );
}

function renderStageLabel(stage: string): ReactNode {
  const label = STATUS_LABELS[stage as keyof typeof STATUS_LABELS] ?? stage;
  const tooltip = STAGE_GROUP_TOOLTIPS[stage];
  if (!tooltip) {
    return <span className="text-acre-text">{label}</span>;
  }
  return (
    <span
      className="cursor-help text-acre-text underline decoration-dotted underline-offset-2"
      aria-label={`${label}: ${tooltip}`}
    >
      {label}
    </span>
  );
}

export function FunnelPanel({
  cases,
  title,
  scope,
  dateRange,
  mode,
  onModeChange,
  typicalLifecycleDays = null,
  onStagesSkippedChange,
}: FunnelPanelProps) {
  const isControlled = mode !== undefined;
  const [internalMode, setInternalMode] = useState<FunnelMode>(() => getStoredMode(scope));
  const [excludeProductTransfers, setExcludeProductTransfers] = useState(true);
  const [activeBarKey, setActiveBarKey] = useState<string | null>(null);
  const activeMode = isControlled ? mode : internalMode;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(modeStorageKey[scope], activeMode);
  }, [scope, activeMode]);

  useEffect(() => {
    setInternalMode(getStoredMode(scope));
  }, [scope]);

  const distributionResult = useMemo(() => computeStageDistribution(cases, dateRange), [cases, dateRange]);
  const pipelineResult = useMemo(
    () =>
      computePipelineFunnel(cases, dateRange, {
        excludeProductTransfers,
        typicalLifecycleDays,
      }),
    [cases, dateRange, excludeProductTransfers, typicalLifecycleDays],
  );

  useEffect(() => {
    onStagesSkippedChange?.(pipelineResult.stagesSkipped);
  }, [pipelineResult.stagesSkipped, onStagesSkippedChange]);

  function handleModeChange(nextMode: FunnelMode): void {
    if (!isControlled) {
      setInternalMode(nextMode);
    }
    onModeChange?.(nextMode);
  }

  const maxDistributionCount = Math.max(...distributionResult.rows.map((row) => row.count), 1);
  const maxFunnelCount = Math.max(...pipelineResult.rows.map((row) => row.count), 1);
  const sectionTitle = activeMode === 'distribution' ? 'Stage Distribution' : title;
  return (
    <section className="rounded-xl border border-acre-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-semibold text-acre-text">{sectionTitle}</h3>
          <p className="mt-1 text-sm text-acre-muted">
            {activeMode === 'distribution'
              ? 'Current status of all cases in the selected period.'
              : `Cohort: cases created in ${toRangeLabel(dateRange)}. Conversion shown stage-to-stage / cumulative.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex items-center gap-2 rounded-md" role="group" aria-label="Funnel view mode">
            <button
              type="button"
              aria-pressed={activeMode === 'funnel'}
              className={`inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm font-normal leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple ${
                activeMode === 'funnel'
                  ? 'border-acre-purple bg-acre-purple-bg text-acre-purple'
                  : 'border-acre-border bg-white text-acre-muted hover:border-acre-purple-light hover:text-acre-text'
              }`}
              onClick={() => handleModeChange('funnel')}
            >
              Pipeline funnel
            </button>
            <button
              type="button"
              aria-pressed={activeMode === 'distribution'}
              className={`inline-flex h-[34px] items-center gap-2 rounded-md border px-3 text-sm font-normal leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple ${
                activeMode === 'distribution'
                  ? 'border-acre-purple bg-acre-purple-bg text-acre-purple'
                  : 'border-acre-border bg-white text-acre-muted hover:border-acre-purple-light hover:text-acre-text'
              }`}
              onClick={() => handleModeChange('distribution')}
            >
              Stage distribution
            </button>
          </div>
          <AppTooltip
            content="Pipeline funnel shows cohort conversion - the % of cases created in this period that reached each milestone. Stage distribution shows where cases currently sit in their lifecycle."
          >
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-acre-border bg-white text-xs text-acre-muted"
              aria-label="Funnel mode information"
            >
              i
            </button>
          </AppTooltip>
        </div>
      </div>

      {activeMode === 'funnel' ? (
        <>
          <div className="mt-4 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-acre-text">
              <input
                type="checkbox"
                checked={excludeProductTransfers}
                onChange={(event) => setExcludeProductTransfers(event.target.checked)}
                className="h-4 w-4 rounded border-acre-border text-acre-purple focus:ring-acre-purple"
              />
              Exclude product transfers
            </label>
          </div>
          {pipelineResult.inFlightWarning.shouldWarn ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Cases in this period may still be in flight. Completion rates will look artificially low. Cases created before{' '}
              {pipelineResult.inFlightWarning.maturedCutoffDate
                ? formatDate(pipelineResult.inFlightWarning.maturedCutoffDate, 'd MMM yyyy')
                : '-'}{' '}
              are fully matured.
            </div>
          ) : null}
        </>
      ) : null}

      {activeMode === 'distribution' ? (
        <div className="mt-5 border-b border-acre-border pb-2 text-xs font-semibold uppercase tracking-wide text-acre-muted">
          <div className="grid grid-cols-[1.2fr_2.4fr_1.8fr] gap-3">
            <span>Stage</span>
            <span>Relative volume</span>
            <span className="text-right">Volume (share of total)</span>
          </div>
        </div>
      ) : null}

      {activeMode === 'distribution' ? (
        <div className="mt-4 space-y-3">
          {distributionResult.rows
            .filter((row) => row.stage !== 'NOT_PROCEEDING')
            .concat(distributionResult.rows.filter((row) => row.stage === 'NOT_PROCEEDING'))
            .map((row) => (
              <AppTooltip
                key={row.stage}
                content={stageTooltipContent(
                  row.stage,
                  `${STATUS_LABELS[row.stage]}: ${formatNumber(row.count)} (${formatPercentage(row.shareOfTotal, 1)})`,
                )}
                wrapperClassName="!block w-full"
                side="bottom"
              >
                <div
                  className={`transition ${activeBarKey && activeBarKey !== `distribution-${row.stage}` ? 'opacity-45' : 'opacity-100'}`}
                  onMouseEnter={() => setActiveBarKey(`distribution-${row.stage}`)}
                  onMouseLeave={() => setActiveBarKey(null)}
                  onFocus={() => setActiveBarKey(`distribution-${row.stage}`)}
                  onBlur={() => setActiveBarKey(null)}
                  tabIndex={0}
                >
                  <FunnelRow
                    label={renderStageLabel(row.stage)}
                    valueLabel={`${formatNumber(row.count)} (${formatPercentage(row.shareOfTotal, 1)})`}
                    barPercent={(row.count / maxDistributionCount) * 100}
                    barColorClassName={row.stage === 'NOT_PROCEEDING' ? 'bg-red-500' : 'bg-acre-purple'}
                    dividerAbove={row.stage === 'NOT_PROCEEDING'}
                  />
                </div>
              </AppTooltip>
            ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 desktop-md:grid-cols-[2.4fr_1fr]">
          <div>
            <div className="border-b border-acre-border pb-2 text-xs font-semibold uppercase tracking-wide text-acre-muted">
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.2fr 2.4fr 0.9fr 1.1fr 1.1fr 0.9fr' }}>
                <span>Stage</span>
                <span>Volume</span>
                <span className="text-right">Count</span>
                <span className="text-right">Stage conversion</span>
                <span className="text-right">Cumulative conversion</span>
                <span className="text-right">Median days</span>
              </div>
            </div>
            <div className="mt-3 space-y-3">
            {pipelineResult.rows.map((row) => (
              <AppTooltip
                key={row.stage}
                content={stageTooltipContent(
                  row.stage,
                  `${STATUS_LABELS[row.stage]}: ${formatNumber(row.count)} | Stage ${row.stageConversion === null ? '-' : formatPercentage(row.stageConversion, 1)} | Cumulative ${formatPercentage(row.cumulativeConversion, 1)}`,
                )}
                wrapperClassName="!block w-full"
                side="bottom"
              >
                <div
                  className={`grid items-center gap-3 text-sm transition ${
                    activeBarKey && activeBarKey !== `funnel-${row.stage}` ? 'opacity-45' : 'opacity-100'
                  }`}
                  style={{ gridTemplateColumns: '1.2fr 2.4fr 0.9fr 1.1fr 1.1fr 0.9fr' }}
                  onMouseEnter={() => setActiveBarKey(`funnel-${row.stage}`)}
                  onMouseLeave={() => setActiveBarKey(null)}
                  onFocus={() => setActiveBarKey(`funnel-${row.stage}`)}
                  onBlur={() => setActiveBarKey(null)}
                  tabIndex={0}
                >
                  {renderStageLabel(row.stage)}
                  <FunnelRow valueLabel="" barPercent={(row.count / maxFunnelCount) * 100} variant="barOnly" />
                  <span className="text-right text-acre-muted">{formatNumber(row.count)}</span>
                  <span className="text-right text-acre-muted">{row.stageConversion === null ? '-' : formatPercentage(row.stageConversion, 1)}</span>
                  <span className="text-right text-acre-muted">{formatPercentage(row.cumulativeConversion, 1)}</span>
                  <span className="text-right text-acre-muted">{row.medianDaysFromPrev === null ? '-' : row.medianDaysFromPrev}</span>
                </div>
              </AppTooltip>
            ))}
            </div>
          </div>
          <section className="rounded-lg border border-acre-border bg-acre-panel p-4">
            <h4 className="text-base font-semibold text-acre-text">Exit analysis</h4>
            <p className="mt-1 text-sm text-acre-muted">
              Exit rate: {formatPercentage(pipelineResult.exitAnalysis.exitRate, 1)} ({formatNumber(pipelineResult.exitAnalysis.exitedCases)} exits)
            </p>
            <div className="mt-3 space-y-2">
              {pipelineResult.exitAnalysis.breakdown
                .filter((row) => row.count > 0 || row.stage === 'LEAD')
                .map((row) => (
                  <AppTooltip
                    key={`exit-${row.stage}`}
                    content={`${STATUS_LABELS[row.stage]} exits: ${formatPercentage(row.percentage, 1)}`}
                    wrapperClassName="!block w-full"
                    side="bottom"
                  >
                    <div
                      className={`transition ${activeBarKey && activeBarKey !== `exit-${row.stage}` ? 'opacity-45' : 'opacity-100'}`}
                      onMouseEnter={() => setActiveBarKey(`exit-${row.stage}`)}
                      onMouseLeave={() => setActiveBarKey(null)}
                      onFocus={() => setActiveBarKey(`exit-${row.stage}`)}
                      onBlur={() => setActiveBarKey(null)}
                      tabIndex={0}
                    >
                      <div className="grid items-center gap-3 text-sm text-acre-text" style={{ gridTemplateColumns: '110px minmax(0, 84px) 52px' }}>
                        <span>{STATUS_LABELS[row.stage]}</span>
                        <div className="h-4 rounded-full bg-acre-panel">
                          <div className="h-4 rounded-full bg-red-500" style={{ width: `${Math.max(8, row.percentage * 100)}%` }} />
                        </div>
                        <span className="text-right text-acre-muted">{formatPercentage(row.percentage, 1)}</span>
                      </div>
                    </div>
                  </AppTooltip>
                ))}
            </div>
            <p className="mt-2 text-xs text-acre-muted">Stages skipped backfilled in cohort: {formatNumber(pipelineResult.stagesSkipped)}</p>
          </section>
        </div>
      )}

      {activeMode === 'distribution' ? (
        <p className="mt-4 text-xs text-acre-muted">
          System / data states excluded from funnel stages: {distributionResult.excludedSystemStateCount.toLocaleString('en-GB')} (IMPORTING,
          IMPORTED_COMPLETE)
        </p>
      ) : null}
    </section>
  );
}
