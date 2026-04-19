import type { ReactNode } from 'react';

interface FunnelRowProps {
  label?: ReactNode;
  valueLabel?: string;
  barPercent: number;
  barColorClassName?: string;
  dividerAbove?: boolean;
  secondaryLabel?: string;
  variant?: 'threeColumn' | 'barOnly';
}

export function FunnelRow({
  label = '',
  valueLabel = '',
  barPercent,
  barColorClassName = 'bg-acre-purple',
  dividerAbove = false,
  secondaryLabel,
  variant = 'threeColumn',
}: FunnelRowProps) {
  const safePercent = Math.max(0, Math.min(100, barPercent));
  if (variant === 'barOnly') {
    return (
      <div className="grid items-center gap-3 text-sm text-acre-text" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        <div className="h-4 rounded-full bg-acre-panel">
          <div className={`h-4 rounded-full ${barColorClassName}`} style={{ width: `${Math.max(8, safePercent)}%` }} />
        </div>
        <span className="text-right text-acre-muted">{valueLabel}</span>
      </div>
    );
  }
  return (
    <div className={`${dividerAbove ? 'border-t border-acre-border pt-2' : ''}`}>
      <div className="grid items-center gap-3 text-sm text-acre-text" style={{ gridTemplateColumns: '1.2fr 2.4fr 1.8fr' }}>
        <span>{label}</span>
        <div className="h-4 rounded-full bg-acre-panel">
          <div className={`h-4 rounded-full ${barColorClassName}`} style={{ width: `${Math.max(8, safePercent)}%` }} />
        </div>
        <span className="text-right text-acre-muted">{valueLabel}</span>
      </div>
      {secondaryLabel ? <p className="mt-1 text-right text-xs text-acre-muted">{secondaryLabel}</p> : null}
    </div>
  );
}
