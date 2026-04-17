import { useState } from 'react';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { STATUS_LABELS } from '../../utils/constants';
import { formatDays, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderPipelineTabProps {
  periodData: MortgageCase[];
  selectedLender: string;
  marketStats: MarketStats;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function toPipelineRows(rows: MortgageCase[]) {
  const total = Math.max(rows.length, 1);
  const statuses: Array<MortgageCase['caseStatus']> = [
    'LEAD',
    'PRE_RECOMMENDATION',
    'APPLICATION_SUBMITTED',
    'OFFER_RECEIVED',
    'COMPLETE',
    'NOT_PROCEEDING',
  ];
  return statuses.map((status) => {
    const count = rows.filter((row) => row.caseStatus === status).length;
    return {
      status,
      count,
      percentage: count / total,
    };
  });
}

function conversionRate(rows: Array<{ status: MortgageCase['caseStatus']; count: number }>, from: MortgageCase['caseStatus'], to: MortgageCase['caseStatus']) {
  const fromCount = rows.find((row) => row.status === from)?.count ?? 0;
  const toCount = rows.find((row) => row.status === to)?.count ?? 0;
  return fromCount > 0 ? toCount / fromCount : 0;
}

function topDropOffReasons(rows: MortgageCase[]) {
  const counts = new Map<string, number>();
  const notProceedingRows = rows.filter((row) => row.caseStatus === 'NOT_PROCEEDING');
  for (const row of notProceedingRows) {
    const key = row.notProceedingReason ?? 'UNKNOWN';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = Math.max(notProceedingRows.length, 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([reason, count]) => ({
      label: reason.replaceAll('_', ' ').toLowerCase(),
      percentage: count / total,
      value: formatPercentage(count / total),
      accent: '#E24B4A',
    }));
}

function stalledRows(rows: MortgageCase[], marketMedianDaysToOffer: number) {
  const now = new Date(2025, 11, 31);
  return rows
    .filter((row) => row.caseStatus === 'APPLICATION_SUBMITTED')
    .map((row) => {
      const daysStalled = daysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now) ?? 0;
      return {
        caseId: row.caseId,
        daysStalled,
        lender: row.lender,
      };
    })
    .filter((row) => row.daysStalled > marketMedianDaysToOffer)
    .sort((a, b) => b.daysStalled - a.daysStalled)
    .slice(0, 10);
}

export function LenderPipelineTab({ periodData, selectedLender, marketStats }: LenderPipelineTabProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (lenderRows.length === 0) {
    return <EmptyState title="No pipeline data for selected lender" />;
  }
  const pipeline = toPipelineRows(lenderRows);

  const submittedToOfferDays = lenderRows
    .map((row) => daysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((value): value is number => value !== null);
  const offerToCompleteDays = lenderRows
    .map((row) => daysBetween(row.firstOfferDate, row.completionDate))
    .filter((value): value is number => value !== null);
  const dropOffRate = conversionRate(pipeline, 'LEAD', 'NOT_PROCEEDING');

  const marketMedianDaysToOffer = Math.max(1, Math.round(marketStats.avgDaysToOffer));
  const stalled = stalledRows(lenderRows, marketMedianDaysToOffer);
  const dropOffRows = topDropOffReasons(lenderRows);

  return (
    <section className="mt-8">
      <PageHeader
        title="Pipeline"
        subtitle={`Pipeline speed and drop-off analysis for ${selectedLender}`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-3">
        <KpiCard
          label="Submission to offer speed"
          value={formatDays(average(submittedToOfferDays))}
          subtitle={`Market avg: ${formatDays(marketStats.avgDaysToOffer)}`}
        />
        <KpiCard
          label="Offer to complete speed"
          value={formatDays(average(offerToCompleteDays))}
          subtitle={`Market avg: ${formatDays(marketStats.avgDaysToComplete)}`}
        />
        <KpiCard label="Drop-off rate" value={formatPercentage(dropOffRate)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="Lender funnel with cycle-time context"
          subtitle="Case volumes by status in active period"
          rows={pipeline.map((row) => ({
            label: STATUS_LABELS[row.status],
            percentage: row.percentage,
            value: formatPercentage(row.percentage),
            accent: row.status === 'NOT_PROCEEDING' ? '#E24B4A' : '#7D6CF1',
          }))}
        />
        <HorizontalDistribution
          title="Drop-off reasons"
          subtitle="Top reasons for not proceeding"
          rows={dropOffRows.length ? dropOffRows : [{ label: 'none', value: '0%', percentage: 0 }]}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Stalled case list</h3>
        <p className="mt-1 text-sm text-acre-muted">
          Top 10 submitted cases with age above market median ({marketMedianDaysToOffer} days)
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">Case ID</th>
                <th className="py-2 pr-4 font-medium">Days stalled</th>
                <th className="py-2 pr-4 font-medium">Lender</th>
              </tr>
            </thead>
            <tbody>
              {stalled.length ? (
                stalled.map((row) => (
                  <tr
                    key={row.caseId}
                    className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                      selectedCaseId === row.caseId ? 'bg-gray-200' : ''
                    }`}
                    onClick={() => setSelectedCaseId(row.caseId)}
                  >
                    <td className="py-2 pr-4 text-acre-text">{row.caseId}</td>
                    <td className="py-2 pr-4 text-acre-purple">{row.daysStalled.toLocaleString('en-GB')}</td>
                    <td className="py-2 pr-4 text-acre-text">{row.lender}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-3 text-acre-muted">
                    No stalled submitted cases for this lender in the active period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

