import Papa from 'papaparse';
import type { MortgageCase, ParseQualityReport } from '../types/mortgage';
import { RAW_CASE_STATUSES } from './constants';
import { parseDateForColumn } from './dateUtils';

type ParseProgress = (value: number) => void;

const CASE_STATUSES = new Set(RAW_CASE_STATUSES);
const CASE_TYPE_NORMALIZATION_MAP: Record<string, MortgageCase['caseType']> = {
  REASON_FTB: 'REASON_FTB',
  REASON_REMORTGAGE: 'REASON_REMORTGAGE',
  REASON_HOUSE_MOVE: 'REASON_HOUSE_MOVE',
  REASON_BTL: 'REASON_BTL',
  REASON_OTHER: 'REASON_OTHER',
  REASON_BTL_REMORTGAGE: 'REASON_BTL_REMORTGAGE',
  REASON_BUY_TO_LET_REMORTGAGE: 'REASON_BTL_REMORTGAGE',
  BUY_TO_LET_REMORTGAGE: 'REASON_BTL_REMORTGAGE',
  BTL_REMORTGAGE: 'REASON_BTL_REMORTGAGE',
  REASON_EQUITY_RELEASE: 'REASON_EQUITY_RELEASE',
  EQUITY_RELEASE: 'REASON_EQUITY_RELEASE',
  REASON_BRIDGING: 'REASON_BRIDGING',
  BRIDGING: 'REASON_BRIDGING',
  REASON_INVALID_MORTGAGE_REASON: 'REASON_INVALID_MORTGAGE_REASON',
  INVALID_MORTGAGE_REASON: 'REASON_INVALID_MORTGAGE_REASON',
  REASON_COMMERCIAL: 'REASON_COMMERCIAL',
  COMMERCIAL: 'REASON_COMMERCIAL',
};

