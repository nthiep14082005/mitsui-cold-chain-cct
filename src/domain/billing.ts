import { FrameworkContract, PartnerContract } from '@/types/catalog';
import {
  CctDatabase,
  Claim,
  MonthlyStatement,
  StatementLineItem,
} from '@/types/claim-billing-kpi';
import { EpodAdjustment, EpodRecord, Lot } from '@/types/lot-epod';
import { computeEffectiveEpodValues } from './epod';

/**
 * BR-12: Calculates monthly Take-or-Pay service fee for a B2B customer:
 *   Phí tháng = P × max(Q_ck, Q_đạt) - B
 * Pure formula helper so unit tests & UI simulator can verify directly.
 */
export function computeTakeOrPayFormula(params: {
  unitPriceVndPerKg: number;
  committedKg: number;
  acceptedDeliveredKg: number;
  compensationB: number;
}) {
  const { unitPriceVndPerKg, committedKg, acceptedDeliveredKg, compensationB } = params;
  const billableKg = Math.max(committedKg, acceptedDeliveredKg);
  const grossAmountVnd = Math.round(unitPriceVndPerKg * billableKg);
  const netAmountVnd = Math.max(0, grossAmountVnd - Math.round(compensationB));
  return {
    billableKg,
    grossAmountVnd,
    deductionVnd: Math.round(compensationB),
    netAmountVnd,
    isTakeOrPayFloorApplied: acceptedDeliveredKg < committedKg,
  };
}

/**
 * FR-40 & FR-42: Builds Customer Monthly Statement using BR-12 Take-or-Pay.
 */
