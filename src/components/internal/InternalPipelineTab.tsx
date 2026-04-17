import { useState } from 'react';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { marketConversionRates } from '../../utils/aggregations';
import { STATUS_LABELS } from '../../utils/constants';
import { formatDays, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDropoffReasonRows(periodData: MortgageCase[]) {
  const totalNotProceeding = periodData.filter((row) => row.caseStatus === 'NOT_PROCEEDING').length;
  const counts = new Map<string, number>();

  for (const row of periodData) {
    if (row.caseStatus !== 'NOT_PROCEEDING') {
      continue;
    }
    const reason = row.notProceedingReason ?? 'UNKNOWN';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({
      label: reason.replaceAll('_', ' ').toLowerCase(),
      value: formatPercentage(totalNotProceeding ? count / totalNotProceeding : 0),
      percentage: totalNotProceeding ? count / totalNotProceeding : 0,
      accent: '#E24B4A',
    }));
}

function getConversionTableRows(stats: MarketStats) {
  const conversions = marketConversionRates(stats.pipeline);
  return conversions.map((row) => ({
    from: row.status,
    to: STATUS_LABELS[row.status as keyof typeof STATUS_LABELS] ?? row.status,
    conversion: row.conversion,
  }));
}

function getCycleTime(periodData: MortgageCase[]): number {
  const values: number[] = [];
  for (const row of periodData) {
    if (!row.firstSubmittedDate || !row.completionDate) {
      continue;
    }
    const diff = Math.max(
      0,
      Math.round((row.completionDate.getTime() - row.firstSubmittedDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    values.push(diff);
  }
  return average(values);
}

export function InternalPipelineTab({ stats, periodData }: { stats: MarketStats; periodData: MortgageCase[] }) {
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  if (periodData.length === 0) {
    return <EmptyState title="No pipeline data in this period" />;
  }

  const leadCount = stats.pipeline.find((row) => row.status === 'LEAD')?.count ?? 0;
  const completeCount = stats.pipeline.find((row) => row.status === 'COMPLETE')?.count ?? 0;
  const submittedCount = stats.pipeline.find((row) => row.status === 'APPLICATION_SUBMITTED')?.count ?? 0;
  const notProceedingCount = stats.pipeline.find((row) => row.status === 'NOT_PROCEEDING')?.count ?? 0;

  const conversionRate = leadCount > 0 ? completeCount / leadCount : 0;
  const dropOffRate = leadCount > 0 ? notProceedingCount / leadCount : 0;
  const stalledCases = Math.round(submittedCount * stats.stalledSubmittedRate);
  const cycleTime = getCycleTime(periodData);

  const dropOffRows = getDropoffReasonRows(periodData);
  const conversionRows = getConversionTableRows(stats);

  return (
    <section className="mt-8">
      <PageHeader title="Pipeline" subtitle="Detailed progression and drop-off analysis across the market" />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label="Conversion rate" value={formatPercentage(conversionRate)} />
        <KpiCard label="Drop-off rate" value={formatPercentage(dropOffRate)} />
        <KpiCard label="Average cycle time" value={formatDays(cycleTime)} />
        <KpiCard label="Stuck cases" value={stalledCases.toLocaleString('en-GB')} subtitle="Submitted above market median age" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Pipeline funnel by status"
          subtitle="Volumes and percentage of all cases"
          rows={stats.pipeline.map((row) => ({
            label: STATUS_LABELS[row.status],
            value: formatPercentage(row.percentage),
            percentage: row.percentage,
            accent: row.status === 'NOT_PROCEEDING' ? '#E24B4A' : '#7D6CF1',
          }))}
        />
        <HorizontalDistribution
          title="Drop-off reasons"
          subtitle="Top not proceeding reasons"
          rows={dropOffRows.length ? dropOffRows : [{ label: 'none', value: '0%', percentage: 0 }]}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Stage-over-stage conversion</h3>
        <p className="mt-1 text-sm text-acre-muted">How efficiently cases move between consecutive pipeline stages</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {conversionRows.map((row) => (
                <tr
                  key={row.from}
                  className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                    selectedStage === row.from ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedStage(row.from)}
                >
                  <td className="py-2 pr-4 capitalize text-acre-text">{row.to}</td>
                  <td className="py-2 pr-4 text-acre-purple">{formatPercentage(row.conversion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

