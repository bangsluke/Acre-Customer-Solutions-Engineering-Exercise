import type { FunnelStage } from '../../types/mortgage';
import { AppTooltip } from './AppTooltip';

const FUNNEL_PURPLE = '#3D4CF9';
const DROPOFF_RED = '#ef4444';
const FUNNEL_STAGE_ORDER = ['LEAD', 'RECOMMENDATION', 'APPLICATION', 'OFFER', 'COMPLETION', 'NOT_PROCEEDING'] as const;

export function Funnel({
  title,
  subtitle,
  rows,
  excludedSystemStateCount = 0,
  excludedSystemStateTooltipText,
}: {
  title: string;
  subtitle: string;
  rows: FunnelStage[];
  excludedSystemStateCount?: number;
  excludedSystemStateTooltipText?: string;
}) {
  const conversionTooltipText =
    'Conversion % is stage-entry count vs prior stage, meaning values marked with * can be above 100%.';
  const avgDaysTooltipText =
    'Avg days is calculated from lifecycle dates (created_at to first_submitted_date to first_offer_date to completion_date).';
  const normalisedRows = rows.map((row) => ({ ...row, name: row.name.trim() }));
  const funnelRows = FUNNEL_STAGE_ORDER
    .map((stageName) => normalisedRows.find((row) => row.stage === stageName))
    .filter((row): row is FunnelStage => Boolean(row));
  const maxValue = Math.max(...funnelRows.map((row) => row.value), 1);
  const stageRowClass = 'flex h-11 items-center text-sm text-acre-text';
  const valueRowClass = 'flex h-11 items-center text-sm text-slate-600';
  const daysRowClass = 'flex h-11 items-center text-sm text-acre-muted';
  const chartGridClass = 'grid grid-cols-[1.2fr_2.4fr_1.8fr_0.9fr] gap-3 md:gap-4';

  return (
    <section className="rounded-xl border border-acre-border bg-white p-5">
      <div className="flex items-center gap-2">
        <h3 className="text-2xl font-semibold text-acre-text">{title}</h3>
        {excludedSystemStateTooltipText ? (
          <AppTooltip content={excludedSystemStateTooltipText} side="bottom">
            <span
              aria-label="Excluded system states information"
              className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-acre-border text-xs font-semibold text-acre-muted"
            >
              i
            </span>
          </AppTooltip>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-acre-muted">{subtitle}</p>

      <div className={`mt-5 ${chartGridClass} border-b border-acre-border pb-2 text-xs uppercase tracking-wide text-acre-muted`}>
        <span>Stage</span>
        <span className="text-center">Relative volume</span>
        <AppTooltip content={conversionTooltipText}>
          <span className="decoration-dotted underline underline-offset-4">Volume (conversion*)</span>
        </AppTooltip>
        <AppTooltip content={avgDaysTooltipText}>
          <span className="decoration-dotted underline underline-offset-4">Avg days</span>
        </AppTooltip>
      </div>

      <div className={chartGridClass}>
        <div className="min-w-0 py-2">
          {funnelRows.map((row) => (
            <div
              key={`${row.name}-stage`}
              className={`${stageRowClass} pr-1 ${row.stage === 'NOT_PROCEEDING' ? 'text-red-700' : ''}`}
            >
              <AppTooltip content={row.description}>
                <span
                  className="whitespace-nowrap decoration-dotted underline-offset-4 hover:underline"
                  style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted' }}
                >
                  {row.name}
                </span>
              </AppTooltip>
            </div>
          ))}
        </div>

        <div className="min-w-0 py-2" role="img" aria-label="Pipeline stage volume bars">
          {funnelRows.map((row) => {
            const widthPercent = Math.max(8, Math.round((row.value / maxValue) * 90));
            const barColor = row.stage === 'NOT_PROCEEDING' ? DROPOFF_RED : FUNNEL_PURPLE;
            return (
              <div key={`${row.name}-bar`} className={`${stageRowClass} justify-center`}>
                <AppTooltip content={`${row.name}: ${row.value.toLocaleString('en-GB')} cases`} wrapperClassName="!block w-full">
                  <div
                    className="mx-auto h-9 rounded-md"
                    style={{ width: `${widthPercent}%`, backgroundColor: barColor }}
                  />
                </AppTooltip>
              </div>
            );
          })}
        </div>

        <div className="min-w-0 py-2">
          {funnelRows.map((row) => (
            <div
              key={`${row.name}-value`}
              className={`${valueRowClass} min-w-0`}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                {row.pctPrev !== null && row.pctPrev <= 5 ? <span className="text-xs text-acre-muted">very low</span> : null}
                <span className="truncate">
                  {row.value.toLocaleString('en-GB')}{' '}
                </span>
                <span className="truncate text-acre-muted">
                  ({row.pctPrev === null
                    ? 'baseline'
                    : row.stage === 'NOT_PROCEEDING'
                      ? `${(row.pctTotal ?? 0).toLocaleString('en-GB')}% of total`
                      : `${row.pctPrev.toLocaleString('en-GB')}%${row.pctPrev >= 100 ? '*' : ''}`})
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="min-w-0 py-2">
          {funnelRows.map((row) => (
            <div key={`${row.name}-days`} className={daysRowClass}>
              {row.avgDays === null ? '---' : `~${Math.round(row.avgDays)} days`}
            </div>
          ))}
        </div>
      </div>

      {excludedSystemStateCount > 0 ? (
        <p className="sr-only">
          System / data states excluded from funnel stages: {excludedSystemStateCount.toLocaleString('en-GB')} (IMPORTING,
          IMPORTED_COMPLETE).
        </p>
      ) : null}
    </section>
  );
}
