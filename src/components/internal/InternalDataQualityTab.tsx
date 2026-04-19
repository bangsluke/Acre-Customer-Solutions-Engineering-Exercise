import type { MortgageCase, ParseQualityReport, RawCaseStatus, TimePeriod } from '../../types/mortgage';
import { resolvePeriodBounds } from '../../utils/dateUtils';
import { formatPercentage } from '../../utils/formatters';
import { computePipelineFunnel } from '../../utils/funnelMetrics';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { AppTooltip } from '../shared/AppTooltip';

function countOutOfOrderLifecycleRows(periodData: MortgageCase[]) {
  let count = 0;
  for (const row of periodData) {
    if (row.firstOfferDate && row.firstSubmittedDate && row.firstOfferDate.getTime() < row.firstSubmittedDate.getTime()) {
      count += 1;
      continue;
    }
    if (row.completionDate && row.firstOfferDate && row.completionDate.getTime() < row.firstOfferDate.getTime()) {
      count += 1;
    }
  }
  return count;
}

function qualityCount(report: ParseQualityReport, key: string) {
  return report.dateParseFailures[key] ?? 0;
}

function isBlankLender(lender: string): boolean {
  const normalized = lender.trim().toLowerCase();
  return !normalized || normalized === 'blank lender' || normalized === 'blank' || normalized === 'unknown lender' || normalized === 'unknown';
}

const BLANK_LENDER_BEYOND_APPLICATION_STATUSES = new Set<RawCaseStatus>([
  'PRE_APPLICATION',
  'REVIEW',
  'APPLICATION_SUBMITTED',
  'REFERRED',
  'AWAITING_VALUATION',
  'AWAITING_OFFER',
  'OFFER_RECEIVED',
  'EXCHANGE',
  'COMPLETE',
]);

export function InternalDataQualityTab({
  periodData,
  quality,
  period,
}: {
  periodData: MortgageCase[];
  quality: ParseQualityReport;
  period: TimePeriod;
}) {
  if (periodData.length === 0) {
    return <EmptyState title="No data quality data in this period" />;
  }

  const excludedLtvOver150 = periodData.filter((row) => row.ltv !== null && row.ltv > 1.5).length;
  const nullLtv = periodData.filter((row) => row.ltv === null).length;
  const zeroMortgage = periodData.filter((row) => (row.mortgageAmount ?? 0) <= 0).length;
  const outOfOrder = countOutOfOrderLifecycleRows(periodData);
  const totalCases = Math.max(periodData.length, 1);
  const blankLenderCount = periodData.filter((row) => isBlankLender(row.lender)).length;
  const blankLenderBeyondApplicationCount = periodData.filter(
    (row) => isBlankLender(row.lender) && BLANK_LENDER_BEYOND_APPLICATION_STATUSES.has(row.caseStatus),
  ).length;
  const invalidMortgageClassCount = periodData.filter((row) => row.initialRateTypeRaw === 'INVALID_MORTGAGE_CLASS').length;
  const invalidCancellationReasonCount = periodData.filter(
    (row) => row.notProceedingReason === 'INVALID_CANCELLATION_REASON',
  ).length;
  const latestCreatedAt = periodData.reduce<Date | null>((latest, row) => {
    if (!row.createdAt) {
      return latest;
    }
    if (!latest || row.createdAt.getTime() > latest.getTime()) {
      return row.createdAt;
    }
    return latest;
  }, null);
  const dateRange = resolvePeriodBounds(period, latestCreatedAt ?? undefined);
  const funnelQuality = computePipelineFunnel(periodData, dateRange, { excludeProductTransfers: true });

  return (
    <section className="mt-3">
      <PageHeader title="Data Quality" subtitle="Explicitly surfaced exclusions and parse quality checks" />
      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard
          label={withTimeFrameLabel('Rows with blank lender', period)}
          value={blankLenderCount.toLocaleString('en-GB')}
          subtitle={formatPercentage(blankLenderCount / totalCases, 1)}
        />
        <KpiCard
          label={withTimeFrameLabel('Blank lender rows beyond Application stage', period)}
          value={blankLenderBeyondApplicationCount.toLocaleString('en-GB')}
          subtitle={formatPercentage(blankLenderBeyondApplicationCount / totalCases, 1)}
          meta={
            <p className="text-xs text-acre-muted">
              Includes statuses
              {' '}
              <AppTooltip content="PRE_APPLICATION, REVIEW, APPLICATION_SUBMITTED, REFERRED, AWAITING_VALUATION, AWAITING_OFFER, OFFER_RECEIVED, EXCHANGE, COMPLETE">
                <span className="cursor-help underline decoration-dotted underline-offset-2">from pre-application through completion</span>
              </AppTooltip>
              .
            </p>
          }
        />
        <KpiCard
          label={withTimeFrameLabel('Rows with null LTV', period)}
          value={nullLtv.toLocaleString('en-GB')}
          subtitle={formatPercentage(nullLtv / totalCases, 1)}
        />
        <KpiCard
          label={withTimeFrameLabel('Rows with zero mortgage amount', period)}
          value={zeroMortgage.toLocaleString('en-GB')}
          subtitle={formatPercentage(zeroMortgage / totalCases, 1)}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-acre-panel p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Data quality (internal only)</h3>
        <p className="mt-1 text-sm text-acre-muted">Explicitly surfaced exclusions and parse quality checks</p>
        <div className="mt-4 grid grid-cols-1 gap-3 desktop-md:grid-cols-2">
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases excluded due to LTV &gt; 1.5:{' '}
            <span className="font-semibold">
              {excludedLtvOver150.toLocaleString('en-GB')} ({formatPercentage(excludedLtvOver150 / totalCases)} of all cases)
            </span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with null LTV:{' '}
            <span className="font-semibold">
              {nullLtv.toLocaleString('en-GB')} ({formatPercentage(nullLtv / totalCases)} of all cases)
            </span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with zero mortgage amount:{' '}
            <span className="font-semibold">
              {zeroMortgage.toLocaleString('en-GB')} ({formatPercentage(zeroMortgage / totalCases)} of all cases)
            </span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Out-of-order lifecycle dates:{' '}
            <span className="font-semibold">
              {outOfOrder.toLocaleString('en-GB')} ({formatPercentage(outOfOrder / totalCases)} of all cases)
            </span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Backfilled skipped stages in cohort funnel:{' '}
            <span className="font-semibold">
              {funnelQuality.stagesSkipped.toLocaleString('en-GB')} ({formatPercentage(funnelQuality.stagesSkipped / totalCases)} of all cases)
            </span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Date parse failures (`created_at`): <span className="font-semibold">{qualityCount(quality, 'created_at').toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Date parse failures (`first_submitted_date`):{' '}
            <span className="font-semibold">{qualityCount(quality, 'first_submitted_date').toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with initial_rate_type = `INVALID_MORTGAGE_CLASS`:{' '}
            <span className="font-semibold">{invalidMortgageClassCount.toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with `not_proceeding_reason` = `INVALID_CANCELLATION_REASON`:{' '}
            <span className="font-semibold">{invalidCancellationReasonCount.toLocaleString('en-GB')}</span>
          </div>
        </div>
      </section>
    </section>
  );
}
