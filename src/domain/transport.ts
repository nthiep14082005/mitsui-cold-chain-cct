import { Vehicle } from '@/types/catalog';
import { Lot } from '@/types/lot-epod';
import { Trip, TripAssignment } from '@/types/transport-temp';

export interface TripValidationResult {
  valid: boolean;
  error?: string;
  totalWeightKg: number;
  fillRatePct: number;
}

/**
 * BR-05 & FR-23: Hard enforcement for manual trip assignment:
 * - Two lots with different temperature groups CANNOT be in the same vehicle compartment.
 * - Total weight CANNOT exceed vehicle capacityKg (nor individual compartment capacityKg).
 */
export function validateTripAssignment(
  vehicle: Vehicle,
  assignments: TripAssignment[],
  lotsMap: Map<string, Lot>
): TripValidationResult {
  if (!assignments.length) {
    return {
      valid: false,
      error: 'Chuyến xe phải được gán ít nhất 1 lô hàng.',
      totalWeightKg: 0,
      fillRatePct: 0,
    };
  }

  let totalWeightKg = 0;
  const compMap = new Map(vehicle.compartments.map((c) => [c.compartmentNo, c]));
  const compTempGroups = new Map<number, Set<string>>();
  const compWeights = new Map<number, number>();

  for (const item of assignments) {
    const lot = lotsMap.get(item.lotId);
    if (!lot) {
      return {
        valid: false,
        error: `Không tìm thấy lô hàng ${item.lotId}.`,
        totalWeightKg: 0,
        fillRatePct: 0,
      };
    }
    const comp = compMap.get(item.compartmentNo);
    if (!comp) {
      return {
        valid: false,
        error: `Xe ${vehicle.plateNumber} không có khoang số ${item.compartmentNo}.`,
        totalWeightKg: 0,
        fillRatePct: 0,
      };
    }
    if (item.weightKg <= 0) {
      return {
        valid: false,
        error: `Khối lượng xếp của lô ${lot.lotCode} phải lớn hơn 0 kg.`,
        totalWeightKg: 0,
        fillRatePct: 0,
      };
    }

    totalWeightKg += item.weightKg;
    compWeights.set(item.compartmentNo, (compWeights.get(item.compartmentNo) ?? 0) + item.weightKg);

    const tgSet = compTempGroups.get(item.compartmentNo) ?? new Set<string>();
    tgSet.add(lot.tempGroupId);
    compTempGroups.set(item.compartmentNo, tgSet);
  }

  for (const [compNo, tgSet] of compTempGroups.entries()) {
    if (tgSet.size > 1) {
      return {
        valid: false,
        error: `Vi phạm BR-05: Không được xếp 2 lô khác nhóm nhiệt (Lạnh 0–4°C và Mát 10–13°C) vào cùng Khoang ${compNo} trên xe ${vehicle.plateNumber}!`,
        totalWeightKg,
        fillRatePct: Math.round((totalWeightKg / vehicle.capacityKg) * 1000) / 10,
      };
    }
    const comp = compMap.get(compNo)!;
    const w = compWeights.get(compNo) ?? 0;
    if (w > comp.capacityKg) {
      return {
        valid: false,
        error: `Vi phạm FR-23: Khối lượng Khoang ${compNo} (${w.toLocaleString('vi-VN')} kg) vượt tải trọng khoang (${comp.capacityKg.toLocaleString('vi-VN')} kg).`,
        totalWeightKg,
        fillRatePct: Math.round((totalWeightKg / vehicle.capacityKg) * 1000) / 10,
      };
    }
  }

  if (totalWeightKg > vehicle.capacityKg) {
    return {
      valid: false,
      error: `Vi phạm BR-05 / FR-23: Tổng khối lượng (${totalWeightKg.toLocaleString('vi-VN')} kg) vượt tải trọng đăng ký của xe ${vehicle.plateNumber} (${vehicle.capacityKg.toLocaleString('vi-VN')} kg).`,
      totalWeightKg,
      fillRatePct: Math.round((totalWeightKg / vehicle.capacityKg) * 1000) / 10,
    };
  }

  const fillRatePct = Math.round((totalWeightKg / vehicle.capacityKg) * 1000) / 10;
  return { valid: true, totalWeightKg, fillRatePct };
}

/**
 * FR-25: Evaluates whether projected arrival time exceeds target delivery time slot.
 */
export function evaluateTripEta(trip: Trip): { isLateEta: boolean; delayMinutes: number } {
  if (!trip.projectedArrivalTime || !trip.targetTimeSlot) {
    return { isLateEta: trip.isLateEta, delayMinutes: 0 };
  }
  // targetTimeSlot format e.g. "06:00-08:00"
  const endPart = trip.targetTimeSlot.split('-')[1]?.trim();
  if (!endPart) return { isLateEta: trip.isLateEta, delayMinutes: 0 };
  const targetIso = `${trip.plannedDate}T${endPart}:00+07:00`;
  const diffMs = new Date(trip.projectedArrivalTime).getTime() - new Date(targetIso).getTime();
  const delayMinutes = Math.round(diffMs / 60000);
  return { isLateEta: delayMinutes > 0, delayMinutes: Math.max(0, delayMinutes) };
}
