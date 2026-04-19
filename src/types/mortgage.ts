export type LoadStatus = 'idle' | 'parsing' | 'internal-ready' | 'all-ready' | 'error';

export type RawCaseStatus =
  | 'LEAD'
  | 'PRE_RECOMMENDATION'
  | 'POST_RECOMMENDATION_REVIEW'
  | 'PRE_APPLICATION'
  | 'REVIEW'
  | 'APPLICATION_SUBMITTED'
  | 'REFERRED'
  | 'AWAITING_VALUATION'
  | 'AWAITING_OFFER'
  | 'OFFER_RECEIVED'
  | 'EXCHANGE'
  | 'COMPLETE'
  | 'IMPORTING'
  | 'IMPORTED_COMPLETE'
  | 'NOT_PROCEEDING';

export type PipelineStage =
  | 'LEAD'
  | 'RECOMMENDATION'
  | 'APPLICATION'
  | 'OFFER'
  | 'COMPLETION'
  | 'NOT_PROCEEDING';

export type CaseType =
  | 'REASON_FTB'
  | 'REASON_REMORTGAGE'
  | 'REASON_HOUSE_MOVE'
  | 'REASON_BTL'
  | 'REASON_BTL_REMORTGAGE'
  | 'REASON_EQUITY_RELEASE'
  | 'REASON_BRIDGING'
  | 'REASON_INVALID_MORTGAGE_REASON'
  | 'REASON_COMMERCIAL'
  | 'REASON_OTHER'
  | 'UNKNOWN';

export type TimePeriodType = 'this_year' | 'this_half' | 'this_quarter' | 'this_month' | 'custom';
export type InitialRateType = 'fixed' | 'tracker' | 'discount' | 'variable' | 'stepped' | 'other' | 'unknown';
export type TermUnit = 'TERM_MONTHS' | 'TERM_YEARS' | 'UNKNOWN';

export interface TimePeriod {
  type: TimePeriodType;
  start?: Date;
  end?: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ParseQualityReport {
  dateParseFailures: Record<string, number>;
  degradedColumns: string[];
  criticalFailure: boolean;
}

export interface MortgageCase {
  caseId: string;
  lender: string;
  lenderId: string;
  prevLender: string | null;
  caseType: CaseType;
  caseStatus: RawCaseStatus;
  notProceedingReason: string | null;
  notProceedingDate?: Date | null;
  createdAt: Date | null;
  recommendationDate?: Date | null;
  firstSubmittedDate: Date | null;
  lastSubmittedDate: Date | null;
  firstOfferDate: Date | null;
  completionDate: Date | null;
  mortgageAmount: number | null;
  propertyValue: number | null;
  ltv: number | null;
  linkedProtection: boolean;
  totalBrokerFees: number | null;
  grossMortgageProcFee: number | null;
  totalCaseRevenue: number | null;
  netCaseRevenue?: number | null;
  initialPayRate: number | null;
  initialRateType?: InitialRateType;
  initialRateTypeRaw?: string | null;
  term?: number | null;
  termUnit?: TermUnit;
  regulated?: boolean;
  consumerBtl?: boolean;
  furtherAdvance?: boolean;
  pt?: boolean;
  porting?: boolean;
  clubName?: string | null;
}

export interface DistributionBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface PipelineRow {
  status: PipelineStage;
  count: number;
  percentage: number;
}

export interface FunnelStage {
  stage: PipelineStage;
  name: string;
  description: string;
  value: number;
  pctPrev: number | null;
  pctTotal?: number | null;
  avgDays: number | null;
  isDropOff?: boolean;
}

export type FunnelMode = 'funnel' | 'distribution';
export type FunnelScope = 'internal' | 'lender';

export interface StageDistributionRow {
  stage: PipelineStage;
  count: number;
  shareOfTotal: number;
}

export interface StageDistributionResult {
  rows: StageDistributionRow[];
  totalIncludedCases: number;
  excludedSystemStateCount: number;
}

export interface PipelineFunnelRow {
  stage: Exclude<PipelineStage, 'NOT_PROCEEDING'>;
  count: number;
  stageConversion: number | null;
  cumulativeConversion: number;
  medianDaysFromPrev: number | null;
}

export interface PipelineExitBreakdownRow {
  stage: PipelineStage;
  count: number;
  percentage: number;
}

export interface PipelineExitAnalysis {
  exitRate: number;
  exitedCases: number;
  breakdown: PipelineExitBreakdownRow[];
}

export interface InFlightWarning {
  shouldWarn: boolean;
  maturedCutoffDate: Date | null;
}

export interface PipelineFunnelResult {
  cohortCount: number;
  excludedSystemStateCount: number;
  excludedLtvCount: number;
  excludedProductTransferCount: number;
  stagesSkipped: number;
  rows: PipelineFunnelRow[];
  exitAnalysis: PipelineExitAnalysis;
  inFlightWarning: InFlightWarning;
}

export interface VolumeDataPoint {
  key: string;
  month: string;
  count: number;
}

export interface DailyVolumeDataPoint {
  key: string;
  day: string;
  count: number;
}

export interface MarketStats {
  totalCases: number;
  totalLoanValue: number;
  completedCases: number;
  avgCompletionDays: number;
  avgLtv: number;
  protectionAttachRate: number;
  avgDaysToOffer: number;
  avgDaysToComplete: number;
  resubmissionRate: number;
  stalledSubmittedRate: number;
  pipeline: PipelineRow[];
  excludedSystemStateCount: number;
  monthlyVolume: VolumeDataPoint[];
  dailyVolume: DailyVolumeDataPoint[];
  caseMix: DistributionBucket[];
  marketShare: Array<{ lender: string; count: number; percentage: number }>;
  ltvDistribution: DistributionBucket[];
  mortgageAmountDistribution: DistributionBucket[];
}

export interface LenderStats {
  lender: string;
  totalCases: number;
  marketShare: number;
  avgLoanSize: number;
  completionRate: number;
  avgDaysToOffer: number;
  avgLtv: number;
  brokerRevenuePerCase: number;
  protectionAttachRate: number;
  avgDaysToComplete: number;
  resubmissionRate: number;
  caseMix: DistributionBucket[];
  pipeline: PipelineRow[];
  excludedSystemStateCount: number;
}

export interface PeriodModel {
  periodKey: string;
  periodData: MortgageCase[];
  marketStats: MarketStats;
  lenderStats: Map<string, LenderStats> | null;
  quality: ParseQualityReport;
}

