import { useState } from 'react';
import type { MarketStats, MortgageCase } from '../../types/mortgage';
import { formatCurrency, formatDays, formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderInsightsTabProps {
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

function median(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function ltvBandRows(rows: MortgageCase[]) {
  const valid = rows
    .map((row) => row.ltv)
    .filter((value): value is number => value !== null && value >= 0 && value <= 1.5);
  const total = Math.max(valid.length, 1);
  const bands = [
    { label: '0-60%', predicate: (v: number) => v < 0.6 },
    { label: '60-75%', predicate: (v: number) => v >= 0.6 && v < 0.75 },
    { label: '75-85%', predicate: (v: number) => v >= 0.75 && v < 0.85 },
    { label: '85-90%', predicate: (v: number) => v >= 0.85 && v < 0.9 },
    { label: '90-95%', predicate: (v: number) => v >= 0.9 && v < 0.95 },
    { label: '95-100%', predicate: (v: number) => v >= 0.95 },
  ];
  return bands.map((band) => {
    const count = valid.filter((value) => band.predicate(value)).length;
    return {
      label: band.label,
      share: count / total,
    };
  });
}

function lenderOfferSpeed(rows: MortgageCase[]) {
  const values = rows
    .map((row) => daysBetween(row.firstSubmittedDate, row.firstOfferDate))
    .filter((value): value is number => value !== null);
  return average(values);
}

function speedRank(periodData: MortgageCase[], selectedLender: string) {
  const groups = new Map<string, MortgageCase[]>();
  for (const row of periodData) {
    const list = groups.get(row.lender) ?? [];
    list.push(row);
    groups.set(row.lender, list);
  }
  const ranked = [...groups.entries()]
    .map(([lender, rows]) => ({ lender, speed: lenderOfferSpeed(rows) }))
    .filter((row) => row.speed > 0)
    .sort((a, b) => a.speed - b.speed);
  const rankIndex = ranked.findIndex((row) => row.lender === selectedLender);
  return {
    rank: rankIndex >= 0 ? rankIndex + 1 : ranked.length,
    total: ranked.length,
  };
}

export function LenderInsightsTab({ periodData, selectedLender, marketStats }: LenderInsightsTabProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const lenderRows = periodData.filter((row) => row.lender === selectedLender);
  if (lenderRows.length === 0) {
    return <EmptyState title="No insights data for selected lender" />;
  }
  const submittedRows = lenderRows.filter((row) => row.caseStatus === 'APPLICATION_SUBMITTED');
  const marketSubmittedRows = periodData.filter((row) => row.caseStatus === 'APPLICATION_SUBMITTED');
  const now = new Date(2025, 11, 31);

  const marketSubmittedAges = marketSubmittedRows
    .map((row) => daysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now))
    .filter((value): value is number => value !== null);
  const marketMedianStall = median(marketSubmittedAges);

  const stalled = submittedRows
    .map((row) => ({
      caseId: row.caseId,
      daysStalled: daysBetween(row.lastSubmittedDate ?? row.firstSubmittedDate, now) ?? 0,
      revenueAtRisk: row.totalCaseRevenue ?? 0,
    }))
    .filter((row) => row.daysStalled > marketMedianStall)
    .sort((a, b) => b.daysStalled - a.daysStalled)
    .slice(0, 10);

  const stalledCount = stalled.length;
  const revenueAtRisk = stalled.reduce((sum, row) => sum + row.revenueAtRisk, 0);
  const avgDaysStalled = average(stalled.map((row) => row.daysStalled));

  const lenderSpeed = lenderOfferSpeed(lenderRows);
  const speedVsMarket = lenderSpeed - marketStats.avgDaysToOffer;
  const ranking = speedRank(periodData, selectedLender);

  const lenderBands = ltvBandRows(lenderRows);
  const marketBands = ltvBandRows(periodData);

  return (
    <section className="mt-8">
      <PageHeader
        title="Insights"
        subtitle={`Actionable signals for ${selectedLender}, including conversion speed and LTV risk positioning`}
      />

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Revenue at risk (stalled submitted cases)</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 desktop-sm:grid-cols-3">
          <KpiCard label="Stalled cases" value={stalledCount.toLocaleString('en-GB')} />
          <KpiCard label="Broker revenue at risk" value={formatCurrency(revenueAtRisk)} />
          <KpiCard label="Average days stalled" value={formatDays(avgDaysStalled)} subtitle={`Market median threshold: ${Math.round(marketMedianStall)} days`} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">Case ID</th>
                <th className="py-2 pr-4 font-medium">Days stalled</th>
                <th className="py-2 pr-4 font-medium">Revenue at risk</th>
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
                    <td className="py-2 pr-4 text-acre-text">{formatCurrency(row.revenueAtRisk)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-3 text-acre-muted">No stalled submitted cases above market threshold.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Conversion velocity</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 desktop-sm:grid-cols-3">
          <KpiCard label="Your avg days to offer" value={formatDays(lenderSpeed)} />
          <KpiCard
            label="Vs market"
            value={`${speedVsMarket <= 0 ? '' : '+'}${Math.round(speedVsMarket)}d`}
            subtitle={`Market avg: ${formatDays(marketStats.avgDaysToOffer)}`}
          />
          <KpiCard label="Market ranking" value={`Rank ${ranking.rank} of ${ranking.total}`} />
        </div>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title={`LTV risk matrix (${selectedLender})`}
          subtitle={`Share by LTV band for ${selectedLender}`}
          rows={lenderBands.map((row) => ({
            label: row.label,
            percentage: row.share,
            value: formatPercentage(row.share),
            accent: row.share > 0.2 && (row.label === '90-95%' || row.label === '95-100%') ? '#E24B4A' : '#7D6CF1',
          }))}
        />
        <HorizontalDistribution
          title="LTV risk matrix (market baseline)"
          subtitle="Anonymised market aggregate comparison"
          rows={marketBands.map((row) => ({
            label: row.label,
            percentage: row.share,
            value: formatPercentage(row.share),
            accent: '#A29BFE',
          }))}
        />
      </div>
    </section>
  );
}

