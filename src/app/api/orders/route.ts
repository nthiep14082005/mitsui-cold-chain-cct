import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, hasOrgAccess, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { isAfterCutoff, validateOrderItemsAgainstContract } from '@/domain/order-plan';
import { DailyOrder, DailyOrderItem } from '@/types/order-plan';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const filterCustomerId = req.nextUrl.searchParams.get('customerOrgId');
  if (filterCustomerId && user.role === 'KHACH_HANG' && filterCustomerId !== user.orgId) {
    return forbidCrossOrg();
  }

  let orders = db.dailyOrders;
  if (user.role === 'KHACH_HANG') {
    orders = orders.filter((o) => o.customerOrgId === user.orgId);
  } else if (filterCustomerId) {
    orders = orders.filter((o) => o.customerOrgId === filterCustomerId);
  } else if (!hasOrgAccess(user, [], { allowSystemAdmin: true })) {
    orders = [];
  }

  return NextResponse.json({
    orders: [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['KHACH_HANG', 'DIEU_PHOI_VIEN']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const {
    customerOrgId,
    deliveryDate,
    deliveryPointId,
    timeSlot,
    items,
    simulatedSubmitTime,
  } = body as {
    customerOrgId?: string;
    deliveryDate?: string;
    deliveryPointId?: string;
    timeSlot?: string;
    items?: DailyOrderItem[];
    simulatedSubmitTime?: string;
  };

  const targetCustomerId = user.role === 'KHACH_HANG' ? user.orgId : customerOrgId || user.orgId;
  if (user.role === 'KHACH_HANG' && customerOrgId && customerOrgId !== user.orgId) {
    return forbidCrossOrg();
  }

  if (!deliveryDate || !deliveryPointId || !timeSlot || !items?.length) {
    return NextResponse.json(
      { error: 'Thiếu ngày giao, điểm giao, khung giờ hoặc danh sách mặt hàng.' },
      { status: 400 }
    );
  }

  const result = await mutateDb((db) => {
    const contract = db.frameworkContracts.find(
      (fc) => fc.customerOrgId === targetCustomerId && fc.status === 'ACTIVE'
    );
    const check = validateOrderItemsAgainstContract(items, contract, db.products);
    if (!check.valid || !contract) {
      return { error: check.error || 'Hợp đồng không hợp lệ.', status: 400 };
    }

    const dp = contract.deliveryPoints.find((d) => d.id === deliveryPointId);
    if (!dp) {
      return { error: 'Điểm giao không thuộc hợp đồng khung.', status: 400 };
    }

    const nowIso = simulatedSubmitTime || new Date().toISOString();
    const isAdHoc = isAfterCutoff(
      deliveryDate,
      nowIso,
      db.systemConfig.cutoffHour,
      db.systemConfig.cutoffMinute
    );

    const seq = db.dailyOrders.length + 1;
    const order: DailyOrder = {
      id: `ORD-${deliveryDate.replace(/-/g, '').slice(2)}-${crypto.randomBytes(2).toString('hex')}`,
      code: `DN-${deliveryDate.replace(/-/g, '').slice(2)}-${String(seq).padStart(2, '0')}`,
      customerOrgId: targetCustomerId,
      contractId: contract.id,
      deliveryDate,
      deliveryPointId: dp.id,
      deliveryPointName: dp.name,
      timeSlot,
      createdAt: nowIso,
      updatedAt: nowIso,
      isAdHoc,
      status: isAdHoc ? 'PHAT_SINH' : 'DA_NHAN',
      items: items.map((it) => ({
        productId: it.productId,
        requestedKg: Number(it.requestedKg),
        confirmedKg: 0,
      })),
      fulfilledLotIds: [],
    };

    db.dailyOrders.unshift(order);

    appendAuditLog(db, user, {
      action: 'CREATE_DAILY_ORDER',
      entityType: 'DailyOrder',
      entityId: order.id,
      summary: `Tạo đơn ngày ${order.code} (${isAdHoc ? 'Phát sinh sau giờ chốt' : 'Trước giờ chốt'})`,
      afterJson: order,
    });

    if (isAdHoc) {
      pushNotification(db, {
        recipientRole: 'DIEU_PHOI_VIEN',
        channel: ['IN_APP', 'ZALO_ZNS'],
        eventType: 'ORDER_ADHOC',
        title: `Đơn phát sinh mới ${order.code}`,
        message: `Đơn giao ngày ${deliveryDate} gửi sau ${db.systemConfig.cutoffHour}:00 D-1 đang chờ điều phối viên xác nhận.`,
        relatedEntityId: order.id,
      });
    }

    return { order, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ order: result.order }, { status: result.status });
}
