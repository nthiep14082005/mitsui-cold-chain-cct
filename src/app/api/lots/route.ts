import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';
import { generateNextLotCode, generateUnguessableQrToken } from '@/domain/lot-lifecycle';
import { getFefoSortedLots } from '@/domain/cold-storage';
import { Lot, SortingRecord } from '@/types/lot-epod';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  let lots = db.lots;
  // NFR-07: Isolate lots by organization
  if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    lots = lots.filter((l) => {
      if (user.role === 'KHACH_HANG') return l.customerOrgId === user.orgId;
      if (user.role === 'NHA_CUNG_CAP') return l.supplierOrgId === user.orgId;
      if (user.role === 'NHAN_VIEN_SO_CHE') return l.packingOrgId === user.orgId;
      if (user.role === 'NHAN_VIEN_KHO') {
        return l.warehouseOrgId === user.orgId || l.status === 'DANG_TRUNG_CHUYEN';
      }
      if (user.role === 'TAI_XE') {
        return db.trips.some(
          (t) =>
            t.transportOrgId === user.orgId &&
            t.assignments.some((a) => a.lotId === l.id)
        );
      }
      return false;
    });
  }

  const nowIso = new Date().toISOString();
  const fefo = getFefoSortedLots(lots, db.tempGroups, nowIso, db.systemConfig.storageWarningPct);

  return NextResponse.json({
    lots,
    sortingRecords:
      user.role === 'NHAN_VIEN_SO_CHE'
        ? db.sortingRecords.filter((s) => s.packingOrgId === user.orgId)
        : hasOrgAccess(user, [], { allowSystemAdmin: true })
          ? db.sortingRecords
          : [],
    fefoQueue: fefo.map((f) => ({ lotId: f.lot.id, ...f.shelfLife })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, [
    'NHAN_VIEN_SO_CHE',
    'DIEU_PHOI_VIEN',
    'QUAN_LY_QC',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const {
    supplierOrgId,
    packingOrgId,
    productId,
    customerOrgId,
    orderId,
    deliveryPointName,
    growingArea,
    harvestDate,
    certCode,
    rawInputKg,
    acceptedKg,
    rejectedKg,
    rejectionReason,
  } = body as {
    supplierOrgId?: string;
    packingOrgId?: string;
    productId?: string;
    customerOrgId?: string;
    orderId?: string;
    deliveryPointName?: string;
    growingArea?: string;
    harvestDate?: string;
    certCode?: string;
    rawInputKg?: number;
    acceptedKg?: number;
    rejectedKg?: number;
    rejectionReason?: string;
  };

  const effectivePackingOrgId =
    user.role === 'NHAN_VIEN_SO_CHE' ? user.orgId : packingOrgId || 'ORG-PACK-MT';

  if (!supplierOrgId || !productId || !rawInputKg || !acceptedKg || acceptedKg <= 0) {
    return NextResponse.json(
      { error: 'Thiếu thông tin nhà cung cấp, mặt hàng hoặc khối lượng phân loại đạt.' },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const product = db.products.find((p) => p.id === productId);
    if (!product) return { error: 'Mặt hàng không tồn tại.', status: 404 };
    const packingOrg = db.organizations.find((o) => o.id === effectivePackingOrgId);
    if (!packingOrg) return { error: 'Cơ sở sơ chế không tồn tại.', status: 404 };

    const nowIso = new Date().toISOString();
    const packingDate = nowIso.slice(0, 10);
    const lotCode = generateNextLotCode(packingOrg.code, packingDate, db.lots);
    const lotId = `LOT-${Date.now().toString().slice(-6)}`;
    const sortId = `SORT-${Date.now().toString().slice(-6)}`;

    const sortingRecord: SortingRecord = {
      id: sortId,
      packingOrgId: effectivePackingOrgId,
      supplierOrgId,
      productId,
      rawInputKg: Number(rawInputKg),
      acceptedKg: Number(acceptedKg),
      rejectedKg: Number(rejectedKg ?? Math.max(0, Number(rawInputKg) - Number(acceptedKg))),
      rejectionReason: rejectionReason?.trim() || 'Không đạt quy cách phân loại',
      sortedAt: nowIso,
      sortedByUserId: user.id,
    };

    const lot: Lot = {
      id: lotId,
      lotCode,
      qrToken: generateUnguessableQrToken(),
      productId,
      tempGroupId: product.tempGroupId,
      supplierOrgId,
      packingOrgId: effectivePackingOrgId,
      customerOrgId,
      orderId,
      deliveryPointName,
      growingArea: growingArea?.trim() || 'ĐBSCL',
      harvestDate: harvestDate || packingDate,
      packingDate,
      certCode: certCode?.trim() || undefined,
      initialKg: Number(acceptedKg),
      currentKg: Number(acceptedKg),
      status: 'DA_TAO',
      currentCustodianOrgId: effectivePackingOrgId,
      childLotIds: [],
      sortingRecordId: sortId,
      hasTempAlert: false,
      hasDataGap: false,
      locationSegments: [],
      createdAt: nowIso,
    };

    db.sortingRecords.unshift(sortingRecord);
    db.lots.unshift(lot);

    if (orderId) {
      const ord = db.dailyOrders.find((o) => o.id === orderId);
      if (ord) {
        ord.fulfilledLotIds.push(lot.id);
        if (ord.status === 'DA_XAC_NHAN') ord.status = 'DANG_THUC_HIEN';
      }
    }

    appendAuditLog(db, user, {
      action: 'CREATE_LOT_AND_SORTING',
      entityType: 'Lot',
      entityId: lot.id,
      summary: `Tạo lô ${lot.lotCode} (${acceptedKg} kg đạt, ${sortingRecord.rejectedKg} kg loại)`,
      afterJson: { lot, sortingRecord },
    });

    return { lot, sortingRecord, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(
    { lot: result.lot, sortingRecord: result.sortingRecord },
    { status: 201 }
  );
}
