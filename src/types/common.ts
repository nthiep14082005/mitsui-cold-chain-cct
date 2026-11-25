export type OrgType =
  | 'MITSUI'
  | 'KHACH_HANG'
  | 'NHA_CUNG_CAP'
  | 'CO_SO_SO_CHE'
  | 'KHO_LANH'
  | 'NHA_VAN_TAI';

export type UserRole =
  | 'DIEU_PHOI_VIEN'
  | 'QUAN_LY_QC'
  | 'QUAN_TRI_HE_THONG'
  | 'KHACH_HANG'
  | 'NHA_CUNG_CAP'
  | 'NHAN_VIEN_SO_CHE'
  | 'NHAN_VIEN_KHO'
  | 'TAI_XE'
  | 'NGUOI_TIEU_DUNG';

export interface WarehouseChamber {
  id: string;
  code: string;
  name: string;
  tempGroupId: string;
  capacityKg: number;
  capacityPallets: number;
  loggerId: string;
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  type: OrgType;
  taxCode: string;
  address: string;
  province: string;
  allowPublicName: boolean;
  /** Baseline pre-pilot loss percentage (%) supplied by B2B customer for KPI 9.1 comparison */
  baselineLossPct?: number;
  /** Whether B2B pilot customer renewed framework contract (KPI 8) */
  contractRenewed?: boolean;
  /** Cold storage chambers (only for KHO_LANH) */
  chambers?: WarehouseChamber[];
  /** Contracted pallet slots/day at warehouse for utilization KPI */
  contractedPallets?: number;
  /** Cooling room logger ID (for CO_SO_SO_CHE) */
  coolingLoggerId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  phone: string;
  zalo: string;
  role: UserRole;
  orgId: string;
  active: boolean;
  twoFactorEnabled: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  actorOrgId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  beforeJson: unknown;
  afterJson: unknown;
}

export type NotificationChannel = 'IN_APP' | 'ZALO_ZNS' | 'SMS';

export interface NotificationItem {
  id: string;
  createdAt: string;
  recipientOrgId?: string;
  recipientRole?: UserRole;
  channel: NotificationChannel[];
  eventType: string;
  title: string;
  message: string;
  relatedEntityId?: string;
  isReadByUserIds: string[];
}

export interface ScoreWeights {
  onTime: number;
  tempCompliance: number;
  weightCompliance: number;
  claimFree: number;
}

export interface SystemConfig {
  cutoffHour: number;
  cutoffMinute: number;
  tempAlertMinutes: number;
  signalLossMinutes: number;
  reminderMinutes: number;
  weightTolerancePct: number;
  claimWindowHours: number;
  partnerExplanationHours: number;
  storageWarningPct: number;
  fixedMonthlyOverheadVnd: number;
  breakEvenTonsPerMonth: number;
  targetCoordCostMinVndPerKg: number;
  targetCoordCostMaxVndPerKg: number;
  scoreWeights: ScoreWeights;
}
