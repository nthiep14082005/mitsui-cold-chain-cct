import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { buildLotDossierAndSuggestFault, isWithinClaimWindow } from '@/domain/claim';
import { Claim } from '@/types/claim-billing-kpi';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  let claims = db.claims;
  if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    if (user.role === 'KHACH_HANG') {
      claims = claims.filter((c) => c.customerOrgId === user.orgId);
    } else {
      // Partners only see claims where they are suggested or adjudicated responsible (FR-39)
      claims = claims.filter(
        (c) =>
          c.systemSuggestedOrgId === user.orgId ||
          c.decision?.responsibleOrgId === user.orgId
      );
    }
  }

  const enriched = claims.map((c) => {
    const lot = db.lots.find((l) => l.id === c.lotId);
    return {
      ...c,
      lotCode: lot?.lotCode ?? c.lotId,
      dossier: lot ? buildLotDossierAndSuggestFault(lot, db) : null,
    };
  });

  return NextResponse.json({ claims: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['KHACH_HANG', 'DIEU_PHOI_VIEN', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { lotId, affectedKg, description } = body as {
    lotId?: string;
    affectedKg?: number;
    description?: string;
  };

  if (!lotId || !affectedKg || affectedKg <= 0 || !description?.trim()) {
    return NextResponse.json(
      { error: 'Thiếu mã lô, khối lượng bị ảnh hưởng hoặc mô tả khiếu nại (FR-36).' },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const lot = db.lots.find((l) => l.id === lotId);
    if (!lot) return { error: 'Không tìm thấy lô hàng.', status: 404 };

    if (user.role === 'KHACH_HANG' && lot.customerOrgId !== user.orgId) {
      return { error: 'Không thể gửi khiếu nại cho lô của khách hàng khác (NFR-07).', status: 403 };
    }

    const bg5 = db.epods.find((e) => e.lotId === lot.id && e.stage === 'BG5' && e.status === 'HOAN_TAT');
    if (!bg5) {
      return { error: 'Lô chưa có biên bản giao hàng BG5, chưa thể mở khiếu nại.', status: 400 };
    }

    const nowIso = new Date().toISOString();
    if (!isWithinClaimWindow(lot, nowIso, db.systemConfig.claimWindowHours, bg5)) {
      return {
        error: `Đã quá cửa sổ khiếu nại ${db.systemConfig.claimWindowHours} giờ sau BG5 (BR-11).`,
        status: 400,
      };
    }

    const dossier = buildLotDossierAndSuggestFault(lot, db);
    const deadlineIso = new Date(
      Date.now() + db.systemConfig.partnerExplanationHours * 60 * 60 * 1000
    ).toISOString();

    const claim: Claim = {
      id: `CLM-${Date.now().toString().slice(-6)}`,
      code: `KN-${nowIso.slice(2, 10).replace(/-/g, '')}-${String(db.claims.length + 1).padStart(2, '0')}`,
      lotId: lot.id,
      customerOrgId: lot.customerOrgId || user.orgId,
      affectedKg: Number(affectedKg),
      description: description.trim(),
      createdAt: nowIso,
      status: dossier.suggestion.suggestedOrgId ? 'CHO_GIAI_TRINH' : 'MOI_TAO',
      systemSuggestedOrgId: dossier.suggestion.suggestedOrgId,
      systemSuggestedStage: dossier.suggestion.suggestedStage,
      systemSuggestionRule: dossier.suggestion.ruleCode,
      systemSuggestionDetail: dossier.suggestion.detail,
      explanationDeadlineAt: deadlineIso,
    };

    lot.status = 'CO_KHIEU_NAI';
    db.claims.unshift(claim);

    appendAuditLog(db, user, {
      action: 'CREATE_CLAIM',
      entityType: 'Claim',
      entityId: claim.id,
      summary: `Mở khiếu nại ${claim.code} cho lô ${lot.lotCode} (${affectedKg} kg). Đề xuất: ${claim.systemSuggestedStage}`,
      afterJson: claim,
    });

    pushNotification(db, {
      recipientRole: 'QUAN_LY_QC',
      recipientOrgId: claim.systemSuggestedOrgId,
      channel: ['IN_APP', 'ZALO_ZNS'],
      eventType: 'CLAIM_OPENED',
      title: `Khiếu nại mới ${claim.code} (Lô ${lot.lotCode})`,
      message: `${claim.systemSuggestionDetail} Hạn giải trình 48h.`,
      relatedEntityId: claim.id,
    });

    return { claim, dossier, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ claim: result.claim, dossier: result.dossier }, { status: 201 });
}
