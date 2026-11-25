import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb } from '@/lib/db';
import { buildLotDossierAndSuggestFault } from '@/domain/claim';
import { splitLotIntoChildren } from '@/domain/lot-lifecycle';
import { computeStorageShelfLifeStatus } from '@/domain/cold-storage';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;
  const db = await readDb();

  const lot = db.lots.find((l) => l.id === id);
  if (!lot) return NextResponse.json({ error: 'Không tìm thấy lô hàng.' }, { status: 404 });

  // NFR-07: Strict cross-org check
  const allowedOrgs = [
    lot.customerOrgId,
    lot.supplierOrgId,
    lot.packingOrgId,
    lot.warehouseOrgId,
    lot.currentCustodianOrgId,
    ...lot.locationSegments.map((s) => s.custodianOrgId),
  ];
  if (!hasOrgAccess(user, allowedOrgs, { allowSystemAdmin: true })) {
    return forbidCrossOrg();
  }

  const dossier = buildLotDossierAndSuggestFault(lot, db);
  const tempGroup = db.tempGroups.find((t) => t.id === lot.tempGroupId);
  const shelfLife = computeStorageShelfLifeStatus(
    lot,
    tempGroup,
    new Date().toISOString(),
    db.systemConfig.storageWarningPct
  );
  const adjustments = db.epodAdjustments.filter((a) => a.lotId === lot.id);

  return NextResponse.json({
    dossier,
    shelfLife,
    adjustments,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, [
    'NHAN_VIEN_SO_CHE',
    'NHAN_VIEN_KHO',
    'DIEU_PHOI_VIEN',
    'QUAN_LY_QC',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const { action, splits, loggerId } = body as {
    action?: 'ENTER_COOLING' | 'EXIT_COOLING' | 'SPLIT_LOT' | 'WMS_SYNC';
    splits?: Array<{
      weightKg: number;
      customerOrgId?: string;
      orderId?: string;
      deliveryPointName?: string;
    }>;
    loggerId?: string;
  };

  const result = await mutateDb((db) => {
    const idx = db.lots.findIndex((l) => l.id === id);
    if (idx === -1) return { error: 'Không tìm thấy lô hàng.', status: 404 };
    const lot = db.lots[idx];
    const nowIso = new Date().toISOString();

    if (action === 'ENTER_COOLING') {
      if (user.role === 'NHAN_VIEN_SO_CHE' && lot.packingOrgId !== user.orgId) {
        return { error: 'Không có quyền thao tác lô của cơ sở khác.', status: 403 };
      }
      const packingOrg = db.organizations.find((o) => o.id === lot.packingOrgId);
      const effectiveLoggerId = loggerId || packingOrg?.coolingLoggerId || 'LOG-PM-MT01';
      lot.status = 'DANG_LAM_LANH';
      lot.coolingStartedAt = nowIso;
      lot.locationSegments.push({
        stage: 'PHONG_MAT',
        loggerId: effectiveLoggerId,
        locationLabel: `Phòng mát ${packingOrg?.code ?? ''}`,
        custodianOrgId: lot.packingOrgId,
        fromTime: nowIso,
      });
      appendAuditLog(db, user, {
        action: 'ENTER_COOLING_ROOM',
        entityType: 'Lot',
        entityId: lot.id,
        summary: `Đưa lô ${lot.lotCode} vào phòng mát (Logger ${effectiveLoggerId})`,
        afterJson: { status: lot.status, coolingStartedAt: nowIso },
      });
      return { lot, status: 200 };
    }

    if (action === 'EXIT_COOLING') {
      lot.coolingEndedAt = nowIso;
      const seg = [...lot.locationSegments]
        .reverse()
        .find((s) => s.stage === 'PHONG_MAT' && !s.toTime);
      if (seg) seg.toTime = nowIso;
      appendAuditLog(db, user, {
        action: 'EXIT_COOLING_ROOM',
        entityType: 'Lot',
        entityId: lot.id,
        summary: `Hoàn tất làm lạnh lô ${lot.lotCode} tại phòng mát`,
        afterJson: { coolingEndedAt: nowIso },
      });
      return { lot, status: 200 };
    }

    if (action === 'WMS_SYNC') {
      lot.wmsSyncedAt = nowIso;
      appendAuditLog(db, user, {
        action: 'WMS_SYNC_LOT',
        entityType: 'Lot',
        entityId: lot.id,
        summary: `Đồng bộ WMS API cho lô ${lot.lotCode} (FR-21)`,
        afterJson: { wmsSyncedAt: nowIso },
      });
      return { lot, status: 200 };
    }

    if (action === 'SPLIT_LOT') {
      if (!splits || splits.length < 2) {
        return { error: 'Tách lô cần tối thiểu 2 lô con.', status: 400 };
      }
      if (lot.childLotIds.length > 0) {
        return { error: 'Lô này đã được tách trước đó.', status: 400 };
      }
      try {
        const { updatedParent, childLots } = splitLotIntoChildren({
          parentLot: lot,
          splits,
          nowIso,
        });
        db.lots[idx] = updatedParent;
        db.lots.unshift(...childLots);

        appendAuditLog(db, user, {
          action: 'SPLIT_LOT',
          entityType: 'Lot',
          entityId: lot.id,
          summary: `Tách lô ${lot.lotCode} thành ${childLots.map((c) => c.lotCode).join(', ')}`,
          beforeJson: { currentKg: lot.currentKg },
          afterJson: { childLotIds: childLots.map((c) => c.id) },
        });
        return { lot: updatedParent, childLots, status: 200 };
      } catch (e) {
        return { error: (e as Error).message, status: 400 };
      }
    }

    return { error: 'Action không hợp lệ.', status: 400 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
