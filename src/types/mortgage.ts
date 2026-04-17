export type LoadStatus = 'idle' | 'parsing' | 'internal-ready' | 'all-ready' | 'error';

export type CaseStatus =
  | 'LEAD'
  | 'PRE_RECOMMENDATION'
  | 'APPLICATION_SUBMITTED'
  | 'OFFER_RECEIVED'
  | 'COMPLETE'
  | 'NOT_PROCEEDING';

export type CaseType =
  | 'REASON_FTB'
  | 'REASON_REMORTGAGE'
  | 'REASON_HOUSE_MOVE'
  | 'REASON_BTL'
  | 'REASON_OTHER'
  | 'UNKNOWN';

export type TimePeriodType = 'this_year' | 'this_half' | 'this_quarter' | 'this_month' | 'custom';

export interface TimePeriod {
  type: TimePeriodType;
  start?: Date;
  end?: Date;
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
  caseStatus: CaseStatus;
  notProceedingReason: string | null;
  createdAt: Date | null;
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
  initialPayRate: number | null;
}

export interface DistributionBucket {
  label: string;
  count: number;
  percentage: number;
}

export interface PipelineRow {
  status: CaseStatus;
  count: number;
  percentage: number;
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
  monthlyVolume: Array<{ month: string; count: number }>;
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
}

export interface PeriodModel {
  periodKey: string;
  periodData: MortgageCase[];
  marketStats: MarketStats;
  lenderStats: Map<string, LenderStats> | null;
  quality: ParseQualityReport;
}

