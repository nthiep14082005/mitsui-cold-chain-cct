export type LotStatus =
  | 'DA_TAO'
  | 'DANG_LAM_LANH'
  | 'DANG_TRUNG_CHUYEN'
  | 'TRONG_KHO'
  | 'DANG_GIAO'
  | 'DA_GIAO'
  | 'CO_KHIEU_NAI'
  | 'DONG';

export type HandoverStage = 'BG1' | 'BG2' | 'BG3' | 'BG4' | 'BG5';

export interface LocationSegment {
  stage: 'PHONG_MAT' | 'XE_TRUNG_CHUYEN' | 'BUONG_KHO' | 'XE_GIAO';
  loggerId: string;
  locationLabel: string;
  custodianOrgId: string;
  fromTime: string;
  toTime?: string;
}

export interface SortingRecord {
  id: string;
  packingOrgId: string;
  supplierOrgId: string;
  productId: string;
  bg1EpodId?: string;
  rawInputKg: number;
  acceptedKg: number;
  rejectedKg: number;
  rejectionReason: string;
  sortedAt: string;
  sortedByUserId: string;
}

export interface Lot {
  id: string;
  lotCode: string;
  qrToken: string;
  productId: string;
  tempGroupId: string;
  supplierOrgId: string;
  packingOrgId: string;
  customerOrgId?: string;
  orderId?: string;
  deliveryPointName?: string;
  growingArea: string;
  harvestDate: string;
  packingDate: string;
  certCode?: string;
  initialKg: number;
  currentKg: number;
  status: LotStatus;
  currentCustodianOrgId: string;
  parentLotId?: string;
  childLotIds: string[];
  sortingRecordId?: string;
  warehouseOrgId?: string;
  chamberId?: string;
  storageEnteredAt?: string;
  coolingStartedAt?: string;
  coolingEndedAt?: string;
  deliveredAt?: string;
  claimWindowEndsAt?: string;
  hasTempAlert: boolean;
  hasDataGap: boolean;
  wmsSyncedAt?: string;
  locationSegments: LocationSegment[];
  createdAt: string;
}

export interface EpodRecord {
  id: string;
  idempotencyKey: string;
  stage: HandoverStage;
  lotId: string;
  tripId?: string;
  senderOrgId: string;
  receiverOrgId: string;
  senderUserId?: string;
  receiverUserId?: string;
  actualKg: number;
  prevReferenceKg?: number;
  variancePct?: number;
  varianceReason?: string;
  measuredTempC: number;
  tempOutOfRange: boolean;
  acceptedKg?: number;
  rejectedKg?: number;
  qcRejectionReason?: string;
  chamberId?: string;
  photoDataUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
  recordedAt: string;
  syncedAt: string;
  senderConfirmedAt?: string;
  receiverConfirmedAt?: string;
  isOfflineRecorded: boolean;
  status: 'CHO_XAC_NHAN_HAI_BEN' | 'HOAN_TAT' | 'TU_CHOI_NHAN';
}

export interface EpodAdjustment {
  id: string;
  originalEpodId: string;
  lotId: string;
  stage: HandoverStage;
  adjustedActualKg: number;
  adjustedTempC: number;
  adjustedAcceptedKg?: number;
  adjustedRejectedKg?: number;
  reason: string;
  createdByUserId: string;
  createdAt: string;
  senderConfirmedAt?: string;
  receiverConfirmedAt?: string;
  status: 'CHO_XAC_NHAN_HAI_BEN' | 'DA_HIEU_LUC';
}
