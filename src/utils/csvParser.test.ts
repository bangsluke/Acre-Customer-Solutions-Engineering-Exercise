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
      net_case_revenue: '170000',
      initial_pay_rate: '454000',
      initial_rate_type: 'CLASS_FIXED',
      term: '420',
      term_unit: 'TERM_MONTHS',
      regulated: 't',
      consumer_btl: 'f',
      further_advance: 't',
      pt: 'f',
      porting: 't',
      club_name: 'Right Mortgage Network',
    });

    expect(parsed.mortgageAmount).toBe(195_500);
    expect(parsed.totalCaseRevenue).toBe(1_750);
    expect(parsed.netCaseRevenue).toBe(1_700);
    expect(parsed.initialPayRate).toBeCloseTo(0.0454, 4);
    expect(parsed.initialRateType).toBe('fixed');
    expect(parsed.initialRateTypeRaw).toBe('CLASS_FIXED');
    expect(parsed.term).toBe(420);
    expect(parsed.termUnit).toBe('TERM_MONTHS');
    expect(parsed.regulated).toBe(true);
    expect(parsed.consumerBtl).toBe(false);
    expect(parsed.furtherAdvance).toBe(true);
    expect(parsed.porting).toBe(true);
    expect(parsed.clubName).toBe('Right Mortgage Network');
  });

  it('defaults empty lender fields to blank labels', () => {
    const parsed = parseRow({
      case_id: '2',
      lender: '',
      lender_id: '',
      prev_lender: '',
      case_type: 'REASON_FTB',
      case_status: 'LEAD',
      not_proceeding_reason: '',
      created_at: '01/01/2025 03:15',
      first_submitted_date: '',
      last_submitted_date: '',
      first_offer_date: '',
      completion_date: '',
      mortgage_amount: '',
      property_value: '',
      ltv: '',
      linked_protection: 'f',
      total_broker_fees: '',
      gross_mortgage_proc_fee: '',
      total_case_revenue: '',
      initial_pay_rate: '',
    });

    expect(parsed.lender).toBe('Blank lender');
    expect(parsed.lenderId).toBe('blank');
  });

  it('maps stepped and preserves invalid initial rate class values', () => {
    const stepped = parseRow({
      case_id: '3',
      case_type: 'REASON_FTB',
      case_status: 'LEAD',
      initial_rate_type: 'CLASS_STEPPED',
      created_at: '01/01/2025 03:15',
    });
    const invalid = parseRow({
      case_id: '4',
      case_type: 'REASON_FTB',
      case_status: 'LEAD',
      initial_rate_type: 'INVALID_MORTGAGE_CLASS',
      created_at: '01/01/2025 03:15',
    });

    expect(stepped.initialRateType).toBe('stepped');
    expect(invalid.initialRateType).toBe('other');
    expect(invalid.initialRateTypeRaw).toBe('INVALID_MORTGAGE_CLASS');
  });

  it('normalizes expanded other case types', () => {
    const values: Array<[string, MortgageCase['caseType']]> = [
      ['Buy-to-let Remortgage', 'REASON_BTL_REMORTGAGE'],
      ['equity_release', 'REASON_EQUITY_RELEASE'],
      ['REASON_BRIDGING', 'REASON_BRIDGING'],
      ['invalid mortgage reason', 'REASON_INVALID_MORTGAGE_REASON'],
      ['COMMERCIAL', 'REASON_COMMERCIAL'],
    ];

    for (const [rawCaseType, expected] of values) {
      const parsed = parseRow({
        case_id: `normalized-${rawCaseType}`,
        case_type: rawCaseType,
        case_status: 'LEAD',
        created_at: '01/01/2025 03:15',
      });
      expect(parsed.caseType).toBe(expected);
    }
  });

  it('handles malformed worker rows safely', () => {
    const parsed = parseRow(undefined);

    expect(parsed.caseType).toBe('UNKNOWN');
    expect(parsed.caseStatus).toBe('LEAD');
    expect(parsed.lender).toBe('Blank lender');
    expect(parsed.caseId).toBe('');
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

