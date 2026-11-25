import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['NHA_CUNG_CAP', 'DIEU_PHOI_VIEN']);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const {
    allocationId,
    confirmationStatus,
    confirmedKg,
    proposedKg,
    note,
    originDeclaration,
  } = body as {
    allocationId?: string;
    confirmationStatus?: 'DA_XAC_NHAN' | 'DE_XUAT_KHAC';
    confirmedKg?: number;
    proposedKg?: number;
    note?: string;
    originDeclaration?: { growingArea: string; harvestDate: string; certCode?: string };
  };

  if (!allocationId) {
    return NextResponse.json({ error: 'Thiếu allocationId.' }, { status: 400 });
  }

  const result = await mutateDb((db) => {
    const plan = db.supplyPlans.find((p) => p.id === id);
    if (!plan) return { error: 'Không tìm thấy kế hoạch.', status: 404 };

    const alloc = plan.allocations.find((a) => a.id === allocationId);
    if (!alloc) return { error: 'Không tìm thấy phân bổ nhà cung cấp.', status: 404 };

    if (user.role === 'NHA_CUNG_CAP' && alloc.supplierOrgId !== user.orgId) {
      return { error: 'Không thể xác nhận kế hoạch của HTX khác (NFR-07).', status: 403 };
    }

    const before = { ...alloc };
    if (confirmationStatus) {
      alloc.confirmationStatus = confirmationStatus;
    }
    if (confirmedKg !== undefined) alloc.confirmedKg = Number(confirmedKg);
    if (proposedKg !== undefined) alloc.proposedKg = Number(proposedKg);
    if (note !== undefined) alloc.note = note;

    if (originDeclaration?.growingArea && originDeclaration?.harvestDate) {
      alloc.originDeclaration = {
        growingArea: originDeclaration.growingArea,
        harvestDate: originDeclaration.harvestDate,
        certCode: originDeclaration.certCode,
        declaredAt: new Date().toISOString(),
        declaredByUserId: user.id,
      };
    }

    const actualSupply =
      alloc.confirmationStatus === 'DA_XAC_NHAN'
        ? alloc.confirmedKg ?? alloc.requiredRawKg
        : alloc.proposedKg ?? 0;

    if (actualSupply < alloc.requiredRawKg) {
      pushNotification(db, {
        recipientRole: 'DIEU_PHOI_VIEN',
        channel: ['IN_APP', 'ZALO_ZNS'],
        eventType: 'SUPPLIER_SHORTAGE',
        title: `HTX xác nhận thiếu hàng kế hoạch ${plan.code}`,
        message: `Sản lượng xác nhận (${actualSupply} kg) thấp hơn nhu cầu (${alloc.requiredRawKg} kg) — FR-11.`,
        relatedEntityId: plan.id,
      });
    }

    appendAuditLog(db, user, {
      action: 'SUPPLIER_CONFIRM_PLAN',
      entityType: 'SupplyPlan',
      entityId: plan.id,
      summary: `HTX cập nhật xác nhận phân bổ ${allocationId} (${alloc.confirmationStatus})`,
      beforeJson: before,
      afterJson: alloc,
    });

    return { plan, allocation: alloc, status: 200 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ plan: result.plan, allocation: result.allocation });
}
