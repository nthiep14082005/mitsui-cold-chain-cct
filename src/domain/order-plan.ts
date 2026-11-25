import { FrameworkContract, Product } from '@/types/catalog';
import { Organization } from '@/types/common';
import { EpodAdjustment, EpodRecord, Lot } from '@/types/lot-epod';
import { DailyOrder, DailyOrderItem, SupplierAllocation, SupplyPlan } from '@/types/order-plan';
import { computeEffectiveEpodValues } from './epod';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Parses a YYYY-MM-DD delivery date and returns the cutoff timestamp in UTC ms
 * corresponding to (D-1) at cutoffHour:cutoffMinute in Asia/Ho_Chi_Minh (UTC+7) — BR-01.
 */
export function getCutoffTimestampMs(
  deliveryDate: string,
  cutoffHour: number,
  cutoffMinute: number
): number {
  const [y, m, d] = deliveryDate.split('-').map(Number);
  // Day D 00:00:00 in VN = Date.UTC(y, m-1, d, 0, 0, 0) - VN_OFFSET_MS
  const deliveryMidnightUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - VN_OFFSET_MS;
  const dMinus1MidnightUtcMs = deliveryMidnightUtcMs - 24 * 60 * 60 * 1000;
  return dMinus1MidnightUtcMs + (cutoffHour * 60 + cutoffMinute) * 60 * 1000;
}

/**
 * BR-01 & BR-02: Orders submitted at or after 14:00 on D-1 are marked as ad-hoc ("PHAT_SINH").
 */
export function isAfterCutoff(
  deliveryDate: string,
  submittedAtIso: string,
  cutoffHour: number,
  cutoffMinute: number
): boolean {
  const submittedMs = new Date(submittedAtIso).getTime();
  const cutoffMs = getCutoffTimestampMs(deliveryDate, cutoffHour, cutoffMinute);
  return submittedMs >= cutoffMs;
}

/**
 * FR-06: Validates that all ordered items belong to the customer's active framework contract.
 */
export function validateOrderItemsAgainstContract(
  items: DailyOrderItem[],
  contract: FrameworkContract | undefined,
  products: Product[]
): { valid: boolean; error?: string } {
  if (!contract || contract.status !== 'ACTIVE') {
    return { valid: false, error: 'Khách hàng chưa có hợp đồng khung còn hiệu lực.' };
  }
  if (!items.length) {
    return { valid: false, error: 'Đơn hàng phải có ít nhất một mặt hàng.' };
  }
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const item of items) {
    if (!item.requestedKg || item.requestedKg <= 0) {
      return { valid: false, error: 'Khối lượng đặt phải lớn hơn 0 kg.' };
    }
    if (!contract.allowedProductIds.includes(item.productId)) {
      const pName = productMap.get(item.productId)?.name || item.productId;
      return {
        valid: false,
        error: `Mặt hàng "${pName}" không nằm trong hợp đồng khung ${contract.code} (FR-06).`,
      };
    }
  }
  return { valid: true };
}

/**
 * FR-09 & FR-10: Aggregates daily orders by product & temperature group, adds product shrinkage buffer,
 * and distributes required raw harvest quantities across suppliers.
 */
