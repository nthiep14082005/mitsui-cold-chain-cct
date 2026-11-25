import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { isAfterCutoff, validateOrderItemsAgainstContract } from '@/domain/order-plan';
import { DailyOrderItem } from '@/types/order-plan';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;
  const db = await readDb();

  const order = db.dailyOrders.find((o) => o.id === id);
  if (!order) return NextResponse.json({ error: 'Không tìm thấy đơn hàng.' }, { status: 404 });

  if (user.role === 'KHACH_HANG' && order.customerOrgId !== user.orgId) {
    return forbidCrossOrg();
  }
  return NextResponse.json({ order });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req, ['KHACH_HANG', 'DIEU_PHOI_VIEN', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;
  const { id } = await context.params;

  const body = await req.json().catch(() => ({}));
  const { action, items, timeSlot, deliveryPointId, rejectionReason } = body as {
    action?: 'EDIT' | 'CONFIRM' | 'REJECT';
    items?: DailyOrderItem[];
    timeSlot?: string;
    deliveryPointId?: string;
    rejectionReason?: string;
  };

  const result = await mutateDb((db) => {
    const idx = db.dailyOrders.findIndex((o) => o.id === id);
    if (idx === -1) return { error: 'Không tìm thấy đơn hàng.', status: 404 };
    const order = db.dailyOrders[idx];

    if (user.role === 'KHACH_HANG' && order.customerOrgId !== user.orgId) {
      return { error: 'Không được phép sửa đơn của khách hàng khác (NFR-07).', status: 403 };
    }

    const before = { ...order };
    const nowIso = new Date().toISOString();

    if (action === 'CONFIRM' || action === 'REJECT') {
      if (user.role !== 'DIEU_PHOI_VIEN' && user.role !== 'QUAN_LY_QC') {
        return { error: 'Chỉ Điều phối viên mới được xác nhận hoặc từ chối đơn.', status: 403 };
      }
      if (action === 'REJECT') {
        if (!rejectionReason?.trim()) {
          return { error: 'Từ chối đơn phát sinh bắt buộc phải kèm lý do (FR-07).', status: 400 };
        }
        order.status = 'TU_CHOI';
        order.rejectionReason = rejectionReason.trim();
        order.updatedAt = nowIso;
      } else {
        order.status = 'DA_XAC_NHAN';
        order.confirmedByUserId = user.id;
        order.items = order.items.map((it) => ({
          ...it,
          confirmedKg: it.confirmedKg > 0 ? it.confirmedKg : it.requestedKg,
        }));
        order.updatedAt = nowIso;
      }

      appendAuditLog(db, user, {
        action: action === 'CONFIRM' ? 'CONFIRM_ORDER' : 'REJECT_ORDER',
        entityType: 'DailyOrder',
        entityId: order.id,
        summary: `${action === 'CONFIRM' ? 'Xác nhận' : 'Từ chối'} đơn ${order.code}`,
        beforeJson: before,
        afterJson: order,
      });

      pushNotification(db, {
        recipientOrgId: order.customerOrgId,
        channel: ['IN_APP', 'ZALO_ZNS'],
        eventType: 'ORDER_STATUS',
        title: `Đơn ${order.code} ${action === 'CONFIRM' ? 'đã được xác nhận' : 'bị từ chối'}`,
        message:
          action === 'CONFIRM'
            ? `Đơn ngày ${order.deliveryDate} đã được Mitsui xác nhận đưa vào kế hoạch.`
            : `Đơn ngày ${order.deliveryDate} bị từ chối: ${order.rejectionReason}`,
        relatedEntityId: order.id,
      });

      return { order, status: 200 };
    }

    // Customer EDIT
    if (order.status === 'DA_XAC_NHAN' || order.status === 'HOAN_TAT' || order.status === 'TU_CHOI') {
      return { error: 'Đơn đã chốt kế hoạch hoặc hoàn tất, không thể sửa.', status: 400 };
    }

    const contract = db.frameworkContracts.find((fc) => fc.id === order.contractId);
    if (items) {
      const check = validateOrderItemsAgainstContract(items, contract, db.products);
      if (!check.valid) return { error: check.error, status: 400 };
      order.items = items.map((it) => ({
        productId: it.productId,
        requestedKg: Number(it.requestedKg),
        confirmedKg: 0,
      }));
    }
    if (timeSlot) order.timeSlot = timeSlot;
    if (deliveryPointId && contract) {
      const dp = contract.deliveryPoints.find((d) => d.id === deliveryPointId);
      if (dp) {
        order.deliveryPointId = dp.id;
        order.deliveryPointName = dp.name;
      }
    }
    const isAdHoc = isAfterCutoff(
      order.deliveryDate,
      nowIso,
      db.systemConfig.cutoffHour,
      db.systemConfig.cutoffMinute
    );
    order.isAdHoc = isAdHoc;
    order.status = isAdHoc ? 'PHAT_SINH' : 'DA_NHAN';
    order.updatedAt = nowIso;

    appendAuditLog(db, user, {
      action: 'EDIT_DAILY_ORDER',
      entityType: 'DailyOrder',
      entityId: order.id,
      summary: `Cập nhật đơn ngày ${order.code}`,
      beforeJson: before,
      afterJson: order,
    });

    return { order, status: 200 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ order: result.order });
}
