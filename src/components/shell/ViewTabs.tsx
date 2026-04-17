export function ViewTabs({
  active,
  onChange,
}: {
  active: 'internal' | 'lender';
  onChange: (next: 'internal' | 'lender') => void;
}) {
  return (
    <div className="rounded-xl border border-acre-border bg-white p-3" role="tablist" aria-label="Top-level dashboard views">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-acre-muted">Dashboards</p>
      {[
        { id: 'internal' as const, label: 'Internal dashboard' },
        { id: 'lender' as const, label: 'Lender dashboard' },
      ].map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          role="tab"
          aria-selected={active === item.id}
          className={`mb-2 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition last:mb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acre-purple ${
            active === item.id
              ? 'border-acre-purple bg-acre-purple-bg text-acre-purple'
              : 'border-acre-border bg-white text-acre-text hover:border-acre-purple-light'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

