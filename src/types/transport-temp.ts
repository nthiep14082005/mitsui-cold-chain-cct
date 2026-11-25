export type TripType = 'THU_GOM' | 'TRUNG_CHUYEN' | 'GIAO_HANG';

export interface TripStop {
  stopOrder: number;
  orgId: string;
  locationName: string;
  address: string;
  plannedTime: string;
  actualCheckInTime?: string;
  gpsLat?: number;
  gpsLng?: number;
  action: 'LAY_HANG' | 'GIAO_HANG';
}

export interface TripAssignment {
  lotId: string;
  compartmentNo: number;
  weightKg: number;
}

export interface Trip {
  id: string;
  code: string;
  tripType: TripType;
  transportOrgId: string;
  vehicleId: string;
  driverUserId: string;
  plannedDate: string;
  status: 'MOI_TAO' | 'DA_NHAN_LENH' | 'DANG_CHAY' | 'HOAN_TAT';
  assignments: TripAssignment[];
  totalWeightKg: number;
  fillRatePct: number;
  stops: TripStop[];
  projectedArrivalTime?: string;
  targetTimeSlot?: string;
  isLateEta: boolean;
  createdAt: string;
}

export interface LoggerDevice {
  id: string;
  code: string;
  name: string;
  mountType: 'PHONG_MAT' | 'XE' | 'BUONG_KHO';
  ownerOrgId: string;
  targetEntityId: string;
  tempGroupId?: string;
  lastSeenAt?: string;
}

export interface TempReading {
  id: string;
  loggerId: string;
  timestamp: string;
  tempC: number;
  humidityPct: number;
  source: 'IOT' | 'API' | 'CSV';
  ingestedAt: string;
}

export interface TempAlert {
  id: string;
  alertType: 'VUOT_NGUONG' | 'MAT_TIN_HIEU';
  lotId: string;
  loggerId: string;
  stage: string;
  custodianOrgId: string;
  startTime: string;
  endTime?: string;
  durationMinutes: number;
  peakTempC?: number;
  allowedRange: string;
  acknowledgedAt?: string;
  acknowledgedByUserId?: string;
  actionNote?: string;
  escalationReminded: boolean;
  createdAt: string;
}
