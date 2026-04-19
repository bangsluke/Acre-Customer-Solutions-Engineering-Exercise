import { differenceInCalendarDays, subDays } from 'date-fns';
import type {
  DateRange,
  MortgageCase,
  PipelineExitAnalysis,
  PipelineFunnelResult,
  PipelineStage,
  StageDistributionResult,
} from '../types/mortgage';
import { ALL_STATUS_ORDER, PIPELINE_ORDER, SYSTEM_CASE_STATUSES, toPipelineStage } from './constants';

interface PipelineOptions {
  excludeProductTransfers: boolean;
  typicalLifecycleDays?: number | null;
  today?: Date;
}

function inDateRange(date: Date | null, dateRange: DateRange): boolean {
  if (!date) {
    return false;
  }
  const value = date.getTime();
  return value >= dateRange.start.getTime() && value <= dateRange.end.getTime();
}

function median(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return Math.round(sorted[middle]);
}

function toMilestoneIndex(row: MortgageCase): number {
  if (row.completionDate) {
    return 4;
  }
  if (row.firstOfferDate) {
    return 3;
  }
  if (row.firstSubmittedDate) {
    return 2;
  }
  if (row.recommendationDate) {
    return 1;
  }
  return 0;
}

function notProceedingDateForRow(row: MortgageCase): Date | null {
  const maybeWithDate = row as MortgageCase & { notProceedingDate?: Date | null };
  return maybeWithDate.notProceedingDate ?? null;
}

function buildExitAnalysis(cohort: MortgageCase[]): PipelineExitAnalysis {
  const exitRows = cohort.filter((row) => notProceedingDateForRow(row) !== null || row.caseStatus === 'NOT_PROCEEDING');
  const breakdownCounts = new Map<PipelineStage, number>(ALL_STATUS_ORDER.map((stage) => [stage, 0]));
  for (const row of exitRows) {
    const exitDate = notProceedingDateForRow(row);
    const milestoneDates = [
      row.createdAt,
      row.recommendationDate ?? null,
      row.firstSubmittedDate,
      row.firstOfferDate,
      row.completionDate,
    ];
    let furthest = 0;
    for (let i = 1; i < milestoneDates.length; i += 1) {
      const value = milestoneDates[i];
      if (!value) {
        continue;
      }
      if (!exitDate || value.getTime() <= exitDate.getTime()) {
        furthest = i;
      }
    }
    const stage = PIPELINE_ORDER[furthest] ?? 'LEAD';
    breakdownCounts.set(stage, (breakdownCounts.get(stage) ?? 0) + 1);
  }
  const exitedCases = exitRows.length;
  const denominator = Math.max(exitedCases, 1);
  const breakdown = ALL_STATUS_ORDER.map((stage) => ({
    stage,
    count: breakdownCounts.get(stage) ?? 0,
    percentage: (breakdownCounts.get(stage) ?? 0) / denominator,
  }));
  return {
    exitRate: cohort.length > 0 ? exitedCases / cohort.length : 0,
    exitedCases,
    breakdown,
  };
}

export function computeTypicalLifecycleDays(cases: MortgageCase[]): number | null {
  const values = cases
    .filter((row) => row.createdAt && row.completionDate && !SYSTEM_CASE_STATUSES.includes(row.caseStatus))
    .map((row) => Math.max(0, differenceInCalendarDays(row.completionDate as Date, row.createdAt as Date)));
  return median(values);
}

export function computeStageDistribution(cases: MortgageCase[], dateRange: DateRange): StageDistributionResult {
  const inScope = cases.filter((row) => inDateRange(row.createdAt, dateRange));
  const excludedSystemStateCount = inScope.filter((row) => SYSTEM_CASE_STATUSES.includes(row.caseStatus)).length;
  const included = inScope.filter((row) => !SYSTEM_CASE_STATUSES.includes(row.caseStatus));
  const rows = ALL_STATUS_ORDER.map((stage) => {
    const count = included.filter((row) => toPipelineStage(row.caseStatus) === stage).length;
    return {
      stage,
      count,
      shareOfTotal: included.length > 0 ? count / included.length : 0,
    };
  });
  return {
    rows,
    totalIncludedCases: included.length,
    excludedSystemStateCount,
  };
}