export function aggregateOrdersToSupplyPlan(params: {
  planDate: string;
  orders: DailyOrder[];
  products: Product[];
  suppliers: Organization[];
  existingPlanId?: string;
}): SupplyPlan {
  const { planDate, orders, products, suppliers, existingPlanId } = params;
  const activeOrders = orders.filter(
    (o) =>
      o.deliveryDate === planDate &&
      (o.status === 'DA_NHAN' || o.status === 'DA_XAC_NHAN' || o.status === 'DANG_THUC_HIEN')
  );

  const productMap = new Map(products.map((p) => [p.id, p]));
  const productTotals = new Map<string, number>();

  for (const order of activeOrders) {
    for (const item of order.items) {
      const qty = item.confirmedKg > 0 ? item.confirmedKg : item.requestedKg;
      productTotals.set(item.productId, (productTotals.get(item.productId) ?? 0) + qty);
    }
  }

  const storageDemandByTempGroup: Record<string, number> = {};
  const allocations: SupplierAllocation[] = [];
  const activeSuppliers = suppliers.filter((s) => s.type === 'NHA_CUNG_CAP');

  let idx = 0;
  for (const [productId, netOrderKg] of productTotals.entries()) {
    const prod = productMap.get(productId);
    if (!prod) continue;
    const bufferPct = prod.shrinkageBufferPct;
    const requiredRawKg = Math.ceil(netOrderKg * (1 + bufferPct / 100));
    storageDemandByTempGroup[prod.tempGroupId] =
      (storageDemandByTempGroup[prod.tempGroupId] ?? 0) + netOrderKg;

    // Distribute between primary and secondary suppliers if multiple exist
    const supplier =
      activeSuppliers[idx % Math.max(1, activeSuppliers.length)] ?? activeSuppliers[0];
    if (supplier) {
      allocations.push({
        id: `ALLOC-${planDate.replace(/-/g, '')}-${++idx}`,
        supplierOrgId: supplier.id,
        productId,
        netOrderKg,
        bufferPct,
        requiredRawKg,
        confirmationStatus: 'CHO_XAC_NHAN',
      });
    }
  }

  const totalKg = Array.from(productTotals.values()).reduce((a, b) => a + b, 0);
  const plannedTripCount = Math.max(1, Math.ceil(totalKg / 4000));

  return {
    id: existingPlanId || `PLAN-${planDate.replace(/-/g, '')}`,
    code: `KH-${planDate.replace(/-/g, '')}`,
    planDate,
    status: 'NHAP',
    createdAt: new Date().toISOString(),
    orderIds: activeOrders.map((o) => o.id),
    allocations,
    storageDemandByTempGroup,
    plannedTripCount,
  };
}

/**
 * FR-08: Calculates customer monthly cumulative delivered & ordered volume vs Take-or-Pay commitment.
 */
export function calculateCustomerMonthlyProgress(params: {
  customerOrgId: string;
  month: string;
  orders: DailyOrder[];
  lots: Lot[];
  epods: EpodRecord[];
  adjustments: EpodAdjustment[];
  contract?: FrameworkContract;
}) {
  const { customerOrgId, month, orders, lots, epods, adjustments, contract } = params;
  const committedKg = (contract?.committedTonsPerMonth ?? 0) * 1000;

  const monthOrders = orders.filter(
    (o) =>
      o.customerOrgId === customerOrgId &&
      o.deliveryDate.startsWith(month) &&
      o.status !== 'TU_CHOI' &&
      o.status !== 'PHAT_SINH'
  );
  const orderedKg = monthOrders.reduce(
    (sum, o) => sum + o.items.reduce((s, it) => s + (it.confirmedKg || it.requestedKg), 0),
    0
  );

  const customerLotIds = new Set(
    lots.filter((l) => l.customerOrgId === customerOrgId).map((l) => l.id)
  );
  const deliveredAcceptedKg = epods
    .filter(
      (e) =>
        e.stage === 'BG5' &&
        e.status === 'HOAN_TAT' &&
        customerLotIds.has(e.lotId) &&
        e.recordedAt.startsWith(month)
    )
    .reduce((sum, e) => {
      const eff = computeEffectiveEpodValues(e, adjustments);
      return sum + (eff.acceptedKg ?? eff.actualKg);
    }, 0);

  const progressPct = committedKg > 0 ? Math.round((deliveredAcceptedKg / committedKg) * 1000) / 10 : 0;
  return {
    committedKg,
    orderedKg,
    deliveredAcceptedKg,
    progressPct,
    remainingToCommitKg: Math.max(0, committedKg - deliveredAcceptedKg),
  };
}
