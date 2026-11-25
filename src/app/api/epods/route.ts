import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, forbidImmutable, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { evaluateChamberSelection } from '@/domain/cold-storage';
import { resolveLotTransitionAfterEpod, validateNewEpod } from '@/domain/epod';
import { getLotInheritedEpods } from '@/domain/lot-lifecycle';
import { EpodRecord, HandoverStage } from '@/types/lot-epod';

interface CreateEpodPayload {
  idempotencyKey?: string;
  stage: HandoverStage;
  lotId: string;
  tripId?: string;
  senderOrgId?: string;
  receiverOrgId?: string;
  actualKg: number;
  measuredTempC: number;
  varianceReason?: string;
  acceptedKg?: number;
  rejectedKg?: number;
  qcRejectionReason?: string;
  chamberId?: string;
  photoDataUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
  recordedAt?: string;
  isOfflineRecorded?: boolean;
  confirmBothParties?: boolean;
  senderConfirm?: boolean;
  receiverConfirm?: boolean;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const lotIdFilter = req.nextUrl.searchParams.get('lotId');
  let epods = db.epods;

  if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    const allowedLotIds = new Set(
      db.lots
        .filter((l) => {
          if (user.role === 'KHACH_HANG') return l.customerOrgId === user.orgId;
          if (user.role === 'NHA_CUNG_CAP') return l.supplierOrgId === user.orgId;
          if (user.role === 'NHAN_VIEN_SO_CHE') return l.packingOrgId === user.orgId;
          if (user.role === 'NHAN_VIEN_KHO') return l.warehouseOrgId === user.orgId;
          return false;
        })
        .map((l) => l.id)
    );
    epods = epods.filter(
      (e) =>
        e.senderOrgId === user.orgId ||
        e.receiverOrgId === user.orgId ||
        allowedLotIds.has(e.lotId)
    );
  }

  if (lotIdFilter) {
    epods = epods.filter((e) => e.lotId === lotIdFilter);
  }

  return NextResponse.json({
    epods: [...epods].sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    ),
    adjustments: db.epodAdjustments,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, [
    'NHA_CUNG_CAP',
    'NHAN_VIEN_SO_CHE',
    'NHAN_VIEN_KHO',
    'TAI_XE',
    'KHACH_HANG',
    'DIEU_PHOI_VIEN',
    'QUAN_LY_QC',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const records: CreateEpodPayload[] = Array.isArray(body.records)
    ? body.records
    : [body as CreateEpodPayload];

  if (!records.length || !records[0]?.lotId || !records[0]?.stage) {
    return NextResponse.json(
      { error: 'Thiếu thông tin lô hàng hoặc điểm bàn giao (BG1–BG5).' },
      { status: 400 }
    );
  }

  const outcome = await mutateDb((db) => {
    const createdOrSynced: EpodRecord[] = [];
    const warnings: string[] = [];

    for (const item of records) {
      const idemKey =
        item.idempotencyKey ||
        `${item.lotId}-${item.stage}-${item.recordedAt ?? new Date().toISOString()}`;

      // NFR-05: Deduplicate offline sync via idempotencyKey
      const existing = db.epods.find((e) => e.idempotencyKey === idemKey);
      if (existing) {
        createdOrSynced.push(existing);
        continue;
      }

      const lotIdx = db.lots.findIndex((l) => l.id === item.lotId);
      if (lotIdx === -1) {
        return { error: `Không tìm thấy lô hàng ${item.lotId}.`, status: 404 };
      }
      const lot = db.lots[lotIdx];
      const tempGroup = db.tempGroups.find((t) => t.id === lot.tempGroupId);
      const effectivePriorEpods = getLotInheritedEpods(lot, db.lots, db.epods);
      const sorting = db.sortingRecords.find((s) => s.id === lot.sortingRecordId);

      // Check chamber selection for BG3 (FR-18 & BR-05)
      if (item.stage === 'BG3' && item.chamberId) {
        const whOrg = db.organizations.find(
          (o) => o.id === (item.receiverOrgId || 'ORG-WH-NECS')
        );
        const chamber = whOrg?.chambers?.find((c) => c.id === item.chamberId);
        if (chamber) {
          const activeInChamber = db.lots.filter(
            (l) => l.chamberId === chamber.id && l.status === 'TRONG_KHO'
          );
          const chEval = evaluateChamberSelection(lot, chamber, activeInChamber);
          if (!chEval.allowed) {
            return { error: chEval.blockReason, status: 400 };
          }
          if (chEval.warning) {
            warnings.push(chEval.warning);
          }
        }
      }

      const check = validateNewEpod({
        stage: item.stage,
        lot,
        effectivePriorEpods,
        adjustments: db.epodAdjustments,
        sortingRecord: sorting,
        tempGroup,
        actualKg: Number(item.actualKg),
        measuredTempC: Number(item.measuredTempC),
        varianceReason: item.varianceReason,
        acceptedKg: item.acceptedKg !== undefined ? Number(item.acceptedKg) : undefined,
        rejectedKg: item.rejectedKg !== undefined ? Number(item.rejectedKg) : undefined,
        qcRejectionReason: item.qcRejectionReason,
        config: db.systemConfig,
      });

      if (!check.valid) {
        return { error: check.error, status: 400 };
      }

      const nowIso = new Date().toISOString();
      const recordedAt = item.recordedAt || nowIso;

      // Resolve default sender/receiver orgs by stage if omitted
      const defaultSender =
        item.stage === 'BG1'
          ? lot.supplierOrgId
          : item.stage === 'BG2'
            ? lot.packingOrgId
            : item.stage === 'BG3'
              ? lot.currentCustodianOrgId
              : item.stage === 'BG4'
                ? lot.warehouseOrgId || 'ORG-WH-NECS'
                : lot.currentCustodianOrgId;

      const defaultReceiver =
        item.stage === 'BG1'
          ? lot.packingOrgId
          : item.stage === 'BG2'
            ? 'ORG-TRANS-ABA'
            : item.stage === 'BG3'
              ? 'ORG-WH-NECS'
              : item.stage === 'BG4'
                ? 'ORG-TRANS-ABA'
                : lot.customerOrgId || 'ORG-CUS-BHX';

      const confirmBoth = item.confirmBothParties ?? true;
      const senderConfirmedAt =
        confirmBoth || item.senderConfirm ? recordedAt : undefined;
      const receiverConfirmedAt =
        confirmBoth || item.receiverConfirm ? recordedAt : undefined;
      const isComplete = Boolean(senderConfirmedAt && receiverConfirmedAt);

      const epod: EpodRecord = {
        id: `EPOD-${lot.id}-${item.stage}-${crypto.randomBytes(2).toString('hex')}`,
        idempotencyKey: idemKey,
        stage: item.stage,
        lotId: lot.id,
        tripId: item.tripId,
        senderOrgId: item.senderOrgId || defaultSender,
        receiverOrgId: item.receiverOrgId || defaultReceiver,
        senderUserId: user.id,
        receiverUserId: isComplete ? user.id : undefined,
        actualKg: Number(item.actualKg),
        prevReferenceKg: check.prevReferenceKg,
        variancePct: check.variancePct,
        varianceReason: item.varianceReason?.trim(),
        measuredTempC: Number(item.measuredTempC),
        tempOutOfRange: check.tempOutOfRange,
        acceptedKg: item.acceptedKg !== undefined ? Number(item.acceptedKg) : undefined,
        rejectedKg: item.rejectedKg !== undefined ? Number(item.rejectedKg) : undefined,
        qcRejectionReason: item.qcRejectionReason?.trim(),
        chamberId: item.chamberId,
        photoDataUrl: item.photoDataUrl,
        gpsLat: item.gpsLat,
        gpsLng: item.gpsLng,
        recordedAt,
        syncedAt: nowIso,
        senderConfirmedAt,
        receiverConfirmedAt,
        isOfflineRecorded: Boolean(item.isOfflineRecorded),
        status: isComplete ? 'HOAN_TAT' : 'CHO_XAC_NHAN_HAI_BEN',
      };

      db.epods.unshift(epod);
      createdOrSynced.push(epod);

      // Transition lot custody & update location segments ONLY if both confirmed (BR-08)
      if (isComplete) {
        const updates = resolveLotTransitionAfterEpod(lot, epod, db.systemConfig);
        Object.assign(lot, updates);

        // Close active segment and attach new location segment for continuous temperature mapping
        const activeSeg = [...lot.locationSegments].reverse().find((s) => !s.toTime);
        if (activeSeg) activeSeg.toTime = recordedAt;

        if (epod.stage === 'BG2') {
          const trip = db.trips.find((t) => t.id === epod.tripId);
          const vehicle = db.vehicles.find((v) => v.id === trip?.vehicleId) ?? db.vehicles[0];
          lot.locationSegments.push({
            stage: 'XE_TRUNG_CHUYEN',
            loggerId: vehicle?.compartments[0]?.loggerId || 'LOG-XE-88120',
            locationLabel: `Xe trung chuyển ${vehicle?.plateNumber ?? ''}`,
            custodianOrgId: epod.receiverOrgId,
            fromTime: recordedAt,
          });
        } else if (epod.stage === 'BG3') {
          const whOrg = db.organizations.find((o) => o.id === epod.receiverOrgId);
          const ch =
            whOrg?.chambers?.find((c) => c.id === epod.chamberId) ??
            whOrg?.chambers?.find((c) => c.tempGroupId === lot.tempGroupId) ??
            whOrg?.chambers?.[0];
          if (ch) {
            lot.chamberId = ch.id;
            lot.locationSegments.push({
              stage: 'BUONG_KHO',
              loggerId: ch.loggerId,
              locationLabel: `${whOrg?.code ?? 'Kho'} ${ch.name}`,
              custodianOrgId: epod.receiverOrgId,
              fromTime: recordedAt,
            });
          }
        } else if (epod.stage === 'BG4') {
          const trip = db.trips.find((t) => t.id === epod.tripId);
          const vehicle = db.vehicles.find((v) => v.id === trip?.vehicleId) ?? db.vehicles[1];
          lot.locationSegments.push({
            stage: 'XE_GIAO',
            loggerId: vehicle?.compartments[0]?.loggerId || 'LOG-XE-99245-1',
            locationLabel: `Xe giao ${vehicle?.plateNumber ?? ''}`,
            custodianOrgId: epod.receiverOrgId,
            fromTime: recordedAt,
          });
        }
      }

      if (check.exceedsTolerance || check.tempOutOfRange) {
        pushNotification(db, {
          recipientRole: 'DIEU_PHOI_VIEN',
          channel: ['IN_APP', 'ZALO_ZNS'],
          eventType: 'EPOD_ANOMALY',
          title: `Bất thường tại ${epod.stage} lô ${lot.lotCode}`,
          message: `Chênh lệch ${epod.variancePct ?? 0}%, nhiệt độ ${epod.measuredTempC}°C. Lý do: ${epod.varianceReason}`,
          relatedEntityId: epod.id,
        });
      }

      appendAuditLog(db, user, {
        action: item.isOfflineRecorded ? 'SYNC_OFFLINE_EPOD' : 'CREATE_EPOD',
        entityType: 'EpodRecord',
        entityId: epod.id,
        summary: `Ghi biên bản ${epod.stage} lô ${lot.lotCode}: ${epod.actualKg} kg, ${epod.measuredTempC}°C (${epod.status})`,
        afterJson: epod,
      });
    }

    return { epods: createdOrSynced, warnings, status: 201 };
  });

  if ('error' in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json(
    { epods: outcome.epods, warnings: outcome.warnings },
    { status: outcome.status }
  );
}

export async function PUT() {
  return forbidImmutable();
}

export async function DELETE() {
  return forbidImmutable();
}
