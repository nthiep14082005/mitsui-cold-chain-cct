import { CctDatabase, SuspectedStageCode } from '@/types/claim-billing-kpi';
import { EpodRecord, Lot } from '@/types/lot-epod';
import { computeEffectiveEpodValues } from './epod';
import { getLotInheritedEpods } from './lot-lifecycle';
import { evaluateLotTemperatureCompliance } from './temperature';

export interface SegmentWeightCheck {
  fromLabel: string;
  toLabel: string;
  fromKg: number;
  toKg: number;
  lossPct: number;
  custodianOrgId: string;
  exceedsTolerance: boolean;
}

export interface LotDossier {
  lot: Lot;
  epods: Array<EpodRecord & { effective: ReturnType<typeof computeEffectiveEpodValues> }>;
  tempCompliance: ReturnType<typeof evaluateLotTemperatureCompliance>;
  weightChecks: SegmentWeightCheck[];
  suggestion: {
    suggestedOrgId?: string;
    suggestedStage: string;
    ruleCode: SuspectedStageCode;
    detail: string;
  };
}

/**
 * BR-11: Checks whether customer can open a claim for a lot (either BG5 rejectedKg > 0 or within 24h after BG5).
 */
export function isWithinClaimWindow(
  lot: Lot,
  nowIso: string,
  claimWindowHours: number,
  bg5Epod?: EpodRecord
): boolean {
  if (!lot.deliveredAt) return false;
  if (lot.status === 'DONG') return false;
  if (bg5Epod && (bg5Epod.rejectedKg ?? 0) > 0) return true;
  const deliveredMs = new Date(lot.deliveredAt).getTime();
  const endMs = lot.claimWindowEndsAt
    ? new Date(lot.claimWindowEndsAt).getTime()
    : deliveredMs + claimWindowHours * 60 * 60 * 1000;
  return new Date(nowIso).getTime() <= endMs;
}

/**
 * FR-37 & BR-10: Builds full Lot Dossier (5 ePODs, continuous temp curve, alerts, segment weight loss)
 * and runs the exact BR-10 priority algorithm:
 *   (a) Measured temp out of range at a handover point -> blame sender at that BG point
 *   (b) Stage with temp excursion alert or signal/data gap -> blame custodian holding lot during that stage
 *   (c) Weight loss exceeding tolerance (2%) between two consecutive BGs -> blame custodian between those points
 *   (d) No abnormal stage -> suggest "Nguồn hàng hoặc sau bàn giao"
 */
