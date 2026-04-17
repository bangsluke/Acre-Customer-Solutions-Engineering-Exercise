export function EmptyState({
  title = 'No data for this filter',
  description = 'Try a broader time range or a different lender selection.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section className="mt-8 rounded-xl border border-acre-border bg-white p-8">
      <h2 className="text-2xl font-semibold text-acre-text">{title}</h2>
      <p className="mt-2 text-acre-muted">{description}</p>
    </section>
  );
}

