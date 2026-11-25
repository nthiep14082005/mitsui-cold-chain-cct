import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { appendAuditLog, mutateDb, readDb, resetDb } from '@/lib/db';
import { SystemConfig } from '@/types/common';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;
  const db = await readDb();

  const notifications = db.notifications.filter(
    (n) =>
      (!n.recipientOrgId && !n.recipientRole) ||
      n.recipientOrgId === user.orgId ||
      n.recipientRole === user.role ||
      user.role === 'DIEU_PHOI_VIEN' ||
      user.role === 'QUAN_LY_QC' ||
      user.role === 'QUAN_TRI_HE_THONG'
  );

  const isMitsui =
    user.role === 'QUAN_TRI_HE_THONG' ||
    user.role === 'QUAN_LY_QC' ||
    user.role === 'DIEU_PHOI_VIEN';

  return NextResponse.json({
    systemConfig: isMitsui ? db.systemConfig : null,
    auditLogs: isMitsui ? db.auditLogs.slice(0, 100) : [],
    notifications: notifications.slice(0, 50),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  const { action, systemConfig, notificationId } = body as {
    action?: 'UPDATE_CONFIG' | 'MARK_NOTIFICATION_READ';
    systemConfig?: Partial<SystemConfig>;
    notificationId?: string;
  };

  if (action === 'MARK_NOTIFICATION_READ' && notificationId) {
    await mutateDb((db) => {
      const n = db.notifications.find((item) => item.id === notificationId);
      if (n && !n.isReadByUserIds.includes(user.id)) {
        n.isReadByUserIds.push(user.id);
      }
    });
    return NextResponse.json({ ok: true });
  }

  if (user.role !== 'QUAN_TRI_HE_THONG') {
    return NextResponse.json(
      { error: 'Chỉ Quản trị hệ thống mới được thay đổi tham số vận hành (FR-52).' },
      { status: 403 }
    );
  }

  const updated = await mutateDb((db) => {
    const before = { ...db.systemConfig };
    db.systemConfig = {
      ...db.systemConfig,
      ...systemConfig,
      scoreWeights: {
        ...db.systemConfig.scoreWeights,
        ...(systemConfig?.scoreWeights ?? {}),
      },
    };
    appendAuditLog(db, user, {
      action: 'UPDATE_SYSTEM_CONFIG',
      entityType: 'SystemConfig',
      entityId: 'GLOBAL',
      summary: 'Cập nhật tham số vận hành hệ thống (FR-52)',
      beforeJson: before,
      afterJson: db.systemConfig,
    });
    return db.systemConfig;
  });

  return NextResponse.json({ systemConfig: updated });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, [
    'QUAN_TRI_HE_THONG',
    'DIEU_PHOI_VIEN',
    'QUAN_LY_QC',
  ]);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await req.json().catch(() => ({}));
  if (body.action === 'RESET_DEMO') {
    const fresh = await resetDb();
    await mutateDb((db) => {
      appendAuditLog(db, user, {
        action: 'RESET_DEMO_DB',
        entityType: 'System',
        entityId: 'cct-db.json',
        summary: 'Khôi phục dữ liệu mẫu mặc định (Reset Demo)',
      });
    });
    return NextResponse.json({
      ok: true,
      message: 'Đã khôi phục dữ liệu mẫu thành công.',
      lotsCount: fresh.lots.length,
    });
  }

  return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 });
}