export function buildLotDossierAndSuggestFault(lot: Lot, db: CctDatabase): LotDossier {
  const orgMap = new Map(db.organizations.map((o) => [o.id, o]));
  const tempGroup = db.tempGroups.find((t) => t.id === lot.tempGroupId);
  const rawEpods = getLotInheritedEpods(lot, db.lots, db.epods);
  const epods = rawEpods.map((e) => ({
    ...e,
    effective: computeEffectiveEpodValues(e, db.epodAdjustments),
  }));

  const tempCompliance = evaluateLotTemperatureCompliance({
    lot,
    allLots: db.lots,
    allReadings: db.tempReadings,
    tempGroup,
    config: db.systemConfig,
    existingAlerts: db.tempAlerts,
  });

  // Build consecutive weight checks
  const weightChecks: SegmentWeightCheck[] = [];
  const sorting = db.sortingRecords.find((s) => s.id === lot.sortingRecordId);
  const epodByStage = new Map(epods.map((e) => [e.stage, e]));

  const bg2 = epodByStage.get('BG2');
  if (sorting && bg2) {
    const fromKg = lot.parentLotId ? lot.initialKg : sorting.acceptedKg;
    const toKg = bg2.effective.actualKg;
    const lossPct = fromKg > 0 ? Math.round(((fromKg - toKg) / fromKg) * 10000) / 100 : 0;
    weightChecks.push({
      fromLabel: 'Sau phân loại (Phòng mát)',
      toLabel: 'BG2 (Cơ sở sơ chế → Xe trung chuyển)',
      fromKg,
      toKg,
      lossPct,
      custodianOrgId: bg2.senderOrgId,
      exceedsTolerance: lossPct > db.systemConfig.weightTolerancePct,
    });
  }

  const pairs: Array<[EpodRecord['stage'], EpodRecord['stage'], string]> = [
    ['BG2', 'BG3', 'Chặng Xe trung chuyển (BG2 → BG3)'],
    ['BG3', 'BG4', 'Chặng Kho lạnh (BG3 → BG4)'],
    ['BG4', 'BG5', 'Chặng Xe giao (BG4 → BG5)'],
  ];

  for (const [s1, s2, label] of pairs) {
    const e1 = epodByStage.get(s1);
    const e2 = epodByStage.get(s2);
    if (e1 && e2) {
      const fromKg = e1.effective.actualKg;
      const toKg = e2.effective.actualKg;
      const lossPct = fromKg > 0 ? Math.round(((fromKg - toKg) / fromKg) * 10000) / 100 : 0;
      weightChecks.push({
        fromLabel: s1,
        toLabel: label,
        fromKg,
        toKg,
        lossPct,
        custodianOrgId: e2.senderOrgId,
        exceedsTolerance: lossPct > db.systemConfig.weightTolerancePct,
      });
    }
  }

  // Rule (a): Temperature measured at any handover point out of range -> blame senderOrgId at that point
  if (tempGroup) {
    for (const ep of epods) {
      const t = ep.effective.measuredTempC;
      if (t < tempGroup.minTempC || t > tempGroup.maxTempC) {
        const orgName = orgMap.get(ep.senderOrgId)?.name ?? ep.senderOrgId;
        return {
          lot,
          epods,
          tempCompliance,
          weightChecks,
          suggestion: {
            suggestedOrgId: ep.senderOrgId,
            suggestedStage: `Điểm bàn giao ${ep.stage} (${orgName})`,
            ruleCode: 'BG_TEMP_OUT_OF_RANGE',
            detail: `BR-10(a): Nhiệt độ đo tại ${ep.stage} là ${t}°C, ngoài dải ${tempGroup.minTempC}–${tempGroup.maxTempC}°C. Đề xuất quy trách nhiệm cho bên giao: ${orgName}.`,
          },
        };
      }
    }
  }

  // Rule (b): Stage with temperature alert or data gap -> blame custodian holding lot in that stage
  const lotAlerts = db.tempAlerts.filter((a) => a.lotId === lot.id);
  const firstAlert = lotAlerts[0] ?? tempCompliance.detectedAlerts[0];
  if (firstAlert) {
    const orgName = orgMap.get(firstAlert.custodianOrgId)?.name ?? firstAlert.custodianOrgId;
    const reasonKind =
      firstAlert.alertType === 'MAT_TIN_HIEU'
        ? `mất tín hiệu logger ${firstAlert.durationMinutes} phút`
        : `vượt ngưỡng nhiệt (${firstAlert.peakTempC ?? '?'}°C trong ${firstAlert.durationMinutes} phút)`;
    return {
      lot,
      epods,
      tempCompliance,
      weightChecks,
      suggestion: {
        suggestedOrgId: firstAlert.custodianOrgId,
        suggestedStage: `${firstAlert.stage} (${orgName})`,
        ruleCode: 'STAGE_TEMP_OR_SIGNAL_ALERT',
        detail: `BR-10(b): Chặng "${firstAlert.stage}" ghi nhận ${reasonKind}. Đề xuất quy trách nhiệm cho bên giữ hàng: ${orgName}.`,
      },
    };
  }

  // Rule (c): Weight loss > tolerance between two consecutive BGs -> blame custodian between those points
  const lossViolation = weightChecks.find((w) => w.exceedsTolerance);
  if (lossViolation) {
    const orgName = orgMap.get(lossViolation.custodianOrgId)?.name ?? lossViolation.custodianOrgId;
    return {
      lot,
      epods,
      tempCompliance,
      weightChecks,
      suggestion: {
        suggestedOrgId: lossViolation.custodianOrgId,
        suggestedStage: `${lossViolation.toLabel} (${orgName})`,
        ruleCode: 'STAGE_WEIGHT_LOSS',
        detail: `BR-10(c): Hụt khối lượng ${lossViolation.lossPct}% (từ ${lossViolation.fromKg} kg còn ${lossViolation.toKg} kg) vượt dung sai ${db.systemConfig.weightTolerancePct}% tại ${lossViolation.toLabel}. Đề xuất quy cho: ${orgName}.`,
      },
    };
  }

  // Rule (d): No abnormal stage detected
  return {
    lot,
    epods,
    tempCompliance,
    weightChecks,
    suggestion: {
      suggestedStage: 'Nguồn hàng hoặc sau bàn giao',
      ruleCode: 'NGUON_HANG_HOAC_SAU_BAN_GIAO',
      detail:
        'BR-10(d): Không phát hiện chặng nào vượt ngưỡng nhiệt, mất tín hiệu hay hụt khối lượng vượt dung sai. Đề xuất nguyên nhân từ nguồn hàng hoặc sau bàn giao.',
    },
  };
}
