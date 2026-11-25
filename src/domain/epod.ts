import { TempGroup } from '@/types/catalog';
import { SystemConfig } from '@/types/common';
import {
  EpodAdjustment,
  EpodRecord,
  HandoverStage,
  Lot,
  LotStatus,
  SortingRecord,
} from '@/types/lot-epod';

const STAGE_ORDER: HandoverStage[] = ['BG1', 'BG2', 'BG3', 'BG4', 'BG5'];

export interface EffectiveEpodValues {
  actualKg: number;
  measuredTempC: number;
  acceptedKg?: number;
  rejectedKg?: number;
  adjustmentCount: number;
  latestAdjustmentReason?: string;
}

/**
 * NFR-06 & FR-34: Original EpodRecord is immutable. Any effective reading uses the latest confirmed EpodAdjustment.
 */
export function computeEffectiveEpodValues(
  epod: EpodRecord,
  adjustments: EpodAdjustment[]
): EffectiveEpodValues {
  const related = adjustments
    .filter((a) => a.originalEpodId === epod.id && a.status === 'DA_HIEU_LUC')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (!related.length) {
    return {
      actualKg: epod.actualKg,
      measuredTempC: epod.measuredTempC,
      acceptedKg: epod.acceptedKg,
      rejectedKg: epod.rejectedKg,
      adjustmentCount: 0,
    };
  }
  const last = related[related.length - 1];
  return {
    actualKg: last.adjustedActualKg,
    measuredTempC: last.adjustedTempC,
    acceptedKg: last.adjustedAcceptedKg ?? epod.acceptedKg,
    rejectedKg: last.adjustedRejectedKg ?? epod.rejectedKg,
    adjustmentCount: related.length,
    latestAdjustmentReason: last.reason,
  };
}

/**
 * BR-08, BR-09, FR-31..FR-35: Validates new handover ePOD before saving.
 */
