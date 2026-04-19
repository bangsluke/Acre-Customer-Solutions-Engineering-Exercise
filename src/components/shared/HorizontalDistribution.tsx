import { useState } from 'react';
import { formatNumber } from '../../utils/formatters';
import { AppTooltip } from './AppTooltip';

interface Row {
  label: string;
  value: string;
  percentage: number;
  casesCount?: number;
  marketValue?: string;
  marketPercentage?: number;
  accent?: string;
  marketAccent?: string;
  badge?: string;
}

interface OtherDisclosureConfig {
  tooltip: string;
  expanded: boolean;
  onToggle: () => void;
  expandLabel?: string;
  groupLabel?: string;
}

export function HorizontalDistribution({
  title,
  subtitle,
  rows,
  hideZeroRows = false,
  valueColumnPx = 64,
  singleLineValue = false,
  otherDisclosure,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  hideZeroRows?: boolean;
  valueColumnPx?: number;
  singleLineValue?: boolean;
  otherDisclosure?: OtherDisclosureConfig;
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const displayRows = hideZeroRows
    ? rows.filter((row) => row.percentage > 0 || (row.marketPercentage ?? 0) > 0)
    : rows;
  const maxLabelLength = displayRows.reduce((max, row) => Math.max(max, row.label.length), 0);
  const labelColumnPx = Math.min(360, Math.max(140, Math.round(maxLabelLength * 7.5)));

  return (
    <section className="rounded-xl border border-acre-border bg-white p-5">
      <h3 className="text-2xl font-semibold text-acre-text">{title}</h3>
      <p className="mt-1 text-sm text-acre-muted">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {displayRows.map((row) => {
          const tooltipText = `${row.label}: ${row.value}${typeof row.casesCount === 'number' ? ` | Total cases: ${formatNumber(row.casesCount)}` : ''}${row.marketValue ? ` | Market: ${row.marketValue}` : ''}`;
          return (
            <AppTooltip
              key={row.label}
              content={tooltipText}
              wrapperClassName="!block w-full"
              panelClassName="z-40"
            >
              <div
                className={`relative grid items-center gap-3 rounded-md text-sm transition ${
                  activeLabel && activeLabel !== row.label ? 'opacity-45' : 'opacity-100'
                }`}
                style={{ gridTemplateColumns: `${labelColumnPx}px minmax(0, 1fr) ${valueColumnPx}px` }}
                onMouseEnter={() => setActiveLabel(row.label)}
                onMouseLeave={() => setActiveLabel(null)}
                onFocus={() => setActiveLabel(row.label)}
                onBlur={() => setActiveLabel(null)}
                tabIndex={0}
              >
                <span className="inline-flex items-center gap-2 whitespace-nowrap text-acre-text">
                  {row.label === 'Other' && otherDisclosure ? (
                    <AppTooltip content={otherDisclosure.tooltip}>
                      <span className="cursor-help border-b border-dotted border-current leading-none">{row.label}</span>
                    </AppTooltip>
                  ) : (
                    row.label
                  )}
                  {row.badge ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
                      {row.badge}
                    </span>
                  ) : null}
                </span>
                <div className="relative h-4 rounded-full bg-acre-panel">
                  {typeof row.marketPercentage === 'number' ? (
                    <div
                      className="absolute h-4 rounded-full"
                      style={{
                        width: `${Math.round(row.marketPercentage * 100)}%`,
                        background: row.marketAccent ?? 'rgba(61, 76, 249, 0.35)',
                      }}
                    />
                  ) : null}
                  <div
                    className="relative h-4 rounded-full transition-opacity"
                    style={{
                      width: `${Math.round(row.percentage * 100)}%`,
                      background: row.accent ?? '#3D4CF9',
                    }}
                  />
                </div>
                <span className={`text-right text-acre-muted ${singleLineValue ? 'whitespace-nowrap' : ''}`}>
                  {row.value}
                  {row.marketValue ? (
                    <span className={`block text-[11px] text-acre-muted ${singleLineValue ? 'whitespace-nowrap' : ''}`}>Mkt: {row.marketValue}</span>
                  ) : null}
                </span>
                <span className="sr-only">{tooltipText}</span>
              </div>
            </AppTooltip>
          );
        })}
      </div>
      {otherDisclosure ? (
        <button
          type="button"
          className="mt-4 text-sm font-medium text-acre-purple underline-offset-2 hover:underline"
          onClick={otherDisclosure.onToggle}
        >
          {otherDisclosure.expanded ? otherDisclosure.groupLabel ?? 'Group Other' : otherDisclosure.expandLabel ?? 'Expand Other'}
        </button>
      ) : null}
    </section>
  );
}

