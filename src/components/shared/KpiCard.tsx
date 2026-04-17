import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  rightBadge?: ReactNode;
}

export function KpiCard({ label, value, subtitle, rightBadge }: KpiCardProps) {
  return (
    <article className="rounded-xl border border-acre-border bg-acre-panel px-5 py-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-acre-muted">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-3xl font-semibold leading-tight text-acre-text desktop-md:text-4xl">{value}</p>
        {rightBadge}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-acre-muted">{subtitle}</p> : null}
    </article>
  );
}

