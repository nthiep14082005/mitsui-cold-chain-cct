export interface TempGroup {
  id: string;
  code: 'LANH' | 'MAT' | string;
  name: string;
  minTempC: number;
  maxTempC: number;
  humidityRef: string;
  maxStorageHours: number;
  description: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  tempGroupId: string;
  packagingSpec: string;
  shrinkageBufferPct: number;
  unit: 'kg';
}

export interface VehicleCompartment {
  compartmentNo: number;
  capacityKg: number;
  loggerId: string;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  transportOrgId: string;
  capacityKg: number;
  compartments: VehicleCompartment[];
  vehicleType: 'THU_GOM' | 'TRUNG_CHUYEN' | 'GIAO_HANG';
  active: boolean;
}

export interface DeliveryPoint {
  id: string;
  name: string;
  address: string;
}

/**
 * Framework contract between Mitsui and B2B Customer (BR-16: service fee only, no produce buy/sell prices).
 */
export interface FrameworkContract {
  id: string;
  code: string;
  customerOrgId: string;
  validFrom: string;
  validTo: string;
  allowedProductIds: string[];
  committedTonsPerMonth: number;
  /** Mitsui cold chain service fee in VND/kg */
  unitPriceVndPerKg: number;
  /** Declared SLA compensation rate in VND/kg for quality claims */
  compensationRateVndPerKg: number;
  slaOtdPct: number;
  slaTempPct: number;
  claimWindowHours: number;
  deliveryPoints: DeliveryPoint[];
  status: 'ACTIVE' | 'EXPIRED';
}

export type PartnerStage =
  | 'SO_CHE'
  | 'KHO_LANH'
  | 'VAN_TAI_TRUNG_CHUYEN'
  | 'VAN_TAI_GIAO';

export interface PartnerContract {
  id: string;
  code: string;
  partnerOrgId: string;
  stage: PartnerStage;
  unitCostVndPerKg: number;
  slaDesc: string;
  penaltyRateVndPerKg: number;
  maxPenaltyPct: number;
  validFrom: string;
  validTo: string;
}
