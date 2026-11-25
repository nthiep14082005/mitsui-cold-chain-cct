import {
  AuditLog,
  NotificationItem,
  Organization,
  SystemConfig,
  User,
} from './common';
import {
  FrameworkContract,
  PartnerContract,
  Product,
  TempGroup,
  Vehicle,
} from './catalog';
import { DailyOrder, SupplyPlan } from './order-plan';
import {
  EpodAdjustment,
  EpodRecord,
  Lot,
  SortingRecord,
} from './lot-epod';
import {
  LoggerDevice,
  TempAlert,
  TempReading,
  Trip,
} from './transport-temp';

export type SuspectedStageCode =
  | 'BG_TEMP_OUT_OF_RANGE'
  | 'STAGE_TEMP_OR_SIGNAL_ALERT'
  | 'STAGE_WEIGHT_LOSS'
  | 'NGUON_HANG_HOAC_SAU_BAN_GIAO';

export interface PartnerExplanation {
  submittedByUserId: string;
  orgId: string;
  content: string;
  submittedAt: string;
}

export interface ClaimDecision {
  responsiblePartyType: 'DOI_TAC' | 'NGUON_HANG' | 'SAU_BAN_GIAO' | 'MITSUI';
  responsibleOrgId?: string;
  compensatedKg: number;
  customerCompensationVnd: number;
  partnerPenaltyVnd: number;
  reason: string;
  decidedByUserId: string;
  decidedAt: string;
}

export interface Claim {
  id: string;
  code: string;
  lotId: string;
  customerOrgId: string;
  affectedKg: number;
  description: string;
  createdAt: string;
  status: 'MOI_TAO' | 'CHO_GIAI_TRINH' | 'DA_GIAI_TRINH' | 'DA_PHAN_QUYET';
  systemSuggestedOrgId?: string;
  systemSuggestedStage: string;
  systemSuggestionRule: SuspectedStageCode;
  systemSuggestionDetail: string;
  explanationDeadlineAt: string;
  partnerExplanation?: PartnerExplanation;
  decision?: ClaimDecision;
}

export interface StatementLineItem {
  description: string;
  quantityKg: number;
  rateVnd: number;
  amountVnd: number;
  refCode?: string;
}

export interface MonthlyStatement {
  id: string;
  code: string;
  month: string;
  statementType: 'KHACH_HANG' | 'DOI_TAC';
  orgId: string;
  committedKg?: number;
  actualDeliveredKg: number;
  acceptedKg?: number;
  billableKg: number;
  unitPriceVndPerKg: number;
  grossAmountVnd: number;
  deductionOrPenaltyVnd: number;
  netAmountVnd: number;
  lineItems: StatementLineItem[];
  status: 'CHO_XAC_NHAN' | 'DA_XAC_NHAN';
  confirmedByUserId?: string;
  confirmedAt?: string;
  generatedAt: string;
}

export interface PartnerScoreRecord {
  id: string;
  partnerOrgId: string;
  month: string;
  onTimeRatePct: number;
  tempCompliancePct: number;
  weightCompliancePct: number;
  claimFreeScorePct: number;
  totalScore: number;
  contractReviewFlag: boolean;
  calculatedAt: string;
}

export interface KpiMetricItem {
  key: string;
  group: string;
  label: string;
  actualValue: number;
  unit: string;
  targetLabel: string;
  passed: boolean;
  formulaNote: string;
}

export interface KpiDashboardData {
  metrics: KpiMetricItem[];
  summary: {
    totalLotsEvaluated: number;
    totalBg5Kg: number;
    totalAcceptedKg: number;
    totalRevenueVnd: number;
    totalPartnerCostVnd: number;
    operatingProfitVnd: number;
    coordCostEstimateVndPerKg: number;
  };
}

export interface CctDatabase {
  version: number;
  lastUpdatedAt: string;
  systemConfig: SystemConfig;
  organizations: Organization[];
  users: User[];
  tempGroups: TempGroup[];
  products: Product[];
  vehicles: Vehicle[];
  frameworkContracts: FrameworkContract[];
  partnerContracts: PartnerContract[];
  dailyOrders: DailyOrder[];
  supplyPlans: SupplyPlan[];
  sortingRecords: SortingRecord[];
  lots: Lot[];
  epods: EpodRecord[];
  epodAdjustments: EpodAdjustment[];
  trips: Trip[];
  loggers: LoggerDevice[];
  tempReadings: TempReading[];
  tempAlerts: TempAlert[];
  claims: Claim[];
  statements: MonthlyStatement[];
  partnerScores: PartnerScoreRecord[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
}