function toNumber(raw: string): number | null {
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoneyPounds(raw: string): number | null {
  const parsed = toNumber(raw);
  return parsed === null ? null : parsed / 100;
}

function toBool(raw: string): boolean {
  return raw === 't' || raw === 'true' || raw === '1';
}

function normaliseInitialRateType(raw: string): MortgageCase['initialRateType'] {
  const normalized = (raw ?? '').trim().toUpperCase();
  if (!normalized) {
    return 'unknown';
  }
  if (normalized.includes('FIXED')) {
    return 'fixed';
  }
  if (normalized.includes('TRACKER')) {
    return 'tracker';
  }
  if (normalized.includes('DISCOUNT')) {
    return 'discount';
  }
  if (normalized.includes('VARIABLE')) {
    return 'variable';
  }
  if (normalized.includes('STEPPED')) {
    return 'stepped';
  }
  return 'other';
}

function normaliseTermUnit(raw: string): MortgageCase['termUnit'] {
  const normalized = (raw ?? '').trim().toUpperCase();
  if (normalized === 'TERM_MONTHS' || normalized === 'TERM_YEARS') {
    return normalized;
  }
  return 'UNKNOWN';
}

export function parseRow(row: Record<string, string> | null | undefined): MortgageCase {
  const safeRow = row ?? {};
  const normalizedCaseType = (safeRow.case_type ?? '').trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
  const caseType = CASE_TYPE_NORMALIZATION_MAP[normalizedCaseType] ?? 'UNKNOWN';
  const normalisedStatus = (safeRow.case_status ?? '').trim().toUpperCase();
  const caseStatus = (CASE_STATUSES.has(normalisedStatus as MortgageCase['caseStatus']) ? normalisedStatus : 'LEAD') as MortgageCase['caseStatus'];
  return {
    caseId: safeRow.case_id ?? '',
    lender: safeRow.lender || 'Blank lender',
    lenderId: safeRow.lender_id || 'blank',
    prevLender: safeRow.prev_lender || null,
    caseType,
    caseStatus,
    notProceedingReason: safeRow.not_proceeding_reason || null,
    notProceedingDate: parseDateForColumn('not_proceeding_date', safeRow.not_proceeding_date),
    createdAt: parseDateForColumn('created_at', safeRow.created_at),
    recommendationDate: parseDateForColumn('recommendation_date', safeRow.recommendation_date),
    firstSubmittedDate: parseDateForColumn('first_submitted_date', safeRow.first_submitted_date),
    lastSubmittedDate: parseDateForColumn('last_submitted_date', safeRow.last_submitted_date),
    firstOfferDate: parseDateForColumn('first_offer_date', safeRow.first_offer_date),
    completionDate: parseDateForColumn('completion_date', safeRow.completion_date),
    mortgageAmount: toMoneyPounds(safeRow.mortgage_amount),
    propertyValue: toMoneyPounds(safeRow.property_value),
    ltv: toNumber(safeRow.ltv),
    linkedProtection: toBool(safeRow.linked_protection),
    totalBrokerFees: toMoneyPounds(safeRow.total_broker_fees),
    grossMortgageProcFee: toMoneyPounds(safeRow.gross_mortgage_proc_fee),
    totalCaseRevenue: toMoneyPounds(safeRow.total_case_revenue),
    netCaseRevenue: toMoneyPounds(safeRow.net_case_revenue),
    initialPayRate: toNumber(safeRow.initial_pay_rate) === null ? null : (toNumber(safeRow.initial_pay_rate) ?? 0) / 10_000_000,
    initialRateType: normaliseInitialRateType(safeRow.initial_rate_type),
    initialRateTypeRaw: safeRow.initial_rate_type?.trim() ? safeRow.initial_rate_type.trim().toUpperCase() : null,
    term: toNumber(safeRow.term),
    termUnit: normaliseTermUnit(safeRow.term_unit),
    regulated: toBool(safeRow.regulated),
    consumerBtl: toBool(safeRow.consumer_btl),
    furtherAdvance: toBool(safeRow.further_advance),
    pt: toBool(safeRow.pt),
    porting: toBool(safeRow.porting),
    clubName: safeRow.club_name?.trim() ? safeRow.club_name.trim() : null,
  };
}

export function qualityReport(data: MortgageCase[], failures: Record<string, number>): ParseQualityReport {
  const total = Math.max(data.length, 1);
  const degradedColumns = Object.entries(failures)
    .filter(([, count]) => count / total > 0.01)
    .map(([column]) => column);
  const criticalColumns = ['case_status', 'lender', 'created_at'];
  const criticalFailure = criticalColumns.some((column) => (failures[column] ?? 0) / total > 0.05);
  return {
    dateParseFailures: failures,
    degradedColumns,
    criticalFailure,
  };
}

function shouldRetryWithoutWorker(rows: MortgageCase[], quality: ParseQualityReport): boolean {
  const rowCount = Math.max(rows.length, 1);
  const createdAtFailures = quality.dateParseFailures.created_at ?? 0;
  // Worker parsing can degrade large CSVs in some browser/build combinations.
  return createdAtFailures / rowCount > 0.01;
}

export async function parseMortgageCsv(url: string, onProgress: ParseProgress): Promise<{ rows: MortgageCase[]; quality: ParseQualityReport }> {
  const resolvedUrl = new URL(url, window.location.href).toString();

  const parseWithConfig = (worker: boolean): Promise<{ rows: MortgageCase[]; quality: ParseQualityReport }> => {
  const rows: MortgageCase[] = [];
  const parseFailures: Record<string, number> = {};
  let processedRows = 0;

    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(resolvedUrl, {
      download: true,
      header: true,
      worker,
      skipEmptyLines: true,
      step: (result) => {
        processedRows += 1;
        if (processedRows % 5_000 === 0) {
          onProgress(Math.min(99, Math.round(processedRows / 3_132)));
        }
        if (!result.data || typeof result.data !== 'object') {
          return;
        }
        const parsed = parseRow(result.data);
        const dateColumns: Array<keyof MortgageCase> = [
          'createdAt',
          'recommendationDate',
          'firstSubmittedDate',
          'lastSubmittedDate',
          'firstOfferDate',
          'completionDate',
        ];
        for (const key of dateColumns) {
          const value = parsed[key];
          const rawKey = key.replace(/[A-Z]/g, (x) => `_${x.toLowerCase()}`);
          if (value === null && result.data[rawKey]) {
            parseFailures[rawKey] = (parseFailures[rawKey] ?? 0) + 1;
          }
        }
        rows.push(parsed);
      },
      complete: () => {
        onProgress(100);
        resolve({ rows, quality: qualityReport(rows, parseFailures) });
      },
      error: (error) => reject(error),
    });
  });
  };

  const nonWorkerResult = await parseWithConfig(false);
  if (shouldRetryWithoutWorker(nonWorkerResult.rows, nonWorkerResult.quality)) {
    // Keep a defensive fallback path in case browser parsing behaviour changes.
    return parseWithConfig(true);
  }
  return nonWorkerResult;
}

