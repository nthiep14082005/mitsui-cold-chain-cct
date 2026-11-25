import { TempGroup } from '@/types/catalog';
import { Organization, WarehouseChamber } from '@/types/common';
import { Lot } from '@/types/lot-epod';

/**
 * FR-18: Suggests a cold storage chamber matching the lot's temperature group.
 */
export function suggestChamberForLot(
  lot: Lot,
  warehouseOrg: Organization,
  activeLotsInWarehouse: Lot[]
): { chamber?: WarehouseChamber; currentLoadKg: number } {
  const chambers = warehouseOrg.chambers ?? [];
  const matching = chambers.filter((c) => c.tempGroupId === lot.tempGroupId);
  if (!matching.length) return { currentLoadKg: 0 };

  let best = matching[0];
  let bestLoad = Infinity;
  for (const ch of matching) {
    const load = activeLotsInWarehouse
      .filter((l) => l.chamberId === ch.id && l.status === 'TRONG_KHO')
      .reduce((s, l) => s + l.currentKg, 0);
    if (load < bestLoad) {
      bestLoad = load;
      best = ch;
    }
  }
  return { chamber: best, currentLoadKg: bestLoad === Infinity ? 0 : bestLoad };
}

/**
 * FR-18 & BR-05: Evaluates chamber selection during BG3 inbound.
 * Warns strongly if chamber temp group differs from lot's temp group,
 * and blocks if chamber currently holds active lots of a different temp group.
 */
export function evaluateChamberSelection(
  lot: Lot,
  chamber: WarehouseChamber,
  activeLotsInChamber: Lot[]
): { allowed: boolean; warning?: string; blockReason?: string } {
  const conflictLot = activeLotsInChamber.find(
    (l) => l.id !== lot.id && l.status === 'TRONG_KHO' && l.tempGroupId !== lot.tempGroupId
  );
  if (conflictLot) {
    return {
      allowed: false,
      blockReason: `BR-05: Buồng ${chamber.name} đang chứa lô ${conflictLot.lotCode} khác nhóm nhiệt. Không thể xếp chung buồng kho!`,
    };
  }
  if (chamber.tempGroupId !== lot.tempGroupId) {
    return {
      allowed: true,
      warning: `Cảnh báo FR-18: Buồng ${chamber.name} không đúng nhóm nhiệt của lô ${lot.lotCode}!`,
    };
  }
  return { allowed: true };
}

/**
 * FR-19: Tracks dwell time in cold storage and raises warning when >= 80% of maxStorageHours.
 */
export function computeStorageShelfLifeStatus(
  lot: Lot,
  tempGroup: TempGroup | undefined,
  nowIso: string,
  warningPct = 80
) {
  const maxHours = tempGroup?.maxStorageHours ?? 48;
  if (!lot.storageEnteredAt) {
    return { hoursStored: 0, maxStorageHours: maxHours, usagePct: 0, isWarning: false, remainingHours: maxHours };
  }
  const enteredMs = new Date(lot.storageEnteredAt).getTime();
  const nowMs = new Date(nowIso).getTime();
  const hoursStored = Math.max(0, (nowMs - enteredMs) / (1000 * 60 * 60));
  const usagePct = Math.round((hoursStored / maxHours) * 1000) / 10;
  return {
    hoursStored: Math.round(hoursStored * 10) / 10,
    maxStorageHours: maxHours,
    usagePct,
    isWarning: usagePct >= warningPct,
    remainingHours: Math.round((maxHours - hoursStored) * 10) / 10,
  };
}

/**
 * FR-20: Sorts warehouse lots by FEFO (First Expired, First Out — smallest remaining shelf life first).
 */
export function getFefoSortedLots(
  warehouseLots: Lot[],
  tempGroups: TempGroup[],
  nowIso: string,
  warningPct = 80
) {
  const tgMap = new Map(tempGroups.map((t) => [t.id, t]));
  return warehouseLots
    .filter((l) => l.status === 'TRONG_KHO' && l.currentKg > 0)
    .map((lot) => ({
      lot,
      shelfLife: computeStorageShelfLifeStatus(lot, tgMap.get(lot.tempGroupId), nowIso, warningPct),
    }))
    .sort((a, b) => a.shelfLife.remainingHours - b.shelfLife.remainingHours);
}
