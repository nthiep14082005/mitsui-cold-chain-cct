import crypto from 'crypto';
import { EpodRecord, Lot, LotStatus } from '@/types/lot-epod';

export const LOT_STATUS_ORDER: LotStatus[] = [
  'DA_TAO',
  'DANG_LAM_LANH',
  'DANG_TRUNG_CHUYEN',
  'TRONG_KHO',
  'DANG_GIAO',
  'DA_GIAO',
  'CO_KHIEU_NAI',
  'DONG',
];

/**
 * Generates lot code in format <MaCS>-<YYMMDD>-<STT> (Section 6.2 & BR-06), unique & never reused.
 */
export function generateNextLotCode(
  facilityCode: string,
  packingDateIso: string,
  existingLots: Lot[]
): string {
  const datePart = packingDateIso.slice(2, 10).replace(/-/g, '');
  const prefix = `${facilityCode}-${datePart}-`;
  let maxSeq = 0;
  for (const lot of existingLots) {
    if (lot.lotCode.startsWith(prefix)) {
      const tail = lot.lotCode.slice(prefix.length).split('-')[0];
      const seq = Number.parseInt(tail, 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * BR-06 & Section 6.2: Non-guessable random QR token that does not expose lotCode.
 */
export function generateUnguessableQrToken(): string {
  return crypto.randomBytes(9).toString('base64url');
}

/**
 * Validates allowed state transitions for the 8-state lot lifecycle (Section 3.3).
 */
export function canTransitionLotStatus(current: LotStatus, next: LotStatus): boolean {
  if (current === next) return true;
  const allowed: Record<LotStatus, LotStatus[]> = {
    DA_TAO: ['DANG_LAM_LANH', 'DANG_TRUNG_CHUYEN'],
    DANG_LAM_LANH: ['DANG_TRUNG_CHUYEN'],
    DANG_TRUNG_CHUYEN: ['TRONG_KHO'],
    TRONG_KHO: ['DANG_GIAO'],
    DANG_GIAO: ['DA_GIAO'],
    DA_GIAO: ['CO_KHIEU_NAI', 'DONG'],
    CO_KHIEU_NAI: ['DONG'],
    DONG: [],
  };
  return allowed[current]?.includes(next) ?? false;
}

/**
 * Collects effective ePODs for a lot, including inherited pre-split ePODs from parent lot(s)
 * without duplicating records in the database (Section 3.3 & BR-06).
 */
export function getLotInheritedEpods(
  lot: Lot,
  allLots: Lot[],
  allEpods: EpodRecord[]
): EpodRecord[] {
  const lotMap = new Map(allLots.map((l) => [l.id, l]));
  const ownEpods = allEpods.filter((e) => e.lotId === lot.id);
  const ownStages = new Set(ownEpods.map((e) => e.stage));

  const inherited: EpodRecord[] = [];
  let cursorParentId = lot.parentLotId;
  const visited = new Set<string>([lot.id]);

  while (cursorParentId && !visited.has(cursorParentId)) {
    visited.add(cursorParentId);
    const parentEpods = allEpods.filter((e) => e.lotId === cursorParentId);
    for (const pe of parentEpods) {
      if (!ownStages.has(pe.stage)) {
        inherited.push(pe);
        ownStages.add(pe.stage);
      }
    }
    cursorParentId = lotMap.get(cursorParentId)?.parentLotId;
  }

  const stageRank: Record<string, number> = { BG1: 1, BG2: 2, BG3: 3, BG4: 4, BG5: 5 };
  return [...inherited, ...ownEpods].sort(
    (a, b) => (stageRank[a.stage] ?? 99) - (stageRank[b.stage] ?? 99)
  );
}

/**
 * Splits a parent lot into multiple child lots (Section 3.3 & BR-06).
 * Child lots keep parentLotId, inherit pre-split location segments & alert/gap flags.
 */
export function splitLotIntoChildren(params: {
  parentLot: Lot;
  splits: { weightKg: number; customerOrgId?: string; orderId?: string; deliveryPointName?: string }[];
  nowIso: string;
}): { updatedParent: Lot; childLots: Lot[] } {
  const { parentLot, splits, nowIso } = params;
  const sumWeight = splits.reduce((s, sp) => s + sp.weightKg, 0);
  if (splits.length < 2) {
    throw new Error('Phải tách thành ít nhất 2 lô con.');
  }
  if (Math.abs(sumWeight - parentLot.currentKg) > 0.5) {
    throw new Error(
      `Tổng khối lượng các lô con (${sumWeight} kg) phải bằng khối lượng hiện tại của lô gốc (${parentLot.currentKg} kg).`
    );
  }

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const startIdx = parentLot.childLotIds.length;
  const childLots: Lot[] = splits.map((sp, i) => {
    const suffix = letters[startIdx + i] || String(startIdx + i + 1);
    const childId = `${parentLot.id}-${suffix}`;
    return {
      ...parentLot,
      id: childId,
      lotCode: `${parentLot.lotCode}-${suffix}`,
      qrToken: generateUnguessableQrToken(),
      parentLotId: parentLot.id,
      childLotIds: [],
      initialKg: sp.weightKg,
      currentKg: sp.weightKg,
      customerOrgId: sp.customerOrgId ?? parentLot.customerOrgId,
      orderId: sp.orderId ?? parentLot.orderId,
      deliveryPointName: sp.deliveryPointName ?? parentLot.deliveryPointName,
      locationSegments: parentLot.locationSegments.map((seg) => ({
        ...seg,
        toTime: seg.toTime ?? nowIso,
      })),
      createdAt: nowIso,
    };
  });

  const updatedParent: Lot = {
    ...parentLot,
    childLotIds: [...parentLot.childLotIds, ...childLots.map((c) => c.id)],
    currentKg: 0,
  };

  return { updatedParent, childLots };
}
