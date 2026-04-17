import { describe, expect, it } from 'vitest';
import { parseRow, qualityReport } from './csvParser';
import type { MortgageCase } from '../types/mortgage';

describe('csvParser', () => {
  it('parses pence and rates correctly', () => {
    const parsed = parseRow({
      case_id: '1',
      lender: 'Halifax',
      lender_id: '10',
      prev_lender: '',
      case_type: 'REASON_FTB',
      case_status: 'COMPLETE',
      not_proceeding_reason: '',
      created_at: '01/01/2025 03:15',
      first_submitted_date: '02/01/2025 03:15',
      last_submitted_date: '02/01/2025 03:15',
      first_offer_date: '10/01/2025 03:15',
      completion_date: '20/01/2025 03:15',
      mortgage_amount: '19550000',
      property_value: '25000000',
      ltv: '0.78',
      linked_protection: 't',
      total_broker_fees: '100000',
      gross_mortgage_proc_fee: '75000',
      total_case_revenue: '175000',
      initial_pay_rate: '454000',
    });

    expect(parsed.mortgageAmount).toBe(195_500);
    expect(parsed.totalCaseRevenue).toBe(1_750);
    expect(parsed.initialPayRate).toBeCloseTo(4.54, 2);
  });

  it('flags degraded and critical quality thresholds', () => {
    const rows = new Array(100).fill(null) as unknown as MortgageCase[];
    const report = qualityReport(
      rows,
      {
        created_at: 8,
        case_status: 7,
        first_offer_date: 2,
      },
    );

    expect(report.degradedColumns).toContain('created_at');
    expect(report.criticalFailure).toBe(true);
  });
});

