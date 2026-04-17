import type { LenderStats, MarketStats } from '../../types/mortgage';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderDashboardProps {
  selectedLender: string;
  stats: LenderStats | null;
  marketStats: MarketStats;
}

export function LenderDashboard({
  selectedLender,
  stats,
  marketStats,
}: LenderDashboardProps) {
  if (!stats) {
    return (
      <section className="mt-8 rounded-xl border border-acre-border bg-white p-8 text-acre-muted">
        Lender metrics are still computing for the selected period...
      </section>
    );
  }

  const benchmarkRows = [
    {
      label: 'Avg LTV',
      you: formatPercentage(stats.avgLtv),
      market: formatPercentage(marketStats.avgLtv),
    },
    {
      label: 'Broker revenue per case',
      you: formatCurrency(stats.brokerRevenuePerCase),
      market: formatCurrency(
        marketStats.completedCases > 0 ? marketStats.totalLoanValue / marketStats.completedCases * 0.01 : 0,
      ),
    },
    {
      label: 'Protection attach',
      you: formatPercentage(stats.protectionAttachRate),
      market: formatPercentage(marketStats.protectionAttachRate),
    },
    {
      label: 'Days to complete',
      you: `${Math.round(stats.avgDaysToComplete)}d`,
      market: `${Math.round(marketStats.avgDaysToComplete)}d`,
    },
    {
      label: 'Resubmission rate',
      you: formatPercentage(stats.resubmissionRate),
      market: formatPercentage(marketStats.resubmissionRate),
    },
  ];

  return (
    <section className="mt-8">
      <PageHeader
        title="Lender overview"
        subtitle={`${selectedLender} performance benchmarked against anonymised market averages`}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-acre-purple-bg px-4 py-1 text-xs font-semibold text-acre-purple">
          Top lender by completed cases
        </span>
        <span className="text-lg text-acre-text">{stats.totalCases.toLocaleString('en-GB')} cases on Acre this period</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label="Your cases" value={stats.totalCases.toLocaleString('en-GB')} subtitle={`Market share: ${formatPercentage(stats.marketShare, 1)}`} />
        <KpiCard
          label="Avg loan size"
          value={formatCurrency(stats.avgLoanSize)}
          subtitle={`Market avg: ${formatCurrency(marketStats.totalLoanValue / Math.max(marketStats.totalCases, 1))}`}
        />
        <KpiCard
          label="Completion rate"
          value={formatPercentage(stats.completionRate)}
          subtitle={`Market avg: ${formatPercentage(marketStats.completedCases / Math.max(marketStats.totalCases, 1))}`}
        />
        <KpiCard label="Avg days to offer" value={`${Math.round(stats.avgDaysToOffer)} days`} subtitle={`Market avg: ${Math.round(marketStats.avgDaysToOffer)} days`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Your case mix vs market"
          subtitle="Case-type distribution"
          rows={stats.caseMix.map((row) => ({
            label: row.label,
            value: `${Math.round(row.percentage * 100)}%`,
            percentage: row.percentage,
          }))}
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Performance benchmarks</h3>
          <div className="mt-4 space-y-2">
            {benchmarkRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1.4fr_0.7fr_0.7fr] gap-2 border-b border-acre-border py-2 text-sm">
                <span className="text-acre-text">{row.label}</span>
                <span className="text-acre-purple">{row.you}</span>
                <span className="text-acre-muted">{row.market}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-acre-muted">
            Broker revenue is proc fee paid by the lender plus broker fees charged to the client.
          </p>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Your pipeline vs market conversion rates</h3>
        <p className="mt-1 text-sm text-acre-muted">
          All comparisons are against anonymised aggregate market averages. Individual competitor lender data is not shown.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 desktop-md:grid-cols-5">
          {stats.pipeline
            .filter((row) => row.status !== 'NOT_PROCEEDING')
            .map((row) => (
              <article key={row.status} className="rounded-lg bg-acre-purple-bg p-3 text-center">
                <p className="text-2xl font-semibold text-acre-purple">{row.count.toLocaleString('en-GB')}</p>
                <p className="text-xs text-acre-muted">{row.status.toLowerCase().replace('_', ' ')}</p>
              </article>
            ))}
        </div>
      </section>
    </section>
  );
}

