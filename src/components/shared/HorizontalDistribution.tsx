import { useState } from 'react';

interface Row {
  label: string;
  value: string;
  percentage: number;
  accent?: string;
}

export function HorizontalDistribution({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
}) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  return (
    <section className="rounded-xl border border-acre-border bg-white p-5">
      <h3 className="text-2xl font-semibold text-acre-text">{title}</h3>
      <p className="mt-1 text-sm text-acre-muted">{subtitle}</p>
      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className={`group relative grid grid-cols-[140px_1fr_50px] items-center gap-3 rounded-md text-sm transition ${
              activeLabel && activeLabel !== row.label ? 'opacity-45' : 'opacity-100'
            }`}
            onMouseEnter={() => setActiveLabel(row.label)}
            onMouseLeave={() => setActiveLabel(null)}
            onFocus={() => setActiveLabel(row.label)}
            onBlur={() => setActiveLabel(null)}
            tabIndex={0}
          >
            <span className="text-acre-text">{row.label}</span>
            <div className="h-4 rounded-full bg-acre-panel">
              <div
                className="h-4 rounded-full transition-opacity"
                style={{
                  width: `${Math.round(row.percentage * 100)}%`,
                  background: row.accent ?? '#8f83f7',
                }}
              />
            </div>
            <span className="text-right text-acre-muted">{row.value}</span>
            <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-acre-text px-2 py-1 text-xs text-white group-hover:block group-focus:block">
              {row.label}: {row.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

