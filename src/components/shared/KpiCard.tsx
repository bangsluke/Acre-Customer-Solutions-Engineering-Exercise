import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtitle?: string;
  rightBadge?: ReactNode;
  meta?: ReactNode;
  valueClassName?: string;
  subtitleClassName?: string;
}

const TIMEFRAME_SUFFIXES = ['THIS YEAR', 'THIS HALF', 'THIS QUARTER', 'THIS MONTH', 'CUSTOM RANGE'] as const;

function splitKpiLabel(label: string): { primary: string; suffix: string | null } {
  const match = TIMEFRAME_SUFFIXES.find((suffix) => label.endsWith(` ${suffix}`));
  if (!match) {
    return { primary: label, suffix: null };
  }
  return {
    primary: label.slice(0, -(` ${match}`).length),
    suffix: match,
  };
}

export function KpiCard({ label, value, subtitle, rightBadge, meta, valueClassName, subtitleClassName }: KpiCardProps) {
  const splitLabel = splitKpiLabel(label);

  return (
    <article className="rounded-xl border border-acre-border bg-acre-panel px-5 py-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-acre-muted">
        <span className="block">{splitLabel.primary}</span>
        {splitLabel.suffix ? <span className="mt-0.5 block text-[10px]">{splitLabel.suffix}</span> : null}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={`text-3xl font-semibold leading-tight text-acre-text desktop-md:text-4xl ${valueClassName ?? ''}`}>{value}</p>
        {rightBadge}
      </div>
      {subtitle ? <p className={subtitleClassName ?? 'mt-1 text-sm text-acre-muted'}>{subtitle}</p> : null}
      {meta ? <div className="mt-2">{meta}</div> : null}
    </article>
  );
}

