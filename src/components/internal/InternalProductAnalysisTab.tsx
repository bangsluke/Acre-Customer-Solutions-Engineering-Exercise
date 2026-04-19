import { useMemo, useState } from 'react';
import type { MortgageCase, TimePeriod } from '../../types/mortgage';
import { OTHER_CASE_TYPE_TOOLTIP, toPipelineStage } from '../../utils/constants';
import {
  buildCaseCompositionRows,
  buildCaseTypePerformanceRows,
  buildClubNetworkRows,
  buildProductMixKpi,
  buildRegulatedCasesKpi,
  initialRateTypeShare,
} from '../../utils/aggregations';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import { withTimeFrameLabel } from '../../utils/timeFrame';
import { EmptyState } from '../shared/EmptyState';
import { HorizontalDistribution } from '../shared/HorizontalDistribution';
import { KpiCard } from '../shared/KpiCard';
import { PageHeader } from '../shared/PageHeader';
import { AppTooltip } from '../shared/AppTooltip';

type CaseTypeSortField = 'caseType' | 'volume' | 'completionRate' | 'notProceedingRate' | 'avgNetRevenue';
type ClubSortField = 'clubName' | 'cases' | 'completionRate' | 'totalLoanValue';

export function InternalProductAnalysisTab({
  periodData,
  period,
}: {
  periodData: MortgageCase[];
  period: TimePeriod;
}) {
  const [caseTypeSortField, setCaseTypeSortField] = useState<CaseTypeSortField>('avgNetRevenue');
  const [caseTypeSortDirection, setCaseTypeSortDirection] = useState<'asc' | 'desc'>('desc');
  const [excludeBlankClub, setExcludeBlankClub] = useState(true);
  const [clubSortField, setClubSortField] = useState<ClubSortField>('completionRate');
  const [clubSortDirection, setClubSortDirection] = useState<'asc' | 'desc'>('desc');
  const [groupOtherCaseTypes, setGroupOtherCaseTypes] = useState(true);

  const caseTypeRows = useMemo(
    () => buildCaseTypePerformanceRows(periodData, groupOtherCaseTypes),
    [groupOtherCaseTypes, periodData],
  );
  const rateTypeRows = useMemo(() => initialRateTypeShare(periodData), [periodData]);
  const productMixKpi = useMemo(() => buildProductMixKpi(periodData), [periodData]);
  const regulatedKpi = useMemo(() => buildRegulatedCasesKpi(periodData), [periodData]);
  const completedCasesWithLinkedProtectionKpi = useMemo(() => {
    const completedRows = periodData.filter((row) => toPipelineStage(row.caseStatus) === 'COMPLETION');
    const count = completedRows.filter((row) => row.linkedProtection).length;
    const percentage = completedRows.length ? count / completedRows.length : 0;
    return { count, percentage };
  }, [periodData]);
  const compositionRows = useMemo(() => buildCaseCompositionRows(periodData), [periodData]);
  const blankClubCount = useMemo(
    () => periodData.filter((row) => !row.clubName || !row.clubName.trim()).length,
    [periodData],
  );
  const filteredClubData = useMemo(
    () => (excludeBlankClub ? periodData.filter((row) => row.clubName && row.clubName.trim()) : periodData),
    [excludeBlankClub, periodData],
  );
  const clubRows = useMemo(() => buildClubNetworkRows(filteredClubData), [filteredClubData]);
  const sortedCaseTypeRows = useMemo(() => {
    const direction = caseTypeSortDirection === 'desc' ? 1 : -1;
    return caseTypeRows.slice().sort((a, b) => {
      if (caseTypeSortField === 'caseType') return direction * b.caseType.localeCompare(a.caseType, 'en-GB');
      if (caseTypeSortField === 'volume') return direction * (b.volume - a.volume);
      if (caseTypeSortField === 'completionRate') return direction * (b.completionRate - a.completionRate);
      if (caseTypeSortField === 'notProceedingRate') return direction * (b.notProceedingRate - a.notProceedingRate);
      const aValue = a.avgNetRevenue ?? Number.NEGATIVE_INFINITY;
      const bValue = b.avgNetRevenue ?? Number.NEGATIVE_INFINITY;
      return direction * (bValue - aValue);
    });
  }, [caseTypeRows, caseTypeSortDirection, caseTypeSortField]);
  const highestAvgRevenueCaseType = useMemo(() => {
    return caseTypeRows
      .filter((row) => row.caseType !== 'Other' && row.avgNetRevenue !== null)
      .sort((a, b) => (b.avgNetRevenue ?? 0) - (a.avgNetRevenue ?? 0))[0] ?? null;
  }, [caseTypeRows]);

  const sortedClubRows = useMemo(() => {
    const direction = clubSortDirection === 'desc' ? 1 : -1;
    return clubRows.slice().sort((a, b) => {
      if (clubSortField === 'clubName') return direction * b.clubName.localeCompare(a.clubName, 'en-GB');
      if (clubSortField === 'cases') return direction * (b.cases - a.cases);
      if (clubSortField === 'completionRate') return direction * (b.completionRate - a.completionRate);
      return direction * (b.totalLoanValue - a.totalLoanValue);
    });
  }, [clubRows, clubSortDirection, clubSortField]);

  if (periodData.length === 0) {
    return <EmptyState title="No product analysis data in this period" />;
  }

  const avgTermLabel = productMixKpi.averageTermYears === null
    ? 'N/A'
    : `${productMixKpi.averageTermYears.toFixed(1)} years`;

  function toggleCaseTypeSort(next: CaseTypeSortField) {
    if (caseTypeSortField === next) {
      setCaseTypeSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setCaseTypeSortField(next);
    setCaseTypeSortDirection('desc');
  }

  function toggleClubSort(next: ClubSortField) {
    if (clubSortField === next) {
      setClubSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setClubSortField(next);
    setClubSortDirection('desc');
  }

  function sortMarker(field: ClubSortField): string {
    if (clubSortField !== field) {
      return '↕';
    }
    return clubSortDirection === 'desc' ? '↓' : '↑';
  }

  function caseTypeSortMarker(field: CaseTypeSortField): string {
    if (caseTypeSortField !== field) {
      return '↕';
    }
    return caseTypeSortDirection === 'desc' ? '↓' : '↑';
  }

  return (
    <section className="mt-3">
      <PageHeader title="Product Analysis" subtitle="Case-type outcomes, product mix, composition, and club/network performance" />

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2 desktop-md:grid-cols-4">
        <KpiCard label={withTimeFrameLabel('Avg term length', period)} value={avgTermLabel} />
        <KpiCard
          label={withTimeFrameLabel('Regulated cases', period)}
          value={formatNumber(regulatedKpi.count)}
          subtitle={`${formatPercentage(regulatedKpi.percentage)} of total`}
        />
        <KpiCard
          label={withTimeFrameLabel('Completed cases with linked protection', period)}
          value={formatNumber(completedCasesWithLinkedProtectionKpi.count)}
          subtitle={`${formatPercentage(completedCasesWithLinkedProtectionKpi.percentage)} of completed`}
        />
        <KpiCard
          label={withTimeFrameLabel('Highest avg net revenue case type', period)}
          value={highestAvgRevenueCaseType?.caseType ?? 'N/A'}
          subtitle={highestAvgRevenueCaseType?.avgNetRevenue === null || !highestAvgRevenueCaseType ? 'No valid revenue data' : formatCurrency(highestAvgRevenueCaseType.avgNetRevenue)}
          meta={<p className="text-xs text-acre-muted">Excludes Other case type.</p>}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 desktop-sm:grid-cols-2">
        <HorizontalDistribution
          title="Initial rate type share"
          subtitle="Fixed / tracker / discount / variable / stepped split"
          rows={rateTypeRows.map((row) => ({
            label: row.label,
            value: `${formatPercentage(row.percentage, 1)} | (${formatNumber(row.count)})`,
            percentage: row.percentage,
            accent: '#5B68FA',
          }))}
          hideZeroRows
          valueColumnPx={128}
          singleLineValue
        />
        <section className="rounded-xl border border-acre-border bg-white p-5">
          <h3 className="text-2xl font-semibold text-acre-text">Case composition</h3>
          <p className="mt-1 text-sm text-acre-muted">PT, Consumer BTL, Further advance, and Porting mix</p>
          <div className="mt-4 grid grid-cols-1 gap-3 desktop-sm:grid-cols-2">
            {compositionRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-acre-border bg-acre-panel px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-acre-muted">{row.label}</p>
                <p className="mt-1 text-xl font-semibold text-acre-text">{formatNumber(row.count)}</p>
                <p className="text-sm text-acre-muted">{formatPercentage(row.percentage)} of total</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">Case type performance</h3>
        <p className="mt-1 text-sm text-acre-muted">Volume, completion, not-proceeding, and net revenue by case type</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('caseType')}>
                    <span>Case type</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('caseType')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('volume')}>
                    <span>Volume</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('volume')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('completionRate')}>
                    <span>Completion rate</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('completionRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('notProceedingRate')}>
                    <span>Not-proceeding rate</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('notProceedingRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleCaseTypeSort('avgNetRevenue')}>
                    <span>Avg net revenue by case type</span>
                    <span aria-hidden="true" className="text-xs">{caseTypeSortMarker('avgNetRevenue')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCaseTypeRows.map((row) => (
                <tr key={row.caseType} className="border-b border-acre-border">
                  <td className="py-2 pr-4 text-acre-text">
                    {row.caseType === 'Other' ? (
                      <AppTooltip content={OTHER_CASE_TYPE_TOOLTIP}>
                        <span className="cursor-help border-b border-dotted border-current leading-none">Other</span>
                      </AppTooltip>
                    ) : (
                      row.caseType
                    )}
                  </td>
                  <td className="py-2 pr-4 text-acre-text">{formatNumber(row.volume)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.completionRate, 1)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.notProceedingRate, 1)}</td>
                  <td className="py-2 pr-4 text-acre-text">{row.avgNetRevenue === null ? 'N/A' : formatCurrency(row.avgNetRevenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-acre-purple underline-offset-2 hover:underline"
          onClick={() => setGroupOtherCaseTypes((current) => !current)}
        >
          {groupOtherCaseTypes ? 'Expand Other' : 'Group Other'}
        </button>
      </section>

      <section className="mt-6 rounded-xl border border-acre-border bg-white p-5">
        <h3 className="text-2xl font-semibold text-acre-text">By club / network</h3>
        <p className="mt-1 text-sm text-acre-muted">Case volume, completion, and delivered loan value by club name</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-acre-border bg-acre-panel p-4">
          <label className="inline-flex items-center gap-2 text-sm text-acre-text">
            <input
              type="checkbox"
              checked={excludeBlankClub}
              onChange={(event) => setExcludeBlankClub(event.target.checked)}
            />
            Exclude blank club
          </label>
          {excludeBlankClub ? (
            <p className="text-sm text-acre-muted">
              {formatNumber(blankClubCount)} blank club cases ({formatPercentage(blankClubCount / periodData.length, 1)}) are excluded.
            </p>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-acre-border text-left text-acre-muted">
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleClubSort('clubName')}>
                    <span>Club name</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('clubName')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleClubSort('cases')}>
                    <span>Cases</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('cases')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleClubSort('completionRate')}>
                    <span>Completion rate</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('completionRate')}</span>
                  </button>
                </th>
                <th className="py-2 pr-4 font-medium">
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleClubSort('totalLoanValue')}>
                    <span>Total loan value</span>
                    <span aria-hidden="true" className="text-xs">{sortMarker('totalLoanValue')}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedClubRows.map((row) => (
                <tr key={row.clubName} className="border-b border-acre-border">
                  <td className="py-2 pr-4 text-acre-text">{row.clubName}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatNumber(row.cases)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatPercentage(row.completionRate)}</td>
                  <td className="py-2 pr-4 text-acre-text">{formatCurrency(row.totalLoanValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
