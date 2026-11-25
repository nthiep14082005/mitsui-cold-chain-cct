export type OrderStatus =
  | 'DA_NHAN'
  | 'PHAT_SINH'
  | 'DA_XAC_NHAN'
  | 'TU_CHOI'
  | 'DANG_THUC_HIEN'
  | 'HOAN_TAT';

export interface DailyOrderItem {
  productId: string;
  requestedKg: number;
  confirmedKg: number;
}

export interface DailyOrder {
  id: string;
  code: string;
  customerOrgId: string;
  contractId: string;
  deliveryDate: string;
  deliveryPointId: string;
  deliveryPointName: string;
  timeSlot: string;
  createdAt: string;
  updatedAt: string;
  isAdHoc: boolean;
  status: OrderStatus;
  rejectionReason?: string;
  confirmedByUserId?: string;
  items: DailyOrderItem[];
  fulfilledLotIds: string[];
}

export interface OriginDeclaration {
  growingArea: string;
  harvestDate: string;
  certCode?: string;
  declaredAt: string;
  declaredByUserId: string;
}

export interface SupplierAllocation {
  id: string;
  supplierOrgId: string;
  productId: string;
  netOrderKg: number;
  bufferPct: number;
  requiredRawKg: number;
  confirmedKg?: number;
  proposedKg?: number;
  confirmationStatus: 'CHO_XAC_NHAN' | 'DA_XAC_NHAN' | 'DE_XUAT_KHAC';
  note?: string;
  originDeclaration?: OriginDeclaration;
}

export interface SupplyPlan {
  id: string;
  code: string;
  planDate: string;
  status: 'NHAP' | 'DA_PHAT_HANH';
  createdAt: string;
  publishedAt?: string;
  orderIds: string[];
  allocations: SupplierAllocation[];
  storageDemandByTempGroup: Record<string, number>;
  plannedTripCount: number;
}
