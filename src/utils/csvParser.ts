import Papa from 'papaparse';
import type { MortgageCase, ParseQualityReport } from '../types/mortgage';
import { parseDateForColumn } from './dateUtils';

type ParseProgress = (value: number) => void;

const CASE_TYPES = new Set(['REASON_FTB', 'REASON_REMORTGAGE', 'REASON_HOUSE_MOVE', 'REASON_BTL', 'REASON_OTHER']);
const CASE_STATUSES = new Set([
  'LEAD',
  'PRE_RECOMMENDATION',
  'APPLICATION_SUBMITTED',
  'OFFER_RECEIVED',
  'COMPLETE',
  'NOT_PROCEEDING',
]);

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
  return raw === 't';
}

export function parseRow(row: Record<string, string>): MortgageCase {
  const caseType = (CASE_TYPES.has(row.case_type) ? row.case_type : 'UNKNOWN') as MortgageCase['caseType'];
  const caseStatus = (CASE_STATUSES.has(row.case_status) ? row.case_status : 'LEAD') as MortgageCase['caseStatus'];
  return {
    caseId: row.case_id,
    lender: row.lender || 'Unknown lender',
    lenderId: row.lender_id || 'unknown',
    prevLender: row.prev_lender || null,
    caseType,
    caseStatus,
    notProceedingReason: row.not_proceeding_reason || null,
    createdAt: parseDateForColumn('created_at', row.created_at),
    firstSubmittedDate: parseDateForColumn('first_submitted_date', row.first_submitted_date),
    lastSubmittedDate: parseDateForColumn('last_submitted_date', row.last_submitted_date),
    firstOfferDate: parseDateForColumn('first_offer_date', row.first_offer_date),
    completionDate: parseDateForColumn('completion_date', row.completion_date),
    mortgageAmount: toMoneyPounds(row.mortgage_amount),
    propertyValue: toMoneyPounds(row.property_value),
    ltv: toNumber(row.ltv),
    linkedProtection: toBool(row.linked_protection),
    totalBrokerFees: toMoneyPounds(row.total_broker_fees),
    grossMortgageProcFee: toMoneyPounds(row.gross_mortgage_proc_fee),
    totalCaseRevenue: toMoneyPounds(row.total_case_revenue),
    initialPayRate: toNumber(row.initial_pay_rate) === null ? null : (toNumber(row.initial_pay_rate) ?? 0) / 100_000,
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

export async function parseMortgageCsv(url: string, onProgress: ParseProgress): Promise<{ rows: MortgageCase[]; quality: ParseQualityReport }> {
  const resolvedUrl = new URL(url, window.location.origin).toString();

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
        const parsed = parseRow(result.data);
        const dateColumns: Array<keyof MortgageCase> = [
          'createdAt',
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

  try {
    return await parseWithConfig(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('invalid url')) {
      return parseWithConfig(false);
    }
    throw error;
  }
}

