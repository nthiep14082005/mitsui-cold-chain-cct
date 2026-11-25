import { NextRequest, NextResponse } from 'next/server';
import { forbidCrossOrg, requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, pushNotification, readDb } from '@/lib/db';
import { aggregateOrdersToSupplyPlan } from '@/domain/order-plan';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  let plans = db.supplyPlans;
  // NFR-07: Supplier (HTX) only sees allocations assigned to their own org
  if (user.role === 'NHA_CUNG_CAP') {
    plans = plans.map((p) => ({
      ...p,
      allocations: p.allocations.filter((a) => a.supplierOrgId === user.orgId),
    }));
  }

  return NextResponse.json({ plans });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, ['DIEU_PHOI_VIEN', 'QUAN_LY_QC']);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { planDate, action, allocations } = body as {
    planDate?: string;
    action?: 'GENERATE' | 'PUBLISH';
    allocations?: Array<{ id: string; supplierOrgId: string; requiredRawKg: number }>;
  };

  if (!planDate) {
    return NextResponse.json({ error: 'Thiếu ngày kế hoạch (planDate).' }, { status: 400 });
  }

  const result = await mutateDb((db) => {
    const existingIdx = db.supplyPlans.findIndex((p) => p.planDate === planDate);

    if (action === 'PUBLISH') {
      if (existingIdx === -1) {
        return { error: `Chưa có bản tổng hợp kế hoạch ngày ${planDate}.`, status: 404 };
      }
      const plan = db.supplyPlans[existingIdx];
      if (allocations?.length) {
        for (const patch of allocations) {
          const alloc = plan.allocations.find((a) => a.id === patch.id);
          if (alloc) {
            alloc.supplierOrgId = patch.supplierOrgId;
            alloc.requiredRawKg = patch.requiredRawKg;
          }
        }
      }

      plan.status = 'DA_PHAT_HANH';
      plan.publishedAt = new Date().toISOString();

      // Transition included orders to DA_XAC_NHAN per UC-01
      for (const order of db.dailyOrders) {
        if (plan.orderIds.includes(order.id) && order.status === 'DA_NHAN') {
          order.status = 'DA_XAC_NHAN';
          order.confirmedByUserId = user.id;
          order.items = order.items.map((it) => ({
            ...it,
            confirmedKg: it.confirmedKg > 0 ? it.confirmedKg : it.requestedKg,
          }));
          pushNotification(db, {
            recipientOrgId: order.customerOrgId,
            channel: ['IN_APP', 'ZALO_ZNS'],
            eventType: 'ORDER_CONFIRMED',
            title: `Đơn ${order.code} đã xác nhận trong kế hoạch`,
            message: `Kế hoạch cung ứng ngày ${planDate} đã được phát hành.`,
            relatedEntityId: order.id,
          });
        }
      }

      // Notify assigned suppliers
      const supplierIds = Array.from(new Set(plan.allocations.map((a) => a.supplierOrgId)));
      for (const supId of supplierIds) {
        pushNotification(db, {
          recipientOrgId: supId,
          channel: ['IN_APP', 'ZALO_ZNS', 'SMS'],
          eventType: 'HARVEST_PLAN_PUBLISHED',
          title: `Kế hoạch thu hoạch mới ngày ${planDate}`,
          message: `Mitsui vừa phát hành kế hoạch ${plan.code}. Vui lòng xác nhận sản lượng và khai báo nguồn gốc.`,
          relatedEntityId: plan.id,
        });
      }

      appendAuditLog(db, user, {
        action: 'PUBLISH_SUPPLY_PLAN',
        entityType: 'SupplyPlan',
        entityId: plan.id,
        summary: `Phát hành kế hoạch cung ứng ${plan.code} cho ngày ${planDate}`,
        afterJson: plan,
      });

      return { plan, status: 200 };
    }

    // GENERATE / REFRESH draft plan
    const newPlan = aggregateOrdersToSupplyPlan({
      planDate,
      orders: db.dailyOrders,
      products: db.products,
      suppliers: db.organizations,
      existingPlanId: existingIdx >= 0 ? db.supplyPlans[existingIdx].id : undefined,
    });

    if (existingIdx >= 0) {
      db.supplyPlans[existingIdx] = newPlan;
    } else {
      db.supplyPlans.unshift(newPlan);
    }

    appendAuditLog(db, user, {
      action: 'GENERATE_SUPPLY_PLAN',
      entityType: 'SupplyPlan',
      entityId: newPlan.id,
      summary: `Tổng hợp nhu cầu ngày ${planDate} (${newPlan.orderIds.length} đơn, đã cộng hệ số hao hụt)`,
      afterJson: newPlan,
    });

    return { plan: newPlan, status: 201 };
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ plan: result.plan }, { status: result.status });
}
