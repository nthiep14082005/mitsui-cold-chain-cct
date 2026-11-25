import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, forbidImmutable, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { buildLotDossierAndSuggestFault } from '@/domain/claim';
import { calculateCustomerTakeOrPayStatement, calculatePartnerStatement } from '@/domain/billing';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;
  const db = await readDb();

  const claim = db.claims.find((c) => c.id === id);
  if (!claim) return NextResponse.json({ error: 'Không tìm thấy khiếu nại.' }, { status: 404 });

  if (
    !hasOrgAccess(
      user,
      [claim.customerOrgId, claim.systemSuggestedOrgId, claim.decision?.responsibleOrgId],
      { allowSystemAdmin: true }
    )
  ) {
    return forbidCrossOrg();
  }

  const lot = db.lots.find((l) => l.id === claim.lotId);
  return NextResponse.json({
    claim,
    dossier: lot ? buildLotDossierAndSuggestFault(lot, db) : null,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, [
    'QUAN_LY_QC',
    'NHA_CUNG_CAP',
    'NHAN_VIEN_SO_CHE',
    'NHAN_VIEN_KHO',
    'TAI_XE',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const {
    action,
    explanationContent,
    responsiblePartyType,
    responsibleOrgId,
    compensatedKg,
    customerCompensationVnd,
    partnerPenaltyVnd,
    reason,
  } = body as {
    action?: 'PARTNER_EXPLAIN' | 'ADJUDICATE';
    explanationContent?: string;
    responsiblePartyType?: 'DOI_TAC' | 'NGUON_HANG' | 'SAU_BAN_GIAO' | 'MITSUI';
    responsibleOrgId?: string;
    compensatedKg?: number;
    customerCompensationVnd?: number;
    partnerPenaltyVnd?: number;
    reason?: string;
  };

  const result = await mutateDb((db) => {
    const claim = db.claims.find((c) => c.id === id);
    if (!claim) return { error: 'Không tìm thấy khiếu nại.', status: 404 };

    // NFR-06: Finalized QC decisions are immutable!
    if (claim.status === 'DA_PHAN_QUYET' || claim.decision) {
      return {
        error: 'Phán quyết khiếu nại đã chốt là bất biến, không thể sửa hoặc xóa (NFR-06).',
        status: 403,
      };
    }

    const nowIso = new Date().toISOString();

    if (action === 'PARTNER_EXPLAIN') {
      if (
        claim.systemSuggestedOrgId &&
        user.role !== 'QUAN_LY_QC' &&
        user.orgId !== claim.systemSuggestedOrgId
      ) {
        return { error: 'Chỉ đối tác bị đề xuất lỗi mới được gửi giải trình (FR-39).', status: 403 };
      }
      if (!explanationContent?.trim()) {
        return { error: 'Vui lòng nhập nội dung giải trình.', status: 400 };
      }
      claim.partnerExplanation = {
        submittedByUserId: user.id,
        orgId: user.orgId,
        content: explanationContent.trim(),
        submittedAt: nowIso,
      };
      claim.status = 'DA_GIAI_TRINH';

      appendAuditLog(db, user, {
        action: 'PARTNER_EXPLAIN_CLAIM',
        entityType: 'Claim',
        entityId: claim.id,
        summary: `Đối tác gửi giải trình cho khiếu nại ${claim.code}`,
        afterJson: claim.partnerExplanation,
      });

      pushNotification(db, {
        recipientRole: 'QUAN_LY_QC',
        channel: ['IN_APP', 'ZALO_ZNS'],
        eventType: 'CLAIM_EXPLANATION',
        title: `Đối tác đã gửi giải trình ${claim.code}`,
        message: explanationContent.trim(),
        relatedEntityId: claim.id,
      });

      return { claim, status: 200 };
    }

    // ADJUDICATE — only QUAN_LY_QC
    if (user.role !== 'QUAN_LY_QC') {
      return { error: 'Chỉ Quản lý / QC của Mitsui mới có quyền ra phán quyết khiếu nại (FR-38).', status: 403 };
    }
    if (!responsiblePartyType || !reason?.trim()) {
      return { error: 'Phán quyết phải có bên chịu trách nhiệm và lý do (FR-38).', status: 400 };
    }

    const before = { ...claim };
    claim.decision = {
      responsiblePartyType,
      responsibleOrgId: responsiblePartyType === 'DOI_TAC' ? responsibleOrgId : undefined,
      compensatedKg: Number(compensatedKg ?? claim.affectedKg),
      customerCompensationVnd: Number(customerCompensationVnd ?? 0),
      partnerPenaltyVnd: Number(partnerPenaltyVnd ?? 0),
      reason: reason.trim(),
      decidedByUserId: user.id,
      decidedAt: nowIso,
    };
    claim.status = 'DA_PHAN_QUYET';

    // Close lot after adjudication (Section 3.3 step 8)
    const lot = db.lots.find((l) => l.id === claim.lotId);
    if (lot) lot.status = 'DONG';

    // Reflect compensation/penalty immediately on current month statements (FR-42)
    const month = nowIso.slice(0, 7);
    const fc = db.frameworkContracts.find((f) => f.customerOrgId === claim.customerOrgId);
    if (fc) {
      const existingSt = db.statements.find(
        (s) => s.statementType === 'KHACH_HANG' && s.orgId === fc.customerOrgId && s.month === month
      );
      const updatedSt = calculateCustomerTakeOrPayStatement({
        contract: fc,
        month,
        lots: db.lots,
        epods: db.epods,
        adjustments: db.epodAdjustments,
        claims: db.claims,
        existingStatement: existingSt,
      });
      const idx = db.statements.findIndex((s) => s.id === updatedSt.id);
      if (idx >= 0) db.statements[idx] = updatedSt;
      else db.statements.push(updatedSt);
    }

    if (claim.decision.responsibleOrgId) {
      const pcs = db.partnerContracts.filter(
        (p) => p.partnerOrgId === claim.decision?.responsibleOrgId
      );
      for (const pc of pcs) {
        const existingSt = db.statements.find(
          (s) => s.statementType === 'DOI_TAC' && s.orgId === pc.partnerOrgId && s.month === month
        );
        const updatedSt = calculatePartnerStatement({
          partnerContract: pc,
          month,
          epods: db.epods,
          adjustments: db.epodAdjustments,
          claims: db.claims,
          existingStatement: existingSt,
        });
        const idx = db.statements.findIndex((s) => s.id === updatedSt.id);
        if (idx >= 0) db.statements[idx] = updatedSt;
        else db.statements.push(updatedSt);
      }
    }

    appendAuditLog(db, user, {
      action: 'ADJUDICATE_CLAIM',
      entityType: 'Claim',
      entityId: claim.id,
      summary: `Phán quyết khiếu nại ${claim.code}: bồi hoàn ${claim.decision.customerCompensationVnd.toLocaleString('vi-VN')} đ`,
      beforeJson: before,
      afterJson: claim,
    });

    pushNotification(db, {
      recipientOrgId: claim.customerOrgId,
      channel: ['IN_APP', 'ZALO_ZNS', 'SMS'],
      eventType: 'CLAIM_DECIDED',
      title: `Đã có phán quyết khiếu nại ${claim.code}`,
      message: `${claim.decision.reason} Bồi hoàn ${claim.decision.customerCompensationVnd.toLocaleString('vi-VN')} đ vào bảng kê tháng.`,
      relatedEntityId: claim.id,
    });

    if (claim.decision.responsibleOrgId) {
      pushNotification(db, {
        recipientOrgId: claim.decision.responsibleOrgId,
        channel: ['IN_APP', 'ZALO_ZNS', 'SMS'],
        eventType: 'CLAIM_DECIDED',
        title: `Phán quyết SLA khiếu nại ${claim.code}`,
        message: `Trừ phạt SLA ${claim.decision.partnerPenaltyVnd.toLocaleString('vi-VN')} đ theo phán quyết QC.`,
        relatedEntityId: claim.id,
      });
    }

    return { claim, status: 200 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ claim: result.claim });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Phán quyết khiếu nại không thể sửa bằng PUT (NFR-06).');
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  return forbidImmutable('Hồ sơ khiếu nại và phán quyết không bao giờ bị xóa (Section 6.2 & NFR-06).');
}
