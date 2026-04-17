import { useState } from 'react';
import type { MortgageCase, ParseQualityReport } from '../../types/mortgage';
import { formatPercentage } from '../../utils/formatters';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';

interface LenderLtvRow {
  lender: string;
  caseCount: number;
  avgLtv: number;
  highLtvShare: number;
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildLenderLtvRows(periodData: MortgageCase[]): LenderLtvRow[] {
  const byLender = new Map<string, MortgageCase[]>();
  for (const row of periodData) {
    const rows = byLender.get(row.lender) ?? [];
    rows.push(row);
    byLender.set(row.lender, rows);
  }

  return [...byLender.entries()]
    .map(([lender, rows]) => {
      const ltvValues = rows
        .map((item) => item.ltv)
        .filter((value): value is number => value !== null && value <= 1.5 && value >= 0);
      const highLtv = ltvValues.filter((value) => value >= 0.85).length;
      return {
        lender,
        caseCount: rows.length,
        avgLtv: average(ltvValues),
        highLtvShare: ltvValues.length ? highLtv / ltvValues.length : 0,
      };
    })
    .filter((row) => row.caseCount > 0)
    .sort((a, b) => b.caseCount - a.caseCount)
    .slice(0, 10);
}

function buildCaseTypeLtvRows(periodData: MortgageCase[]) {
  const byType = new Map<string, number[]>();
  for (const row of periodData) {
    if (row.ltv === null || row.ltv > 1.5 || row.ltv < 0) {
      continue;
    }
    const values = byType.get(row.caseType) ?? [];
    values.push(row.ltv);
    byType.set(row.caseType, values);
  }

  return [...byType.entries()]
    .map(([type, values]) => ({
      label: type.replace('REASON_', '').toLowerCase().replace('_', ' '),
      value: formatPercentage(average(values)),
      percentage: average(values),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

function countOutOfOrderLifecycleRows(periodData: MortgageCase[]) {
  let count = 0;
  for (const row of periodData) {
    if (row.firstOfferDate && row.firstSubmittedDate && row.firstOfferDate.getTime() < row.firstSubmittedDate.getTime()) {
      count += 1;
      continue;
    }
    if (row.completionDate && row.firstOfferDate && row.completionDate.getTime() < row.firstOfferDate.getTime()) {
      count += 1;
    }
  }
  return count;
}

function qualityCount(report: ParseQualityReport, key: string) {
  return report.dateParseFailures[key] ?? 0;
}

export function InternalRiskLtvTab({
  periodData,
  quality,
}: {
  periodData: MortgageCase[];
  quality: ParseQualityReport;
}) {
  const [selectedRiskLender, setSelectedRiskLender] = useState<string | null>(null);

  if (periodData.length === 0) {
    return <EmptyState title="No risk and LTV data in this period" />;
  }

  const validLtvRows = periodData.filter((row) => row.ltv !== null && row.ltv <= 1.5 && row.ltv >= 0);
  const avgLtv = average(validLtvRows.map((row) => row.ltv as number));
  const highLtvCount = validLtvRows.filter((row) => (row.ltv as number) >= 0.85).length;
  const veryHighLtvCount = validLtvRows.filter((row) => (row.ltv as number) >= 0.95).length;

  const highLtvShare = validLtvRows.length ? highLtvCount / validLtvRows.length : 0;
  const veryHighLtvShare = validLtvRows.length ? veryHighLtvCount / validLtvRows.length : 0;

  const typeRows = buildCaseTypeLtvRows(periodData);
  const lenderRows = buildLenderLtvRows(periodData);

  const excludedLtvOver150 = periodData.filter((row) => row.ltv !== null && row.ltv > 1.5).length;
  const nullLtv = periodData.filter((row) => row.ltv === null).length;
  const zeroMortgage = periodData.filter((row) => (row.mortgageAmount ?? 0) <= 0).length;
  const outOfOrder = countOutOfOrderLifecycleRows(periodData);

  return (
    <section className="mt-8">
      <PageHeader
        title="Risk and LTV"
        subtitle="Risk profile distribution, concentration, and data quality transparency"
      />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label="Average LTV" value={formatPercentage(avgLtv)} />
        <KpiCard label="High-LTV cases (85%+)" value={formatPercentage(highLtvShare)} />
        <KpiCard label="Very high-LTV cases (95%+)" value={formatPercentage(veryHighLtvShare)} />
        <KpiCard
          label="LTV trend direction"
          value={highLtvShare > 0.25 ? 'Higher-risk mix' : 'Stable mix'}
          subtitle="Based on current period composition"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-md:grid-cols-2">
        <HorizontalDistribution
          title="LTV distribution"
          subtitle="Share of valid cases by LTV band"
          rows={[
            {
              label: '0-60%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) < 0.6).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) < 0.6).length / validLtvRows.length : 0,
            },
            {
              label: '60-75%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.6 && (row.ltv as number) < 0.75).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.6 && (row.ltv as number) < 0.75).length / validLtvRows.length : 0,
            },
            {
              label: '75-85%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.75 && (row.ltv as number) < 0.85).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.75 && (row.ltv as number) < 0.85).length / validLtvRows.length : 0,
            },
            {
              label: '85-90%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.85 && (row.ltv as number) < 0.9).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.85 && (row.ltv as number) < 0.9).length / validLtvRows.length : 0,
            },
            {
              label: '90-95%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.9 && (row.ltv as number) < 0.95).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.9 && (row.ltv as number) < 0.95).length / validLtvRows.length : 0,
            },
            {
              label: '95-100%',
              value: formatPercentage(validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.95).length / validLtvRows.length : 0),
              percentage: validLtvRows.length ? validLtvRows.filter((row) => (row.ltv as number) >= 0.95).length / validLtvRows.length : 0,
              accent: '#E24B4A',
            },
          ]}
        />
        <HorizontalDistribution
          title="Average LTV by case type"
          subtitle="Relative risk profile by business segment"
          rows={typeRows}
        />
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Top lenders by average LTV</h3>
        <p className="mt-1 text-sm text-acre-muted">Top 10 lenders by case volume in the active period</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">Lender</th>
                <th className="py-2 pr-4 font-medium">Cases</th>
                <th className="py-2 pr-4 font-medium">Avg LTV</th>
                <th className="py-2 pr-4 font-medium">High-LTV share (85%+)</th>
              </tr>
            </thead>
            <tbody>
              {lenderRows.map((row) => (
                <tr
                  key={row.lender}
                  className={`cursor-pointer border-b border-acre-border transition-colors hover:bg-gray-100 ${
                    selectedRiskLender === row.lender ? 'bg-gray-200' : ''
                  }`}
                  onClick={() => setSelectedRiskLender(row.lender)}
                >
                  <td className="py-2 pr-4 text-acre-text">{row.lender}</td>
                  <td className="py-2 pr-4 text-acre-text">{row.caseCount.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.avgLtv)}</td>
                  <td className="py-2 pr-4 text-acre-purple">{formatPercentage(row.highLtvShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-acre-panel p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Data quality (internal only)</h3>
        <p className="mt-1 text-sm text-acre-muted">Explicitly surfaced exclusions and parse quality checks</p>
        <div className="mt-4 grid grid-cols-1 gap-3 desktop-md:grid-cols-2">
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases excluded due to LTV &gt; 1.5: <span className="font-semibold">{excludedLtvOver150.toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with null LTV: <span className="font-semibold">{nullLtv.toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Cases with zero mortgage amount: <span className="font-semibold">{zeroMortgage.toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Out-of-order lifecycle dates: <span className="font-semibold">{outOfOrder.toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Date parse failures (`created_at`): <span className="font-semibold">{qualityCount(quality, 'created_at').toLocaleString('en-GB')}</span>
          </div>
          <div className="rounded-lg border border-acre-border bg-white px-4 py-3 text-sm text-acre-text">
            Date parse failures (`first_submitted_date`):{' '}
            <span className="font-semibold">{qualityCount(quality, 'first_submitted_date').toLocaleString('en-GB')}</span>
          </div>
        </div>
      </section>
    </section>
  );
}