export function validateNewEpod(params: {
  stage: HandoverStage;
  lot: Lot;
  effectivePriorEpods: EpodRecord[];
  adjustments: EpodAdjustment[];
  sortingRecord?: SortingRecord;
  tempGroup?: TempGroup;
  actualKg: number;
  measuredTempC: number;
  varianceReason?: string;
  acceptedKg?: number;
  rejectedKg?: number;
  qcRejectionReason?: string;
  config: SystemConfig;
}): {
  valid: boolean;
  error?: string;
  prevReferenceKg?: number;
  variancePct?: number;
  tempOutOfRange: boolean;
  exceedsTolerance: boolean;
} {
  const {
    stage,
    lot,
    effectivePriorEpods,
    adjustments,
    sortingRecord,
    tempGroup,
    actualKg,
    measuredTempC,
    varianceReason,
    acceptedKg,
    rejectedKg,
    qcRejectionReason,
    config,
  } = params;

  if (actualKg <= 0) {
    return {
      valid: false,
      error: 'Khối lượng thực tế phải lớn hơn 0 kg.',
      tempOutOfRange: false,
      exceedsTolerance: false,
    };
  }

  const stageIdx = STAGE_ORDER.indexOf(stage);
  if (stageIdx > 0) {
    const prevStage = STAGE_ORDER[stageIdx - 1];
    const prevDone = effectivePriorEpods.find(
      (e) => e.stage === prevStage && e.status === 'HOAN_TAT'
    );
    if (!prevDone) {
      return {
        valid: false,
        error: `Chưa hoàn tất biên bản ${prevStage} (xác nhận đủ 2 bên theo BR-08) cho lô ${lot.lotCode}.`,
        tempOutOfRange: false,
        exceedsTolerance: false,
      };
    }
  }

  // Reference kg for variance calculation (BR-09):
  // BG1 is raw material before sorting -> no tolerance check against BG1 itself.
  // BG2 compares against SortingRecord.acceptedKg (or lot.initialKg).
  // BG3..BG5 compare against the previous stage's effective actualKg.
  let prevReferenceKg: number | undefined;
  let variancePct: number | undefined;
  let exceedsTolerance = false;

  if (stage === 'BG2') {
    prevReferenceKg = sortingRecord?.acceptedKg ?? lot.initialKg;
  } else if (stageIdx > 1) {
    const prevStage = STAGE_ORDER[stageIdx - 1];
    const prevEpod = effectivePriorEpods.find(
      (e) => e.stage === prevStage && e.status === 'HOAN_TAT'
    );
    if (prevEpod) {
      prevReferenceKg = computeEffectiveEpodValues(prevEpod, adjustments).actualKg;
    }
  }

  if (prevReferenceKg && prevReferenceKg > 0) {
    variancePct = Math.round(((actualKg - prevReferenceKg) / prevReferenceKg) * 10000) / 100;
    exceedsTolerance = Math.abs(variancePct) > config.weightTolerancePct;
  }

  const tempOutOfRange = tempGroup
    ? measuredTempC < tempGroup.minTempC || measuredTempC > tempGroup.maxTempC
    : false;

  if (exceedsTolerance && !varianceReason?.trim()) {
    return {
      valid: false,
      error: `Chênh lệch khối lượng (${variancePct}%) vượt dung sai ${config.weightTolerancePct}% (BR-09). Vui lòng ghi lý do!`,
      prevReferenceKg,
      variancePct,
      tempOutOfRange,
      exceedsTolerance,
    };
  }

  if (tempOutOfRange && !varianceReason?.trim()) {
    return {
      valid: false,
      error: `Nhiệt độ đo (${measuredTempC}°C) nằm ngoài dải ${tempGroup?.minTempC}–${tempGroup?.maxTempC}°C. Vui lòng ghi lý do!`,
      prevReferenceKg,
      variancePct,
      tempOutOfRange,
      exceedsTolerance,
    };
  }

  if (stage === 'BG5') {
    if (acceptedKg === undefined || rejectedKg === undefined) {
      return {
        valid: false,
        error: 'Tại BG5, khách hàng phải nhập khối lượng đạt và không đạt (FR-35).',
        prevReferenceKg,
        variancePct,
        tempOutOfRange,
        exceedsTolerance,
      };
    }
    if (Math.abs(acceptedKg + rejectedKg - actualKg) > 0.5) {
      return {
        valid: false,
        error: `Tổng kg đạt (${acceptedKg}) + không đạt (${rejectedKg}) phải bằng kg thực nhận (${actualKg}).`,
        prevReferenceKg,
        variancePct,
        tempOutOfRange,
        exceedsTolerance,
      };
    }
    if (rejectedKg > 0 && !qcRejectionReason?.trim()) {
      return {
        valid: false,
        error: 'Khi có hàng không đạt tại BG5, khách hàng phải ghi lý do (FR-35).',
        prevReferenceKg,
        variancePct,
        tempOutOfRange,
        exceedsTolerance,
      };
    }
  }

  return {
    valid: true,
    prevReferenceKg,
    variancePct,
    tempOutOfRange,
    exceedsTolerance,
  };
}

/**
 * BR-08: Custody and lot status ONLY change when BOTH sender and receiver have confirmed.
 */
export function resolveLotTransitionAfterEpod(
  lot: Lot,
  epod: EpodRecord,
  config: SystemConfig
): Partial<Lot> {
  if (!epod.senderConfirmedAt || !epod.receiverConfirmedAt || epod.status !== 'HOAN_TAT') {
    return {};
  }

  const stageToStatus: Record<HandoverStage, LotStatus> = {
    BG1: 'DA_TAO',
    BG2: 'DANG_TRUNG_CHUYEN',
    BG3: 'TRONG_KHO',
    BG4: 'DANG_GIAO',
    BG5: 'DA_GIAO',
  };

  const nextStatus = stageToStatus[epod.stage];
  const updates: Partial<Lot> = {
    status: nextStatus,
    currentCustodianOrgId: epod.receiverOrgId,
    currentKg: epod.actualKg,
  };

  if (epod.stage === 'BG3') {
    updates.warehouseOrgId = epod.receiverOrgId;
    updates.chamberId = epod.chamberId;
    updates.storageEnteredAt = epod.receiverConfirmedAt;
  }

  if (epod.stage === 'BG5') {
    updates.deliveredAt = epod.receiverConfirmedAt;
    const windowEnd = new Date(
      new Date(epod.receiverConfirmedAt).getTime() + config.claimWindowHours * 60 * 60 * 1000
    );
    updates.claimWindowEndsAt = windowEnd.toISOString();
  }

  return updates;
}