export function computePipelineFunnel(
  cases: MortgageCase[],
  dateRange: DateRange,
  options: PipelineOptions,
): PipelineFunnelResult {
  const inScope = cases.filter((row) => inDateRange(row.createdAt, dateRange));
  const excludedSystemRows = inScope.filter((row) => SYSTEM_CASE_STATUSES.includes(row.caseStatus));
  const nonSystem = inScope.filter((row) => !SYSTEM_CASE_STATUSES.includes(row.caseStatus));
  const excludedLtvRows = nonSystem.filter((row) => row.ltv !== null && row.ltv > 1.5);
  const validLtvRows = nonSystem.filter((row) => !(row.ltv !== null && row.ltv > 1.5));
  const excludedPtRows = options.excludeProductTransfers ? validLtvRows.filter((row) => row.pt === true) : [];
  const cohort = options.excludeProductTransfers ? validLtvRows.filter((row) => row.pt !== true) : validLtvRows;
  const stageCounts = [0, 0, 0, 0, 0];
  let stagesSkipped = 0;
  for (const row of cohort) {
    const furthest = toMilestoneIndex(row);
    for (let i = 0; i <= furthest; i += 1) {
      stageCounts[i] += 1;
    }
    if (furthest > 1 && !row.recommendationDate) {
      stagesSkipped += 1;
    }
    if (furthest > 2 && !row.firstSubmittedDate) {
      stagesSkipped += 1;
    }
    if (furthest > 3 && !row.firstOfferDate) {
      stagesSkipped += 1;
    }
  }

  const leadCount = stageCounts[0];
  const valuesForMedian = {
    recommendation: cohort
      .filter((row) => row.createdAt && row.recommendationDate)
      .map((row) => Math.max(0, differenceInCalendarDays(row.recommendationDate as Date, row.createdAt as Date))),
    application: cohort
      .filter((row) => row.recommendationDate && row.firstSubmittedDate)
      .map((row) => Math.max(0, differenceInCalendarDays(row.firstSubmittedDate as Date, row.recommendationDate as Date))),
    offer: cohort
      .filter((row) => row.firstSubmittedDate && row.firstOfferDate)
      .map((row) => Math.max(0, differenceInCalendarDays(row.firstOfferDate as Date, row.firstSubmittedDate as Date))),
    completion: cohort
      .filter((row) => row.firstOfferDate && row.completionDate)
      .map((row) => Math.max(0, differenceInCalendarDays(row.completionDate as Date, row.firstOfferDate as Date))),
  };

  const rows = PIPELINE_ORDER.map((stage, index) => {
    const count = stageCounts[index] ?? 0;
    const previousCount = index === 0 ? null : (stageCounts[index - 1] ?? 0);
    const cumulativeConversion = leadCount > 0 ? count / leadCount : 0;
    const stageConversion = previousCount && previousCount > 0 ? count / previousCount : null;
    const medianDaysFromPrev =
      stage === 'LEAD'
        ? null
        : stage === 'RECOMMENDATION'
          ? median(valuesForMedian.recommendation)
          : stage === 'APPLICATION'
            ? median(valuesForMedian.application)
            : stage === 'OFFER'
              ? median(valuesForMedian.offer)
              : median(valuesForMedian.completion);
    return {
      stage,
      count,
      stageConversion,
      cumulativeConversion,
      medianDaysFromPrev,
    };
  });

  const typicalLifecycleDays = options.typicalLifecycleDays ?? null;
  const today = options.today ?? new Date();
  const maturedCutoffDate = typicalLifecycleDays !== null ? subDays(today, typicalLifecycleDays) : null;
  const shouldWarn =
    typicalLifecycleDays !== null &&
    Number.isFinite(typicalLifecycleDays) &&
    dateRange.end.getTime() > (maturedCutoffDate?.getTime() ?? Number.MAX_SAFE_INTEGER);

  return {
    cohortCount: cohort.length,
    excludedSystemStateCount: excludedSystemRows.length,
    excludedLtvCount: excludedLtvRows.length,
    excludedProductTransferCount: excludedPtRows.length,
    stagesSkipped,
    rows,
    exitAnalysis: buildExitAnalysis(cohort),
    inFlightWarning: {
      shouldWarn,
      maturedCutoffDate,
    },
  };
}