export function calculateCustomerTakeOrPayStatement(params: {
  contract: FrameworkContract;
  month: string;
  lots: Lot[];
  epods: EpodRecord[];
  adjustments: EpodAdjustment[];
  claims: Claim[];
  existingStatement?: MonthlyStatement;
}): MonthlyStatement {
  const { contract, month, lots, epods, adjustments, claims, existingStatement } = params;
  const customerLotIds = new Set(
    lots.filter((l) => l.customerOrgId === contract.customerOrgId).map((l) => l.id)
  );

  const bg5Epods = epods.filter(
    (e) =>
      e.stage === 'BG5' &&
      e.status === 'HOAN_TAT' &&
      customerLotIds.has(e.lotId) &&
      e.recordedAt.startsWith(month)
  );

  let actualDeliveredKg = 0;
  let acceptedDeliveredKg = 0;
  for (const e of bg5Epods) {
    const eff = computeEffectiveEpodValues(e, adjustments);
    actualDeliveredKg += eff.actualKg;
    acceptedDeliveredKg += eff.acceptedKg ?? eff.actualKg;
  }

  const decidedClaims = claims.filter(
    (c) =>
      c.customerOrgId === contract.customerOrgId &&
      c.status === 'DA_PHAN_QUYET' &&
      c.decision &&
      c.decision.decidedAt.startsWith(month)
  );
  const totalCompensation = decidedClaims.reduce(
    (s, c) => s + (c.decision?.customerCompensationVnd ?? 0),
    0
  );

  const committedKg = contract.committedTonsPerMonth * 1000;
  const calc = computeTakeOrPayFormula({
    unitPriceVndPerKg: contract.unitPriceVndPerKg,
    committedKg,
    acceptedDeliveredKg,
    compensationB: totalCompensation,
  });

  const lineItems: StatementLineItem[] = [
    {
      description: calc.isTakeOrPayFloorApplied
        ? `Cước dịch vụ chuỗi lạnh Take-or-Pay (Cam kết tối thiểu ${(committedKg / 1000).toLocaleString('vi-VN')} tấn; giao đạt ${(acceptedDeliveredKg / 1000).toLocaleString('vi-VN')} tấn)`
        : `Cước dịch vụ chuỗi lạnh (Giao đạt vượt cam kết: ${(acceptedDeliveredKg / 1000).toLocaleString('vi-VN')} tấn)`,
      quantityKg: calc.billableKg,
      rateVnd: contract.unitPriceVndPerKg,
      amountVnd: calc.grossAmountVnd,
      refCode: contract.code,
    },
    ...decidedClaims.map((c) => ({
      description: `Giảm trừ bồi hoàn khiếu nại ${c.code} (${c.decision?.reason ?? ''})`,
      quantityKg: c.decision?.compensatedKg ?? 0,
      rateVnd: -contract.compensationRateVndPerKg,
      amountVnd: -(c.decision?.customerCompensationVnd ?? 0),
      refCode: c.code,
    })),
  ];

  return {
    id: existingStatement?.id || `ST-CUS-${contract.customerOrgId}-${month}`,
    code: existingStatement?.code || `BK-KH-${month.replace('-', '')}-${contract.code}`,
    month,
    statementType: 'KHACH_HANG',
    orgId: contract.customerOrgId,
    committedKg,
    actualDeliveredKg: Math.round(actualDeliveredKg),
    acceptedKg: Math.round(acceptedDeliveredKg),
    billableKg: Math.round(calc.billableKg),
    unitPriceVndPerKg: contract.unitPriceVndPerKg,
    grossAmountVnd: calc.grossAmountVnd,
    deductionOrPenaltyVnd: calc.deductionVnd,
    netAmountVnd: calc.netAmountVnd,
    lineItems,
    status: existingStatement?.status ?? 'CHO_XAC_NHAN',
    confirmedByUserId: existingStatement?.confirmedByUserId,
    confirmedAt: existingStatement?.confirmedAt,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * FR-41 & FR-42: Calculates monthly cost payable to a service partner based on handover records & SLA penalties.
 */
export function calculatePartnerStatement(params: {
  partnerContract: PartnerContract;
  month: string;
  epods: EpodRecord[];
  adjustments: EpodAdjustment[];
  claims: Claim[];
  existingStatement?: MonthlyStatement;
}): MonthlyStatement {
  const { partnerContract, month, epods, adjustments, claims, existingStatement } = params;

  const stageToEpodStage: Record<PartnerContract['stage'], EpodRecord['stage']> = {
    SO_CHE: 'BG2',
    KHO_LANH: 'BG4',
    VAN_TAI_TRUNG_CHUYEN: 'BG3',
    VAN_TAI_GIAO: 'BG5',
  };

  const targetStage = stageToEpodStage[partnerContract.stage];
  const partnerEpods = epods.filter(
    (e) =>
      e.stage === targetStage &&
      e.senderOrgId === partnerContract.partnerOrgId &&
      e.status === 'HOAN_TAT' &&
      e.recordedAt.startsWith(month)
  );

  const billableKg = partnerEpods.reduce(
    (s, e) => s + computeEffectiveEpodValues(e, adjustments).actualKg,
    0
  );

  const grossAmountVnd = Math.round(billableKg * partnerContract.unitCostVndPerKg);
  const partnerPenalties = claims.filter(
    (c) =>
      c.status === 'DA_PHAN_QUYET' &&
      c.decision?.responsibleOrgId === partnerContract.partnerOrgId &&
      c.decision.decidedAt.startsWith(month)
  );
  const totalPenalty = partnerPenalties.reduce(
    (s, c) => s + (c.decision?.partnerPenaltyVnd ?? 0),
    0
  );

  const lineItems: StatementLineItem[] = [
    {
      description: `Phí dịch vụ công đoạn ${partnerContract.stage} theo biên bản ${targetStage}`,
      quantityKg: Math.round(billableKg),
      rateVnd: partnerContract.unitCostVndPerKg,
      amountVnd: grossAmountVnd,
      refCode: partnerContract.code,
    },
    ...partnerPenalties.map((c) => ({
      description: `Trừ phạt SLA theo phán quyết ${c.code}`,
      quantityKg: c.decision?.compensatedKg ?? 0,
      rateVnd: -partnerContract.penaltyRateVndPerKg,
      amountVnd: -(c.decision?.partnerPenaltyVnd ?? 0),
      refCode: c.code,
    })),
  ];

  return {
    id: existingStatement?.id || `ST-PARTNER-${partnerContract.id}-${month}`,
    code: existingStatement?.code || `BK-DT-${month.replace('-', '')}-${partnerContract.code}`,
    month,
    statementType: 'DOI_TAC',
    orgId: partnerContract.partnerOrgId,
    actualDeliveredKg: Math.round(billableKg),
    billableKg: Math.round(billableKg),
    unitPriceVndPerKg: partnerContract.unitCostVndPerKg,
    grossAmountVnd,
    deductionOrPenaltyVnd: Math.round(totalPenalty),
    netAmountVnd: Math.max(0, grossAmountVnd - Math.round(totalPenalty)),
    lineItems,
    status: existingStatement?.status ?? 'CHO_XAC_NHAN',
    confirmedByUserId: existingStatement?.confirmedByUserId,
    confirmedAt: existingStatement?.confirmedAt,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * FR-44 & NFR-15: Monthly financial P&L summary vs 400-ton break-even & 300–400 VND/kg coord cost target.
 */
export function calculateMonthlyFinancialReport(db: CctDatabase, month: string) {
  const monthStatements = db.statements.filter((s) => s.month === month);
  const customerStatements = monthStatements.filter((s) => s.statementType === 'KHACH_HANG');
  const partnerStatements = monthStatements.filter((s) => s.statementType === 'DOI_TAC');

  const totalRevenueVnd = customerStatements.reduce((s, st) => s + st.netAmountVnd, 0);
  const totalPartnerCostVnd = partnerStatements.reduce((s, st) => s + st.netAmountVnd, 0);
  const totalActualBg5Kg = customerStatements.reduce((s, st) => s + (st.actualDeliveredKg || 0), 0);
  const totalBillableKg = customerStatements.reduce((s, st) => s + st.billableKg, 0);

  const contributionMarginVnd = totalRevenueVnd - totalPartnerCostVnd;
  const contributionMarginPerKg =
    totalBillableKg > 0 ? Math.round(contributionMarginVnd / totalBillableKg) : 0;

  const fixedOverheadVnd = db.systemConfig.fixedMonthlyOverheadVnd;
  const operatingProfitVnd = contributionMarginVnd - fixedOverheadVnd;
  const breakEvenKg = db.systemConfig.breakEvenTonsPerMonth * 1000;
  const actualTons = Math.round((totalActualBg5Kg / 1000) * 10) / 10;

  // NFR-15: System & coordination operating portion benchmarked against 300-400 VND/kg
  const coordCostPerKg =
    totalBillableKg > 0 ? Math.round((fixedOverheadVnd * 0.25) / totalBillableKg) : 350;

  return {
    month,
    totalRevenueVnd,
    totalPartnerCostVnd,
    contributionMarginVnd,
    contributionMarginPerKg,
    fixedOverheadVnd,
    operatingProfitVnd,
    actualBg5Kg: totalActualBg5Kg,
    actualTons,
    billableTons: Math.round((totalBillableKg / 1000) * 10) / 10,
    breakEvenTons: db.systemConfig.breakEvenTonsPerMonth,
    breakEvenReached: totalActualBg5Kg >= breakEvenKg,
    coordCostPerKg,
    coordCostTargetMin: db.systemConfig.targetCoordCostMinVndPerKg,
    coordCostTargetMax: db.systemConfig.targetCoordCostMaxVndPerKg,
  };
}
