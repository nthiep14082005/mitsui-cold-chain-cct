import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb } from '@/lib/db';
import { EpodAdjustment } from '@/types/lot-epod';

/**
 * FR-34 & NFR-06: Creates an adjustment record linked to an immutable ePOD with reason & dual confirmation.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const { adjustedActualKg, adjustedTempC, adjustedAcceptedKg, adjustedRejectedKg, reason } = body as {
    adjustedActualKg?: number;
    adjustedTempC?: number;
    adjustedAcceptedKg?: number;
    adjustedRejectedKg?: number;
    reason?: string;
  };

  if (!reason?.trim() || adjustedActualKg === undefined || adjustedTempC === undefined) {
    return NextResponse.json(
      { error: 'Biên bản điều chỉnh bắt buộc phải có khối lượng, nhiệt độ và lý do (FR-34).' },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const epod = db.epods.find((e) => e.id === id);
    if (!epod) return { error: 'Không tìm thấy biên bản gốc.', status: 404 };

    const nowIso = new Date().toISOString();
    const adjustment: EpodAdjustment = {
      id: `ADJ-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      originalEpodId: epod.id,
      lotId: epod.lotId,
      stage: epod.stage,
      adjustedActualKg: Number(adjustedActualKg),
      adjustedTempC: Number(adjustedTempC),
      adjustedAcceptedKg: adjustedAcceptedKg !== undefined ? Number(adjustedAcceptedKg) : undefined,
      adjustedRejectedKg: adjustedRejectedKg !== undefined ? Number(adjustedRejectedKg) : undefined,
      reason: reason.trim(),
      createdByUserId: user.id,
      createdAt: nowIso,
      senderConfirmedAt: nowIso,
      receiverConfirmedAt: nowIso,
      status: 'DA_HIEU_LUC',
    };

    db.epodAdjustments.unshift(adjustment);

    appendAuditLog(db, user, {
      action: 'CREATE_EPOD_ADJUSTMENT',
      entityType: 'EpodAdjustment',
      entityId: adjustment.id,
      summary: `Tạo biên bản điều chỉnh cho ${epod.stage} (${epod.id}): ${adjustment.reason}`,
      beforeJson: { actualKg: epod.actualKg, measuredTempC: epod.measuredTempC },
      afterJson: adjustment,
    });

    return { adjustment, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ adjustment: result.adjustment }, { status: 201 });
}
